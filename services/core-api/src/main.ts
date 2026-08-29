import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.setGlobalPrefix("v1");

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
