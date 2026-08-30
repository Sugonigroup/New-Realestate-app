import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AiController } from "./ai.controller.js";

@Module({ imports: [PrismaModule], controllers: [AiController] })
export class AiModule {}
