import { Module } from "@nestjs/common";
import { OpsSupportService } from "./ops-support.service.js";
import { OpsSupportController } from "./ops-support.controller.js";

@Module({
  providers: [OpsSupportService],
  controllers: [OpsSupportController],
  exports: [OpsSupportService],
})
export class OpsSupportModule {}
