import { ForbiddenException } from "@nestjs/common";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsService, STORAGE_PORT } from "./documents.service.js";
import { LocalFsAdapter } from "./storage.js";

function fakePrisma() {
  const db = {
    documents: [] as Array<Record<string, unknown> & { id: string }>,
    versions: [] as Array<Record<string, unknown> & { id: string }>,
    audits: [] as Array<Record<string, unknown>>,
  };
  let seq = 0;
  const prisma = {
    document: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        db.documents.find(
          (d) => d.id === where.id || (d.tenantId === where.tenantId && d.folderPath === where.folderPath && d.name === where.name && !d.deletedAt),
        ),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `doc-${++seq}`, currentVersion: 0 };
        db.documents.push(row);
        return row;
      }),
      findMany: vi.fn(async () => db.documents.filter((d) => !d.deletedAt)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.documents.find((d) => d.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    documentVersion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `dv-${++seq}` };
        db.versions.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: { where: { documentId: string; version?: number }; orderBy?: unknown }) => {
        const candidates = db.versions.filter((v) => v.documentId === where.documentId);
        const sorted = [...candidates].sort((a, b) => (b.version as number) - (a.version as number));
        return where.version ? sorted.find((v) => v.version === where.version) : sorted[0];
      }),
    },
    auditEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (db.audits.push(data), data)) },
  };
  return { prisma, db };
}

const permissions = { require: vi.fn(() => ({ allowed: true })) };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "buildos-docs-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

const TENANT = "t-1";
const USER = "u-1";
const content = Buffer.from("RERA sanctioned plan v1");
const upload = (svc: DocumentsService, name = "plan.pdf") =>
  svc.upload({
    tenantId: TENANT,
    userId: USER,
    projectId: "proj-1",
    folderPath: "/legal/approvals",
    name,
    docClass: "approval",
    mimeType: "application/pdf",
    content,
  });

describe("DocumentsService (WP-0F)", () => {
  it("stores content on disk at a tenant-scoped key and records version metadata", async () => {
    const { prisma, db } = fakePrisma();
    const storage = new LocalFsAdapter(dir);
    const svc = new DocumentsService(prisma as never, storage, permissions as never);

    const out = await upload(svc);
    expect(out.version).toBe(1);
    expect(out.sha256).toHaveLength(64);

    const v = db.versions[0]!;
    expect(String(v.storageKey)).toMatch(/^t-1\/proj-1\//); // tenant-scoped key
    const stored = await storage.get(String(v.storageKey));
    expect(stored.toString()).toBe("RERA sanctioned plan v1");
    expect(db.audits[0]).toMatchObject({ action: "docs.uploaded", actorKind: "human" });
  });

  it("re-upload creates version 2 with a distinct key; old version still downloadable", async () => {
    const { prisma, db } = fakePrisma();
    const storage = new LocalFsAdapter(dir);
    const svc = new DocumentsService(prisma as never, storage, permissions as never);

    const v1 = await upload(svc);
    const v2 = await svc.upload({
      tenantId: TENANT, userId: USER, projectId: "proj-1",
      folderPath: "/legal/approvals", name: "plan.pdf",
      docClass: "approval", mimeType: "application/pdf",
      content: Buffer.from("RERA sanctioned plan v2 — revised"),
    });
    expect(v2.version).toBe(2);
    expect(v2.sha256).not.toBe(v1.sha256);

    const old = await svc.download(TENANT, USER, v1.documentId, 1);
    expect(old.content.toString()).toBe("RERA sanctioned plan v1");
    const latest = await svc.download(TENANT, USER, v1.documentId);
    expect(latest.version).toBe(2);
  });

  it("checks permissions with the project scope and propagates denial", async () => {
    const { prisma } = fakePrisma();
    const svc = new DocumentsService(prisma as never, new LocalFsAdapter(dir), permissions as never);
    await upload(svc);
    expect(permissions.require).toHaveBeenCalledWith("docs.create", { projectId: "proj-1" });

    const docId = (await svc.list(TENANT, { projectId: "proj-1" }))[0] as { id: string };
    permissions.require.mockImplementationOnce(() => {
      throw new ForbiddenException("no docs.read for this project");
    });
    await expect(svc.download(TENANT, USER, docId.id)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects path traversal in folder paths and storage keys", async () => {
    const { prisma } = fakePrisma();
    const storage = new LocalFsAdapter(dir);
    const svc = new DocumentsService(prisma as never, storage, permissions as never);
    await expect(
      svc.upload({
        tenantId: TENANT, userId: USER, folderPath: "/../etc", name: "x",
        docClass: "other", mimeType: "text/plain", content: Buffer.from("x"),
      }),
    ).rejects.toThrow(RangeError);
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(RangeError);
  });

  it("soft delete hides the document but keeps versions on disk (7y retention)", async () => {
    const { prisma, db } = fakePrisma();
    const storage = new LocalFsAdapter(dir);
    const svc = new DocumentsService(prisma as never, storage, permissions as never);
    const up = await upload(svc);
    await svc.softDelete(TENANT, USER, up.documentId);
    expect(db.documents[0]!.deletedAt).toBeDefined();
    expect(db.versions).toHaveLength(1); // content retained
    expect(db.audits.at(-1)).toMatchObject({ action: "docs.soft_deleted" });
  });
});

describe("LocalFsAdapter", () => {
  it(STORAGE_PORT + " contract: put/get round-trip", async () => {
    const storage = new LocalFsAdapter(dir);
    await storage.put("a/b/c.txt", Buffer.from("hello"));
    expect((await readFile(join(dir, "a/b/c.txt"))).toString()).toBe("hello");
  });
});
