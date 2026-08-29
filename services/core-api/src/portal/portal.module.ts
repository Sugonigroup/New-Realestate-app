import { Module } from "@nestjs/common";
import { PortalService } from "./portal.service.js";
import { PortalController } from "./portal.controller.js";

@Module({ providers: [PortalService], controllers: [PortalController], exports: [PortalService] })
export class PortalModule {}
