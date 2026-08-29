import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "./auth.service.js";

const loginDto = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(@Body() body: unknown): Promise<{ accessToken: string; refreshToken: string }> {
    const dto = loginDto.parse(body);
    return this.auth.login(dto.tenantSlug, dto.email, dto.password);
  }

  @Post("refresh")
  async refresh(@Body() body: unknown): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(body);
    return this.auth.refresh(refreshToken);
  }

  @Post("logout")
  async logout(@Body() body: unknown): Promise<{ ok: true }> {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(body);
    await this.auth.logout(refreshToken);
    return { ok: true };
  }
}
