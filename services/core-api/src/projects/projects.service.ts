import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { computeCpm, type CpmActivity } from "./cpm.js";
import { evaluateCertification, type CertificationEvidence } from "./certification.js";
import { scanExpiries } from "./site-ops.js";

/** Projects service (U3): schedule (CPM), milestone certification → demand engine, approvals register. */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async addActivity(tenantId: string, projectId: string, input: { code: string; name: string; durationDays: number; deps: string[] }): Promise<unknown> {
    return this.prisma.constructionActivity.create({
      data: { tenantId, projectId, code: input.code, name: input.name, durationDays: input.durationDays, deps: input.deps },
    });
  }

  async listActivities(tenantId: string, projectId: string): Promise<unknown[]> {
    return this.prisma.constructionActivity.findMany({ where: { tenantId, projectId }, orderBy: { code: "asc" } });
  }

  /** CPM over the persisted activities — the source for the Gantt and health tiles. */
  async schedule(tenantId: string, projectId: string): Promise<unknown> {
    const rows = (await this.prisma.constructionActivity.findMany({
      where: { tenantId, projectId },
      orderBy: { code: "asc" },
    })) as unknown as Array<{ code: string; durationDays: number; deps: string[] }>;
    const activities: CpmActivity[] = rows.map((r) => ({ id: r.code, durationDays: r.durationDays, deps: r.deps }));
    if (activities.length === 0) return { nodes: {}, projectDuration: 0, criticalPath: [] };
    return computeCpm(activities);
  }

  /** Certification gate (11 §3): full evidence package or refuse; success → demand engine. */
  async certifyMilestone(
    tenantId: string,
    projectId: string,
    key: string,
    label: string,
    evidence: CertificationEvidence,
    actorUserId: string,
  ): Promise<{ ok: boolean; blockers?: string[]; milestoneId?: string }> {
    const decision = evaluateCertification(evidence);
    if (!decision.ok) return { ok: false, blockers: decision.blockers };

    const milestone = await this.prisma.milestone.upsert({
      where: { tenantId_projectId_key: { tenantId, projectId, key } },
      update: { state: "certified", certifiedAt: new Date(), evidence: evidence as unknown as object },
      create: { tenantId, projectId, key, label, state: "certified", certifiedAt: new Date(), evidence: evidence as unknown as object },
    });
    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        aggregate: "milestone",
        type: "milestone.certified.v1",
        payload: { projectId, key, label, certifiedAt: milestone.certifiedAt?.toISOString() },
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorUserId, actorKind: "human",
        action: "projects.milestone.certified",
        entityType: "milestone", entityId: milestone.id,
        after: { key, label },
      },
    });
    return { ok: true, milestoneId: milestone.id };
  }

  async listMilestones(tenantId: string, projectId: string): Promise<unknown[]> {
    return this.prisma.milestone.findMany({ where: { tenantId, projectId }, orderBy: { createdAt: "asc" } });
  }

  /** Approvals register with expiry scan (WP-3A). */
  async addApproval(tenantId: string, projectId: string, input: { kind: string; ref: string; expiresAt?: Date }): Promise<unknown> {
    return this.prisma.approvalDoc.create({
      data: { tenantId, projectId, kind: input.kind, ref: input.ref, expiresAt: input.expiresAt },
    });
  }

  async approvalsReport(tenantId: string, projectId: string, now: Date, withinDays = 60): Promise<unknown> {
    const docs = (await this.prisma.approvalDoc.findMany({
      where: { tenantId, projectId },
    })) as unknown as Array<{ id: string; kind: string; ref: string; expiresAt: Date | null }>;
    return scanExpiries(docs, now, withinDays);
  }
}
