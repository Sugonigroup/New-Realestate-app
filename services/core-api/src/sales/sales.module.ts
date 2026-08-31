import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { SalesController } from "./sales.controller.js";

@Module({ imports: [PermissionsModule], controllers: [SalesController] })
export class SalesModule {}
