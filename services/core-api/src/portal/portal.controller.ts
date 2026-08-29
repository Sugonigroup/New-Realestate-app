import { Body, Controller, Get, Post } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PortalService } from "./portal.service.js";

const sendOtpDto = z.object({ phone: z.string().regex(/^\+91\d{10}$/) });
const verifyDto = z.object({ phone: z.string().regex(/^\+91\d{10}$/), code: z.string().regex(/^\d{6}$/) });
const consentDto = z.object({
  channel: z.enum(["whatsapp", "email", "sms"]),
  purpose: z.enum(["transactional", "promotional"]),
  granted: z.boolean(),
});

/** Customer-portal guard: portal JWTs carry roles=['customer'] and sub=phone. */
export function customerPhone(): string {
  const ctx = getRequestContext();
  if (!ctx?.userId || !ctx.roleCodes?.includes("customer")) {
    throw new UnauthorizedException({ title: "Portal authentication required" });
  }
  return ctx.userId;
}

@ApiTags("portal")
@Controller("portal")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Post("otp/send")
  async sendOtp(@Body() body: unknown): Promise<unknown> {
    const { phone } = sendOtpDto.parse(body);
    const ctx = getRequestContext();
    return this.portal.sendOtp(ctx!.tenantId!, phone);
  }

  @Post("otp/verify")
  async verify(@Body() body: unknown): Promise<unknown> {
    const { phone, code } = verifyDto.parse(body);
    const ctx = getRequestContext();
    return this.portal.verifyOtp(ctx!.tenantId!, phone, code);
  }

  @Get("home")
  home(): unknown {
    const phone = customerPhone();
    const ctx = getRequestContext();
    return this.portal.home(ctx!.tenantId!, phone);
  }

  @Get("payments")
  payments(): unknown {
    const phone = customerPhone();
    const ctx = getRequestContext();
    return this.portal.payments(ctx!.tenantId!, phone);
  }

  @Get("consents")
  consents(): unknown {
    const phone = customerPhone();
    const ctx = getRequestContext();
    return this.portal.consents(ctx!.tenantId!, phone);
  }

  @Post("consents")
  setConsent(@Body() body: unknown): unknown {
    const phone = customerPhone();
    const ctx = getRequestContext();
    const dto = consentDto.parse(body);
    return this.portal.setConsent(ctx!.tenantId!, phone, dto.channel, dto.purpose, dto.granted);
  }
}
