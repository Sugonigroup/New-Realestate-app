import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM customization & operations (CRM-021/022/072/073/099/104):
 * - Saved views: named filter+column presets per entity type, owned or shared
 * - Custom fields: typed field registry per entity + upsert-able values per record
 * - Bulk assignment: per-lead results (success/failure with reason), reason=bulk
 * - Data quality scan: missing contact fields, unresolved duplicates, stale statuses
 */

const FIELD_TYPES = ["text", "number", "date", "select", "boolean"] as const;

@Injectable()
export class CrmConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Saved views (CRM-072/073) ───────────────────────────────────────────

  async createSavedView(tenantId: string, input: {
    name: string;
    entityType: "lead" | "opportunity";
    filters: object;
    columns?: string[];
    ownerId: string;
    isShared?: boolean;
  }) {
    const existing = await this.prisma.crmSavedView.findFirst({
      where: { tenantId, entityType: input.entityType, name: input.name, ownerId: input.ownerId },
    });
    if (existing) throw new ConflictException(`view "${input.name}" already exists for this entity`);
    return this.prisma.crmSavedView.create({
      data: {
        tenantId,
        name: input.name,
        entityType: input.entityType,
        filters: input.filters,
        columns: input.columns ?? undefined,
        ownerId: input.ownerId,
        isShared: input.isShared ?? false,
      },
    });
  }

  /** Views visible to a user: their own + shared within the tenant. */
  async listViews(tenantId: string, entityType: string, userId: string) {
    const views = await this.prisma.crmSavedView.findMany({
      where: { tenantId, entityType },
    });
    return views.filter((v) => v.isShared || v.ownerId === userId);
  }

  // ── Custom fields (CRM-022) ─────────────────────────────────────────────

  async defineField(tenantId: string, input: {
    entityType: "lead" | "opportunity";
    key: string;
    label: string;
    fieldType: (typeof FIELD_TYPES)[number];
    options?: string[];
    required?: boolean;
  }) {
    if (input.fieldType === "select" && (!input.options || input.options.length === 0)) {
      throw new BadRequestException("select fields need at least one option");
    }
    const existing = await this.prisma.crmCustomField.findFirst({
      where: { tenantId, entityType: input.entityType, key: input.key },
    });
    if (existing) throw new ConflictException(`field ${input.key} already defined for ${input.entityType}`);

    return this.prisma.crmCustomField.create({
      data: {
        tenantId,
        entityType: input.entityType,
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        options: input.options ?? undefined,
        required: input.required ?? false,
        active: true,
      },
    });
  }

  /** Set a custom field value with type validation against the registry. */
  async setFieldValue(tenantId: string, input: {
    entityType: "lead" | "opportunity";
    entityId: string;
    fieldKey: string;
    value: string;
  }) {
    const field = await this.prisma.crmCustomField.findFirst({
      where: { tenantId, entityType: input.entityType, key: input.fieldKey, active: true },
    });
    if (!field) throw new NotFoundException(`custom field ${input.fieldKey} not defined for ${input.entityType}`);

    const v = input.value;
    if (field.fieldType === "number" && Number.isNaN(Number(v))) {
      throw new BadRequestException(`${input.fieldKey} expects a number`);
    }
    if (field.fieldType === "date" && Number.isNaN(Date.parse(v))) {
      throw new BadRequestException(`${input.fieldKey} expects an ISO date`);
    }
    if (field.fieldType === "boolean" && !["true", "false"].includes(v)) {
      throw new BadRequestException(`${input.fieldKey} expects true/false`);
    }
    if (field.fieldType === "select" && !(field.options as string[] | null)?.includes(v)) {
      throw new BadRequestException(`${input.fieldKey} must be one of ${(field.options as string[])?.join(", ")}`);
    }

    return this.prisma.crmCustomFieldValue.upsert({
      where: {
        tenantId_entityType_entityId_fieldKey: {
          tenantId, entityType: input.entityType, entityId: input.entityId, fieldKey: input.fieldKey,
        },
      },
      create: {
        tenantId, entityType: input.entityType, entityId: input.entityId, fieldKey: input.fieldKey, value: v,
      },
      update: { value: v },
    });
  }

  async getFieldValues(tenantId: string, entityType: string, entityId: string) {
    const rows = await this.prisma.crmCustomFieldValue.findMany({
      where: { tenantId, entityType, entityId },
    });
    return Object.fromEntries(rows.map((r) => [r.fieldKey, r.value]));
  }

  // ── Bulk assignment (CRM-099) ───────────────────────────────────────────

  async bulkAssign(tenantId: string, leadIds: string[], toUserId: string, assignedBy: string) {
    if (leadIds.length === 0) throw new BadRequestException("leadIds required");
    if (leadIds.length > 200) throw new BadRequestException("bulk limit is 200 leads per operation");

    const results: Array<{ leadId: string; ok: boolean; error?: string }> = [];
    for (const leadId of leadIds) {
      try {
        const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: leadId } });
        if (!lead) throw new NotFoundException(`lead ${leadId} not found`);
        if (["won", "lost", "disqualified"].includes(lead.status as string)) {
          throw new ConflictException(`lead is ${lead.status}`);
        }
        await this.prisma.lead.update({ where: { id: lead.id }, data: { assignedUserId: toUserId } });
        await this.prisma.leadAssignmentLog.create({
          data: {
            tenantId, leadId, fromUserId: (lead.assignedUserId as string) ?? null,
            toUserId, reason: "bulk", assignedBy, at: new Date(),
          },
        });
        results.push({ leadId, ok: true });
      } catch (err) {
        results.push({ leadId, ok: false, error: err instanceof Error ? err.message : "failed" });
      }
    }
    return {
      total: leadIds.length,
      assigned: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  // ── Data quality (CRM-104) ──────────────────────────────────────────────

  async dataQualityScan(tenantId: string) {
    const leads = await this.prisma.lead.findMany({ where: { tenantId } });

    const missingPhone = leads.filter((l) => !l.phone).length;
    const missingBudget = leads.filter((l) => !l.budgetPaise).length;
    const duplicates = leads.filter((l) => l.dedupFlag === "duplicate").length;
    const staleCutoff = Date.now() - 30 * 86_400_000;
    const stale = leads.filter(
      (l) => ["contacted", "qualified"].includes(l.status as string) &&
        new Date(l.updatedAt as unknown as string).getTime() < staleCutoff,
    ).length;

    const checks = [
      { check: "missing_phone", count: missingPhone, severity: "high" },
      { check: "missing_budget", count: missingBudget, severity: "medium" },
      { check: "unresolved_duplicates", count: duplicates, severity: "high" },
      { check: "stale_no_progress_30d", count: stale, severity: "medium" },
    ];
    const totalIssues = checks.reduce((s, c) => s + c.count, 0);
    const score = leads.length === 0 ? 100 : Math.max(0, 100 - Math.round((totalIssues / leads.length) * 100));

    return { totalLeads: leads.length, qualityScore: score, checks };
  }
}
