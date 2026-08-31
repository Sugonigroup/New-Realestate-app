import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  // rawBody: needed for webhook HMAC verification (exact bytes signed)
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  app.setGlobalPrefix("v1");

  // Browser apps (erp-web :3000, portals) call this API cross-origin in dev/staging.
  // CORS_ORIGINS is a comma-separated allowlist; unset = reflect origin (dev only).
  const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true, credentials: true });

  const openapi = new DocumentBuilder()
    .setTitle("BuildOS Core API")
    .setDescription("AI-operated construction ERP — system of record (Phase 0 skeleton)")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("v1/docs", app, SwaggerModule.createDocument(app, openapi));

  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`core-api listening on :${port} (OpenAPI at /v1/docs)`);
}

void bootstrap();
