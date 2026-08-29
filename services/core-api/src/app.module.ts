import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module.js";
import { HealthModule } from "./health/health.module.js";
import { PermissionsModule } from "./permissions/permissions.module.js";
import { RequestContextModule } from "./common/request-context.module.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { TenantContextMiddleware } from "./common/tenant-context.middleware.js";
import { ProblemJsonExceptionFilter } from "./common/problem-exception.filter.js";
import { AppController } from "./app.controller.js";

@Module({
  imports: [RequestContextModule, PrismaModule, HealthModule, PermissionsModule],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: correlation first, then tenant resolution into the request context.
    consumer.apply(RequestContextMiddleware, TenantContextMiddleware).forRoutes("*");
  }
}
