import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "./request-context.js";

/** Establishes the correlation-id-backed request context for every request (03 §7). */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.header("x-correlation-id") as string | undefined) ?? randomUUID();
    res.setHeader("x-correlation-id", correlationId);
    runWithRequestContext({ correlationId }, () => next());
  }
}
