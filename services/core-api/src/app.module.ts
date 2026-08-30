import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module.js";
import { HealthModule } from "./health/health.module.js";
import { PermissionsModule } from "./permissions/permissions.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { WorkflowModule } from "./workflow/workflow.module.js";
import { NotifyModule } from "./notify/notify.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { CrmModule } from "./crm/crm.module.js";
import { SalesModule } from "./sales/sales.module.js";
import { PortalModule } from "./portal/portal.module.js";
import { AiModule } from "./ai/ai.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ProcurementModule } from "./procurement/procurement.module.js";
import { ContractsModule } from "./contracts/contracts.module.js";
import { BudgetingModule } from "./budgeting/budgeting.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { MarketingModule } from "./marketing/marketing.module.js";
import { HrModule } from "./hr/hr.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { RequestContextModule } from "./common/request-context.module.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { TenantContextMiddleware } from "./common/tenant-context.middleware.js";
import { ProblemJsonExceptionFilter } from "./common/problem-exception.filter.js";
import { SecurityHeadersMiddleware, BodyLimitMiddleware } from "./common/security.middleware.js";
import { AppController } from "./app.controller.js";

@Module({
  imports: [RequestContextModule, PrismaModule, HealthModule, PermissionsModule, AuthModule, WorkflowModule, NotifyModule, DocumentsModule, CrmModule, SalesModule, PortalModule, FinanceModule, ProjectsModule, ProcurementModule, ContractsModule, BudgetingModule, AssetsModule, ComplianceModule, AdminModule, AiModule, MarketingModule, HrModule],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: headers/body-limit → correlation → tenant resolution.
    consumer
      .apply(SecurityHeadersMiddleware, BodyLimitMiddleware, RequestContextMiddleware, TenantContextMiddleware)
      .forRoutes("*");
  }
}
