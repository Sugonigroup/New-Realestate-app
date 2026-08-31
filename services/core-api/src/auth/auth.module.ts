import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";

@Module({ imports: [PermissionsModule], providers: [AuthService], controllers: [AuthController], exports: [AuthService] })
export class AuthModule {}
