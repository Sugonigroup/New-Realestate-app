import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { redactObject } from "./log-redaction.js";
import { SlidingWindowLimiter } from "./rate-limit.js";

/**
 * Request logging with PII redaction (03 §7): path, method, status, duration —
 * query strings pass through redaction (they may carry phone/email).
 */
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on("finish", () => {
      const line = redactObject({
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
      console.log(JSON.stringify(line));
    });
    next();
  }
}

/** Per-user/per-IP sliding-window limiter wired into the chain (03 §1 limits). */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly limiter: SlidingWindowLimiter;
  private readonly authenticated: SlidingWindowLimiter;

  constructor() {
    this.limiter = new SlidingWindowLimiter(30, 60_000); // portals/IP: 30/min
    this.authenticated = new SlidingWindowLimiter(100, 60_000); // ERP: 100/min
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const auth = req.header("authorization");
    const isErp = !req.originalUrl.startsWith("/v1/portal");
    const key = auth ? `u:${Buffer.from(auth).toString("base64url").slice(0, 32)}` : `ip:${req.ip}`;
    const limiter = isErp && auth ? this.authenticated : this.limiter;
    const result = limiter.check(key);
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSec));
      res.status(429).setHeader("Content-Type", "application/problem+json").json({
        type: "https://buildos.dev/problems/rate-limited",
        title: "Too Many Requests",
        status: 429,
        detail: `retry after ${result.retryAfterSec}s`,
      });
      return;
    }
    next();
  }
}
