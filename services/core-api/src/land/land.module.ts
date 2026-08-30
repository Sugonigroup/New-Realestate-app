import { Module } from "@nestjs/common";
import { LandService } from "./land.service.js";
import { LandController } from "./land.controller.js";

@Module({
  providers: [LandService],
  controllers: [LandController],
  exports: [LandService],
})
export class LandModule {}
