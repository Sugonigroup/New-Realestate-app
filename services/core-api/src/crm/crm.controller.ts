import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { CrmService, type RoutingContext } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { EngagementService } from "./engagement.service.js";
import { CrmCommsService } from "./comms.service.js";
import { CrmAnalyticsService } from "./analytics.service.js";
import { CrmAssistService } from "./assist.service.js";
import { CrmConfigService } from "./config.service.js";
import { CrmDraftService } from "./draft.service.js";
import { CrmLifecycleService } from "./lifecycle.service.js";

/** HMAC verification for lead webhooks (05 §7: signed ingestion, replay-safe ids). */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

const webhookDto = z.object({
  source: z.enum(["website", "meta_ads", "google_ads", "portal", "whatsapp", "ivr", "walkin", "partner"]),
  sourceRef: z.string().optional(),
  projectId: z.string().uuid().optional(),
  campaignId: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  segment: z.string().optional(),
  language: z.string().optional(),
});

@ApiTags("crm")
@Controller()
export class CrmController {
  /** Routing config comes from tenant settings (admin UI lands in WP-0D screens). */
  private routingFor(tenantId: string): RoutingContext {
    void tenantId;
    return {
      rules: [
        { segment: "commercial", assignToRole: "sales_manager" },
        { language: "hi", assignToUsers: ["exec-hindi-1", "exec-hindi-2"] },
        { assignToUsers: ["exec-1", "exec-2", "exec-3"], assignToRole: "sales_executive" },
      ],
      userLoad: this.load,
      lastAssigned: this.lastAssigned,
    };
  }

  private readonly load = new Map<string, number>();
  private readonly lastAssigned = new Map<string, number>();

