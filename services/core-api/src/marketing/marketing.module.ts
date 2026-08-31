import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { MarketingService } from "./marketing.service.js";
import { MarketingController } from "./marketing.controller.js";

@Module({ imports: [PermissionsModule], providers: [MarketingService], controllers: [MarketingController], exports: [MarketingService] })
export class MarketingModule {}
