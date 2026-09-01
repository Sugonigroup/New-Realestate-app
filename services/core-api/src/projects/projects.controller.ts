import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProjectsService } from "./projects.service.js";

const activityDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  durationDays: z.number().int().min(1),
  deps: z.array(z.string()).default([]),
});

const certifyDto = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  photoCount: z.number().int().min(0),
  pourCardsClosed: z.boolean(),
  openNcrs: z.number().int().min(0),
  structuralCertificateRef: z.string().optional(),
  caCertificateRef: z.string().optional(),
});

const approvalDto = z.object({
  kind: z.string().min(1),
  ref: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.projects.list(ctx!.tenantId!);
  }

  @Post(":projectId/activities")
  async addActivity(@Param("projectId") projectId: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.wbs.edit");
    const dto = activityDto.parse(body);
    const ctx = getRequestContext();
    return this.projects.addActivity(ctx!.tenantId!, projectId, dto);
  }

  @Get(":projectId/activities")
  async activities(@Param("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.projects.listActivities(ctx!.tenantId!, projectId);
  }

  @Get(":projectId/schedule")
  async schedule(@Param("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.projects.schedule(ctx!.tenantId!, projectId);
  }

  @Get(":projectId/milestones")
  async milestones(@Param("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.projects.listMilestones(ctx!.tenantId!, projectId);
  }

  @Post(":projectId/milestones/certify")
  async certify(@Param("projectId") projectId: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.milestone.create");
    const dto = certifyDto.parse(body);
    const ctx = getRequestContext();
    return this.projects.certifyMilestone(
      ctx!.tenantId!, projectId, dto.key, dto.label,
      {
        photoCount: dto.photoCount,
        pourCardsClosed: dto.pourCardsClosed,
        openNcrs: dto.openNcrs,
        structuralCertificateRef: dto.structuralCertificateRef,
        caCertificateRef: dto.caCertificateRef,
      },
      ctx!.userId!,
    );
  }

  @Post(":projectId/approvals")
  async addApproval(@Param("projectId") projectId: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = approvalDto.parse(body);
    const ctx = getRequestContext();
    return this.projects.addApproval(ctx!.tenantId!, projectId, {
      kind: dto.kind, ref: dto.ref, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get(":projectId/approvals")
  async approvals(@Param("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.projects.approvalsReport(ctx!.tenantId!, projectId, new Date());
  }
}
