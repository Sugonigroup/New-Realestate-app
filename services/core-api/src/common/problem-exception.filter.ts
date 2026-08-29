import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { getRequestContext } from "./request-context.js";

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown;
  correlationId?: string;
}

/** RFC 7807 problem+json for every error response (03 §1 conventions). */
@Catch()
export class ProblemJsonExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const problem: ProblemDetails = this.toProblem(exception);
    res.status(problem.status).setHeader("Content-Type", "application/problem+json").json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    const correlationId = getRequestContext()?.correlationId;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as string | Record<string, unknown>;
      const errors = typeof body === "object" && body !== null ? body["errors"] ?? body["message"] : undefined;
      return {
        type: `https://buildos.dev/problems/${HttpStatus[status]?.toLowerCase() ?? "http"}`,
        title: exception.message,
        status,
        detail: typeof body === "string" ? body : undefined,
        errors,
        correlationId,
      };
    }
    // Unexpected error: log with stack (redaction middleware lands in WP-0D), never leak internals.
    console.error("[unhandled]", exception);
    return {
      type: "https://buildos.dev/problems/internal",
      title: "Internal Server Error",
      status: 500,
      correlationId,
    };
  }
}
