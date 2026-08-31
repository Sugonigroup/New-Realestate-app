import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { NotificationService } from "./notification.service.js";
import { ConsoleNotificationAdapter, NOTIFY_PORT } from "./port.js";
import { NotifyController } from "./notify.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [NotificationService, { provide: NOTIFY_PORT, useValue: new ConsoleNotificationAdapter() }],
  controllers: [NotifyController],
  exports: [NotificationService],
})
export class NotifyModule {}