  constructor(
    private readonly crm: CrmService,
    private readonly pipeline: CrmPipelineService,
    private readonly engagement: EngagementService,
    private readonly comms: CrmCommsService,
    private readonly analytics: CrmAnalyticsService,
    private readonly assist: CrmAssistService,
    private readonly config: CrmConfigService,
    private readonly drafts: CrmDraftService,
    private readonly lifecycle: CrmLifecycleService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Signed webhook ingestion (website widget / portal bridges). */
  @Post("leads/webhook")
  async webhook(@Req() req: RawBodyRequest<Request>, @Query("signature") signature: string): Promise<unknown> {
    const raw = req.rawBody?.toString("utf8");
    const secret = process.env.LEAD_WEBHOOK_SECRET;
    if (!raw || !secret || !signature || !verifyWebhookSignature(raw, signature, secret)) {
      throw new ForbiddenException({ title: "Invalid webhook signature" });
    }
    const dto = webhookDto.parse(JSON.parse(raw));
    const tenantId = process.env.LEAD_WEBHOOK_TENANT_ID;
    if (!tenantId) throw new BadRequestException({ title: "Webhook tenant not configured" });
    return this.crm.ingest({ tenantId, ...dto, budgetPaise: undefined }, this.routingFor(tenantId));
  }

  @Post("crm/leads/import")
  async import(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.create");
    const { csv, projectId } = z
      .object({ csv: z.string().min(1), projectId: z.string().uuid().optional() })
      .parse(body);
    const ctx = getRequestContext();
    return this.crm.importCsv(ctx!.tenantId!, csv, this.routingFor(ctx!.tenantId!), { projectId });
  }

  @Get("crm/leads")
  async inbox(@Query("status") status?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.crm.listLeads(ctx!.tenantId!, status);
  }

  @Get("crm/leads/:id")
  async lead(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.crm.getLead(ctx!.tenantId!, id);
  }

  @Get("crm/leads/:id/interactions")
  async interactions(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.crm.listInteractions(ctx!.tenantId!, id);
  }

  @Post("crm/leads/:id/status")
  async moveStatus(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const { status } = z.object({ status: z.string().min(3) }).parse(body);
    const ctx = getRequestContext();
    return this.crm.updateStatus(ctx!.tenantId!, id, status);
  }

  @Post("crm/leads/:id/interactions")
  async interact(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        type: z.enum(["call", "whatsapp", "email", "visit", "note"]),
        disposition: z.string().max(64).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.crm.addInteraction(ctx!.tenantId!, id, { ...dto, byUserId: ctx!.userId! });
  }

  // ── Opportunity pipeline (CRM-030..044) ─────────────────────────────────

  @Post("crm/opportunities")
  async createOpportunity(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        oppNo: z.string().min(1),
        leadId: z.string().uuid(),
        projectId: z.string().uuid(),
        budgetPaise: z.string().regex(/^\d+$/).optional(),
        financing: z.enum(["cash", "loan", "pre_approved"]).optional(),
        expectedValuePaise: z.string().regex(/^\d+$/).optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.pipeline.createOpportunity(ctx!.tenantId!, {
      oppNo: dto.oppNo,
      leadId: dto.leadId,
      projectId: dto.projectId,
      budgetPaise: dto.budgetPaise ? BigInt(dto.budgetPaise) : undefined,
      financing: dto.financing,
      expectedValuePaise: dto.expectedValuePaise ? BigInt(dto.expectedValuePaise) : undefined,
    });
  }

  @Post("crm/opportunities/:oppNo/stage")
  async moveStage(@Param("oppNo") oppNo: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({ to: z.enum(["prospect", "qualification", "unit_interest", "site_visit", "offer", "hold", "booking_pending"]) })
      .parse(body);
    const ctx = getRequestContext();
    return this.pipeline.moveStage(ctx!.tenantId!, oppNo, dto.to);
  }

  @Post("crm/opportunities/:oppNo/lost")
  async markLost(@Param("oppNo") oppNo: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ lostReason: z.string().min(1), competitor: z.string().optional() }).parse(body);
    const ctx = getRequestContext();
    return this.pipeline.markLost(ctx!.tenantId!, oppNo, dto.lostReason, dto.competitor);
  }

  @Post("crm/opportunities/:oppNo/win")
  async handoffToBooking(@Param("oppNo") oppNo: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ bookingId: z.string().uuid() }).parse(body);
    const ctx = getRequestContext();
    return this.pipeline.handoffToBooking(ctx!.tenantId!, oppNo, dto.bookingId);
  }

  @Post("crm/opportunities/:oppNo/unit-interest")
  async addUnitInterest(@Param("oppNo") oppNo: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        unitId: z.string().uuid().optional(),
        towerPref: z.string().optional(),
        floorPref: z.number().int().optional(),
        configType: z.string().optional(),
        areaPrefSqm: z.number().positive().optional(),
        budgetPaise: z.string().regex(/^\d+$/).optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.pipeline.addUnitInterest(ctx!.tenantId!, oppNo, {
      ...dto,
      budgetPaise: dto.budgetPaise ? BigInt(dto.budgetPaise) : undefined,
    });
  }

  @Get("crm/analytics/pipeline-forecast")
  async forecast(@Query("projectId") projectId?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.pipeline.forecast(ctx!.tenantId!, projectId);
  }

  @Get("crm/analytics/opportunity-aging")
  async aging(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.pipeline.aging(ctx!.tenantId!);
  }

  // ── Lead lifecycle completion (merge/update/convert, SLA sweep, rules) ──

  @Patch("crm/leads/:id")
  async updateLead(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        fullName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        budgetPaise: z.string().regex(/^\d+$/).optional(),
        segment: z.string().optional(),
        projectId: z.string().uuid().optional(),
        language: z.string().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.updateLead(ctx!.tenantId!, id, {
      fullName: dto.fullName,
      email: dto.email,
      budgetPaise: dto.budgetPaise ? BigInt(dto.budgetPaise) : undefined,
      segment: dto.segment,
      projectId: dto.projectId,
      language: dto.language,
    }, ctx!.userId!);
  }

  @Post("crm/leads/:id/convert")
  async convertLead(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ oppNo: z.string().min(1) }).parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.convertLead(ctx!.tenantId!, id, dto.oppNo, ctx!.userId!);
  }

  @Post("crm/leads/:id/merge")
  async mergeLead(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.assign");
    const dto = z
      .object({
        duplicateId: z.string().uuid(),
        fieldWinners: z.record(z.enum(["survivor", "duplicate", "longer"])).optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.mergeLeads(ctx!.tenantId!, id, dto.duplicateId, ctx!.userId!, dto.fieldWinners);
  }

  @Post("crm/automation/sla-sweep")
  async slaSweep(): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.lifecycle.sweepSlaBreaches(ctx!.tenantId!);
  }

  @Post("crm/automation/assignment-rules")
  async createAssignmentRule(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("settings.roles.write");
    const dto = z
      .object({
        name: z.string().min(1),
        priority: z.number().int().optional(),
        criteria: z.object({
          projectId: z.string().uuid().optional(),
          source: z.string().optional(),
          segment: z.string().optional(),
          language: z.string().optional(),
        }),
        assignToUsers: z.array(z.string().uuid()).min(1),
        slaMinutes: z.number().int().positive().optional(),
        createFirstCallTask: z.boolean().optional(),
        notifyManager: z.boolean().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.createAssignmentRule(ctx!.tenantId!, dto);
  }

  @Get("crm/automation/assignment-rules")
  async listAssignmentRules(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.lifecycle.listAssignmentRules(ctx!.tenantId!);
  }

  @Get("crm/analytics/visit-funnel")
  async visitFunnel(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.pipeline.visitFunnel(ctx!.tenantId!);
  }

  // ── Lead assignment history (CRM-008/011) ───────────────────────────────

  @Post("crm/leads/:id/assign")
  async assignLead(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.assign");
    const dto = z
      .object({
        toUserId: z.string().uuid(),
        reason: z.enum(["rule", "manual", "reassign", "round_robin", "bulk"]).optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.pipeline.assignLead(ctx!.tenantId!, id, dto.toUserId, ctx!.userId!, dto.reason ?? "manual");
  }

  @Get("crm/leads/:id/assignment-history")
  async assignmentHistory(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.pipeline.assignmentHistory(ctx!.tenantId!, id);
  }

  // ── Site visit lifecycle (CRM-045..051) ─────────────────────────────────

  @Post("crm/site-visits/:id/confirm")
  async confirmVisit(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.pipeline.confirmVisit(ctx!.tenantId!, id);
  }

  @Post("crm/site-visits/:id/complete")
  async completeVisit(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ outcome: z.string().min(1), feedback: z.string().max(2000).optional() }).parse(body);
    const ctx = getRequestContext();
    return this.pipeline.completeVisit(ctx!.tenantId!, id, dto.outcome, dto.feedback);
  }

  @Post("crm/site-visits/:id/no-show")
  async markNoShow(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.pipeline.markNoShow(ctx!.tenantId!, id);
  }

  // ── Vishesh Engagement Engine (§28.18) ──────────────────────────────────

  @Post("crm/engagement/persons")
  async registerPerson(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        personType: z.enum(["lead", "customer", "contact", "partner", "employee"]),
        displayName: z.string().min(1),
        preferredLanguage: z.string().optional(),
        preferredChannel: z.enum(["whatsapp", "email", "sms", "call"]).optional(),
        consentStatus: z.enum(["granted", "revoked", "unknown"]).optional(),
        customerId: z.string().uuid().optional(),
        leadId: z.string().uuid().optional(),
        partnerId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.engagement.registerPerson(ctx!.tenantId!, dto);
  }

  @Post("crm/engagement/persons/:personId/consent")
  async setConsent(@Param("personId") personId: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ status: z.enum(["granted", "revoked"]) }).parse(body);
    const ctx = getRequestContext();
    return this.engagement.setConsent(ctx!.tenantId!, personId, dto.status);
  }

  @Post("crm/engagement/events")
  async addEvent(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        personId: z.string().uuid(),
        eventType: z.string().min(1),
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
        verified: z.boolean().optional(),
        visibility: z.enum(["public", "private"]).optional(),
        customEventKey: z.string().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.engagement.addEvent(ctx!.tenantId!, dto.personId, dto);
  }

  @Post("crm/engagement/events/:id/verify")
  async verifyEvent(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ verificationSource: z.string().min(1) }).parse(body);
    const ctx = getRequestContext();
    return this.engagement.verifyEvent(ctx!.tenantId!, id, dto.verificationSource);
  }

  @Get("crm/engagement/upcoming")
  async upcoming(@Query("days") days: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.engagement.upcoming(ctx!.tenantId!, Number(days ?? "7"));
  }

  @Post("crm/engagement/plan")
  async planEngagements(@Query("hour") hour?: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.engagement.planEngagements(ctx!.tenantId!, new Date(), hour ? Number(hour) : 11);
  }

  @Post("crm/engagement/executions/:id/approve")
  async approveExecution(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("workflow.approve");
    const ctx = getRequestContext();
    return this.engagement.approveExecution(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post("crm/engagement/executions/:id/suppress")
  async suppressExecution(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ reason: z.string().min(1) }).parse(body);
    const ctx = getRequestContext();
    return this.engagement.suppressExecution(ctx!.tenantId!, id, dto.reason);
  }

  @Post("crm/engagement/executions/:id/execute")
  async executeExecution(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.engagement.executeExecution(ctx!.tenantId!, id);
  }

  // ── Communications (CRM-2) ──────────────────────────────────────────────

  @Post("crm/comms/consent")
  async recordConsent(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        personId: z.string().uuid(),
        channel: z.enum(["whatsapp", "email", "sms", "call"]),
        status: z.enum(["granted", "revoked"]),
        source: z.string().min(1),
        evidence: z.string().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.comms.recordConsent(ctx!.tenantId!, dto);
  }

  @Post("crm/comms/send")
  async sendComm(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        leadId: z.string().uuid().optional(),
        personId: z.string().uuid().optional(),
        channel: z.enum(["email", "whatsapp", "sms"]),
        templateKey: z.string().optional(),
        body: z.string().min(1).max(4000),
        threadId: z.string().uuid().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.comms.send(ctx!.tenantId!, dto);
  }

  @Post("crm/comms/inbound")
  async receiveInbound(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const dto = z
      .object({
        channel: z.enum(["email", "whatsapp", "sms"]),
        fromPhone: z.string().optional(),
        fromEmail: z.string().email().optional(),
        body: z.string().min(1),
        providerMessageId: z.string().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.comms.receiveInbound(ctx!.tenantId!, dto);
  }

  @Get("crm/comms/threads/:threadId")
  async thread(@Param("threadId") threadId: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.comms.thread(ctx!.tenantId!, threadId);
  }

  // ── Analytics (CRM-4) ───────────────────────────────────────────────────

  @Get("crm/analytics/funnel")
  async funnel(@Query("projectId") projectId?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.analytics.funnel(ctx!.tenantId!, projectId);
  }

  @Get("crm/analytics/sources")
  async sources(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.analytics.sourceAnalytics(ctx!.tenantId!);
  }

  @Get("crm/analytics/reps")
  async reps(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.analytics.repAnalytics(ctx!.tenantId!);
  }

  // ── AI assist layer (CRM-6) ─────────────────────────────────────────────

  @Post("crm/ai/generate-recommendations")
  async generateRecommendations(): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.assist.generateRecommendations(ctx!.tenantId!);
  }

  @Get("crm/ai/recommendations")
  async listRecommendations(@Query("status") status?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.assist.listRecommendations(ctx!.tenantId!, status ?? "pending");
  }

  @Post("crm/ai/recommendations/:id/decide")
  async decideRecommendation(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z.object({ accept: z.boolean() }).parse(body);
    const ctx = getRequestContext();
    return this.assist.decideRecommendation(ctx!.tenantId!, id, dto.accept, ctx!.userId!);
  }

  @Post("crm/tasks")
  async createTask(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        leadId: z.string().uuid().optional(),
        oppNo: z.string().optional(),
        title: z.string().min(1),
        dueOn: z.string().datetime(),
        assigneeId: z.string().uuid().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.assist.createTask(ctx!.tenantId!, { ...dto, dueOn: new Date(dto.dueOn) });
  }

  @Get("crm/tasks")
  async listTasks(@Query("assigneeId") assigneeId?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.assist.listTasks(ctx!.tenantId!, assigneeId);
  }

  @Post("crm/tasks/:id/complete")
  async completeTask(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.assist.completeTask(ctx!.tenantId!, id);
  }

  @Get("crm/leads/:id/copilot-brief")
  async copilotBrief(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.assist.copilotBrief(ctx!.tenantId!, id);
  }

  // ── Customization & bulk (CRM-072/022/099/104) ──────────────────────────

  @Post("crm/views")
  async createView(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const dto = z
      .object({
        name: z.string().min(1),
        entityType: z.enum(["lead", "opportunity"]),
        filters: z.record(z.unknown()),
        columns: z.array(z.string()).optional(),
        isShared: z.boolean().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.config.createSavedView(ctx!.tenantId!, { ...dto, ownerId: ctx!.userId! });
  }

  @Get("crm/views")
  async listViews(@Query("entityType") entityType: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.config.listViews(ctx!.tenantId!, entityType ?? "lead", ctx!.userId!);
  }

  @Post("crm/custom-fields")
  async defineField(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("settings.roles.write");
    const dto = z
      .object({
        entityType: z.enum(["lead", "opportunity"]),
        key: z.string().min(1),
        label: z.string().min(1),
        fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.config.defineField(ctx!.tenantId!, dto);
  }

  @Post("crm/custom-fields/values")
  async setFieldValue(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        entityType: z.enum(["lead", "opportunity"]),
        entityId: z.string().uuid(),
        fieldKey: z.string().min(1),
        value: z.string(),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.config.setFieldValue(ctx!.tenantId!, dto);
  }

  @Get("crm/custom-fields/values")
  async getFieldValues(@Query("entityType") entityType: string, @Query("entityId") entityId: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.config.getFieldValues(ctx!.tenantId!, entityType, entityId);
  }

  @Post("crm/leads/bulk-assign")
  async bulkAssign(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.assign");
    const dto = z
      .object({ leadIds: z.array(z.string().uuid()).min(1).max(200), toUserId: z.string().uuid() })
      .parse(body);
    const ctx = getRequestContext();
    return this.config.bulkAssign(ctx!.tenantId!, dto.leadIds, dto.toUserId, ctx!.userId!);
  }

  @Get("crm/data-quality")
  async dataQuality(): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.config.dataQualityScan(ctx!.tenantId!);
  }

  // ── AI drafts (CRM-112/113) ─────────────────────────────────────────────

  @Post("crm/ai/drafts")
  async createDraft(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const dto = z
      .object({
        leadId: z.string().uuid(),
        channel: z.enum(["email", "whatsapp", "sms"]),
        intent: z.enum(["follow_up", "visit_reminder", "reactivation", "festival_greeting", "price_revision"]),
      })
      .parse(body);
    const ctx = getRequestContext();
    return this.drafts.draftCommunication(ctx!.tenantId!, dto);
  }

  @Get("crm/ai/drafts")
  async listDrafts(@Query("status") status?: string): Promise<unknown> {
    this.permissions.require("crm.lead.read");
    const ctx = getRequestContext();
    return this.drafts.listDrafts(ctx!.tenantId!, status ?? "draft");
  }

  @Post("crm/ai/drafts/:id/approve")
  async approveDraft(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.drafts.approveAndSend(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post("crm/ai/drafts/:id/discard")
  async discardDraft(@Param("id") id: string): Promise<unknown> {
    this.permissions.require("crm.lead.update");
    const ctx = getRequestContext();
    return this.drafts.discardDraft(ctx!.tenantId!, id);
  }
}
