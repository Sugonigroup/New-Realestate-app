import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PermissionsService } from "./permissions/permissions.service.js";
import { getRequestContext } from "./common/request-context.js";

@ApiTags("dev")
@Controller()
export class AppController {
  constructor(private readonly permissions: PermissionsService) {}

  /**
   * Authorization smoke endpoint (WP-0D acceptance aid): evaluates a permission
   * string for the caller resolved from the dev token/header. Removed once the
   * real module endpoints exist.
   */
  @Get("authz/check")
  check(@Query("permission") permission: string): unknown {
    const decision = this.permissions.require(permission ?? "**");
    return { permission, decision, correlationId: getRequestContext()?.correlationId };
  }
}
