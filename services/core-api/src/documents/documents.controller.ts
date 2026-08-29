import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { DocumentsService } from "./documents.service.js";

const uploadDto = z.object({
  projectId: z.string().uuid().optional(),
  folderPath: z.string().regex(/^\/[^?]*$/),
  name: z.string().min(1).max(255),
  docClass: z.enum([
    "drawing", "contract", "boq", "invoice", "approval", "certificate", "site_photo", "policy", "other",
  ]),
  mimeType: z.string().min(3),
  contentBase64: z.string().min(1),
  expiryAt: z.string().datetime().optional(),
});

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Phase 0: base64 JSON (multipart lands with the WP-0G upload widget). */
  @Post()
  async upload(@Body() body: unknown): Promise<unknown> {
    const dto = uploadDto.parse(body);
    const ctx = getRequestContext();
    return this.documents.upload({
      tenantId: ctx!.tenantId!,
      userId: ctx!.userId!,
      projectId: dto.projectId,
      folderPath: dto.folderPath,
      name: dto.name,
      docClass: dto.docClass,
      mimeType: dto.mimeType,
      content: Buffer.from(dto.contentBase64, "base64"),
      expiryAt: dto.expiryAt ? new Date(dto.expiryAt) : undefined,
    });
  }

  @Get()
  async list(
    @Query("projectId") projectId?: string,
    @Query("folderPrefix") folderPrefix?: string,
  ): Promise<unknown> {
    const ctx = getRequestContext();
    return this.documents.list(ctx!.tenantId!, { projectId, folderPrefix });
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Query("version") version?: string): Promise<unknown> {
    const ctx = getRequestContext();
    const out = await this.documents.download(ctx!.tenantId!, ctx!.userId!, id, version ? Number(version) : undefined);
    return { ...out, contentBase64: out.content.toString("base64"), content: undefined };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    const ctx = getRequestContext();
    await this.documents.softDelete(ctx!.tenantId!, ctx!.userId!, id);
    return { ok: true };
  }
}
