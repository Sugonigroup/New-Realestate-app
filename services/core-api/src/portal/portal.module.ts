import { Module } from "@nestjs/common";
import { PortalService } from "./portal.service.js";
import { PartnerPortalController } from "./partner-portal.controller.js";
import { PortalController } from "./portal.controller.js";

@Module({ providers: [PortalService], controllers: [PortalController, PartnerPortalController], exports: [PortalService] })
export class PortalModule {}
