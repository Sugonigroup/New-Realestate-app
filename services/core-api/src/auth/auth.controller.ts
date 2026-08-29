import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service.js";

const loginDto = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().regex(/^\d{6}$/).optional(),
});

const refreshDto = z.object({ refreshToken: z.string().min(10) });

/** httpOnly cookie options (WP-0D): tokens are readable by the API, not by JS. */
const COOKIE_OPTS = { httpOnly: true, sameSite: "strict" as const, path: "/" };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    const dto = loginDto.parse(body);
    const result = await this.auth.login(dto.tenantSlug, dto.email, dto.password, dto.mfaCode);
    if ("mfaRequired" in result) return result;
    res.cookie("access_token", result.accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60_000 });
    res.cookie("refresh_token", result.refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60_000 });
    return result;
  }

  @Post("refresh")
  async refresh(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    const { refreshToken } = refreshDto.parse(body);
    const result = await this.auth.refresh(refreshToken);
    res.cookie("access_token", result.accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60_000 });
    res.cookie("refresh_token", result.refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60_000 });
    return result;
  }

  @Post("logout")
  async logout(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    const { refreshToken } = refreshDto.parse(body);
    await this.auth.logout(refreshToken);
    res.clearCookie("access_token", COOKIE_OPTS);
    res.clearCookie("refresh_token", COOKIE_OPTS);
    return { ok: true };
  }
}
