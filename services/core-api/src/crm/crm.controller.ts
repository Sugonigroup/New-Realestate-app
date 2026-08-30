import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { CrmService, type RoutingContext } from "./crm.service.js";

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
}
