import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/** Security headers on every response (OWASP secure-headers baseline, 26 §2). */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  }
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB — documents upload via presigned S3, not inline

/** Rejects oversized payloads early (uploads go through S3 presigned flows). */
@Injectable()
export class BodyLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const len = Number(req.headers["content-length"] ?? 0);
    if (len > MAX_BODY_BYTES) {
      res.status(413).setHeader("Content-Type", "application/problem+json").json({
        type: "https://buildos.dev/problems/payload-too-large",
        title: "Payload Too Large",
        status: 413,
        detail: `body exceeds ${MAX_BODY_BYTES} bytes — use the document upload flow`,
      });
      return;
    }
    next();
  }
}
