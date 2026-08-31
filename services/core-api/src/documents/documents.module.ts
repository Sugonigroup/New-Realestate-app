import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { DocumentsService, STORAGE_PORT } from "./documents.service.js";
import { DocumentsController } from "./documents.controller.js";
import { LocalFsAdapter, type StoragePort } from "./storage.js";

@Module({
  imports: [PermissionsModule],
  providers: [DocumentsService,
    { provide: STORAGE_PORT, useFactory: (): StoragePort => new LocalFsAdapter(process.env.DOC_STORAGE_DIR ?? "./var/documents") },
  ],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
