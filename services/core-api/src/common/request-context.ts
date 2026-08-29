import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  roleCodes?: string[];
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function requireTenantId(): string {
  const ctx = als.getStore();
  if (!ctx?.tenantId) {
    throw new Error("tenant context missing — RLS guard would refuse this query");
  }
  return ctx.tenantId;
}

export const requestContextSymbol = als;
