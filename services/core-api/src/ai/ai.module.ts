import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AiController } from "./ai.controller.js";

@Module({ imports: [PrismaModule, PermissionsModule], controllers: [AiController] })
export class AiModule {}
