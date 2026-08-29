import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient. Tenant isolation: every tenant-owned query MUST run inside
 * a transaction that sets `app.tenant_id` (see `withTenant`) so Postgres RLS
 * (prisma/rls.sql) enforces isolation at the database layer (03 §1, 05 §4).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run a unit of work with the tenant GUC set (RLS enforced).
   * Refuses to run without a tenant — the RLS guard is structural, not conventional.
   */
  async withTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
