import { Module } from "@nestjs/common";
import { HrService } from "./hr.service.js";
import { HrController } from "./hr.controller.js";

@Module({ providers: [HrService], controllers: [HrController], exports: [HrService] })
export class HrModule {}
