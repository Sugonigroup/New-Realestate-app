import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { sha256, type StoragePort } from "./storage.js";

export const STORAGE_PORT = "StoragePort";

export interface UploadInput {
  tenantId: string;
  userId: string;
  projectId?: string;
  folderPath: string; // "/legal/approvals"
  name: string;
  docClass: string;
  mimeType: string;
  content: Buffer;
  expiryAt?: Date;
}

/**
 * Document vault (WP-0F): versioned, permission-checked, audit-logged.
 * Storage keys never reach the client; downloads flow through the service so
 * watermarking/redaction (05) stays enforceable.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly permissions: PermissionsService,
  ) {}

  async upload(input: UploadInput): Promise<{ documentId: string; version: number; sha256: string }> {
    this.permissions.require("docs.create", { projectId: input.projectId });
    if (!input.folderPath.startsWith("/") || input.folderPath.includes("..")) {
      throw new RangeError(`invalid folderPath: ${input.folderPath}`);
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        tenantId: input.tenantId,
        folderPath: input.folderPath,
        name: input.name,
        deletedAt: null,
      },
    });

    const digest = sha256(input.content);
    const documentId = doc?.id ?? (
      await this.prisma.document.create({
        data: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          folderPath: input.folderPath,
          name: input.name,
          docClass: input.docClass,
          createdBy: input.userId,
        },
      })
    ).id;
    const version = (doc?.currentVersion ?? 0) + 1;

    const storageKey = `${input.tenantId}/${input.projectId ?? "shared"}/${documentId}/v${version}-${digest.slice(0, 12)}`;
    await this.storage.put(storageKey, input.content);
    const row = await this.prisma.documentVersion.create({
      data: {
        tenantId: input.tenantId,
        documentId,
        version,
        storageKey,
        sizeBytes: input.content.length,
        mimeType: input.mimeType,
        sha256: digest,
        uploadedBy: input.userId,
        expiryAt: input.expiryAt,
      },
    });
    await this.prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: version },
    });
    await this.audit(input.tenantId, input.userId, "uploaded", documentId, { version, sha256: digest });
    return { documentId, version, sha256: digest };
  }

  async download(
    tenantId: string,
    userId: string,
    documentId: string,
    version?: number,
  ): Promise<{ content: Buffer; mimeType: string; version: number; sha256: string }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException("document not found");
    this.permissions.require("docs.read", { projectId: doc.projectId ?? undefined });

    const v = await this.prisma.documentVersion.findFirst({
      where: { documentId, ...(version ? { version } : {}) },
      orderBy: { version: "desc" },
    });
    if (!v) throw new NotFoundException("version not found");
    const content = await this.storage.get(v.storageKey);
    await this.audit(tenantId, userId, "downloaded", documentId, { version: v.version });
    return { content, mimeType: v.mimeType, version: v.version, sha256: v.sha256 };
  }

  async list(tenantId: string, filters: { projectId?: string; folderPrefix?: string }): Promise<unknown[]> {
    this.permissions.require("docs.read", { projectId: filters.projectId });
    return this.prisma.document.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.folderPrefix ? { folderPath: { startsWith: filters.folderPrefix } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async softDelete(tenantId: string, userId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, tenantId, deletedAt: null } });
    if (!doc) throw new NotFoundException("document not found");
    this.permissions.require("docs.delete", { projectId: doc.projectId ?? undefined });
    await this.prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await this.audit(tenantId, userId, "soft_deleted", documentId, { name: doc.name });
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    documentId: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId: userId,
        actorKind: "human",
        action: `docs.${action}`,
        entityType: "document",
        entityId: documentId,
        after: detail as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
