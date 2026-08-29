import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { NotificationService } from "./notification.service.js";
import type { JourneyDefinition } from "./journey.js";

const sendDto = z.object({
  channel: z.enum(["whatsapp", "email", "sms"]),
  templateKey: z.string().min(1),
  toRef: z.string().min(1),
  toAddress: z.string().min(3),
  purpose: z.enum(["transactional", "promotional"]),
  severity: z.enum(["S0", "S1", "S2", "S3"]).optional(),
  vars: z.record(z.union([z.string(), z.number()])).optional(),
});

const journeyDto = z.object({
  key: z.string().min(1),
  definition: z.object({ steps: z.array(z.unknown()) }),
});

@ApiTags("notify")
@Controller()
export class NotifyController {
  constructor(
    private readonly notify: NotificationService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("notifications/send")
  async send(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("notify.send");
    const dto = sendDto.parse(body);
    const ctx = getRequestContext();
    return this.notify.send({
      tenantId: ctx!.tenantId!,
      ...dto,
      vars: dto.vars as Record<string, string | number> | undefined,
      correlationId: ctx?.correlationId,
    });
  }

  @Get("notifications/messages")
  async messages(@Query("toRef") toRef: string): Promise<unknown> {
    this.permissions.require("notify.log.read");
    const ctx = getRequestContext();
    return this.notify.listMessages(ctx!.tenantId!, toRef);
  }

  @Post("journeys")
  async register(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("notify.journey.admin");
    const dto = journeyDto.parse(body) as { key: string; definition: JourneyDefinition };
    const ctx = getRequestContext();
    const id = await this.notify.registerJourney(ctx!.tenantId!, dto.key, dto.definition);
    return { id, key: dto.key };
  }

  @Post("journeys/:key/trigger")
  async trigger(@Param("key") key: string, @Body() body: unknown): Promise<unknown> {
    this.permissions.require("notify.send");
    const { personRef, vars } = z
      .object({ personRef: z.string().min(1), vars: z.record(z.string()).optional() })
      .parse(body);
    const ctx = getRequestContext();
    return this.notify.triggerJourney(ctx!.tenantId!, key, personRef, vars ?? {}, ctx?.correlationId);
  }
}
