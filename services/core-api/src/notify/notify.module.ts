import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service.js";
import { ConsoleNotificationAdapter } from "./port.js";
import { NotifyController } from "./notify.controller.js";

@Module({
  providers: [NotificationService, { provide: ConsoleNotificationAdapter, useValue: new ConsoleNotificationAdapter() }],
  controllers: [NotifyController],
  exports: [NotificationService],
})
export class NotifyModule {}
