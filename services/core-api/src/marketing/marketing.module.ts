import { Module } from "@nestjs/common";
import { MarketingService } from "./marketing.service.js";
import { MarketingController } from "./marketing.controller.js";

@Module({ providers: [MarketingService], controllers: [MarketingController], exports: [MarketingService] })
export class MarketingModule {}
