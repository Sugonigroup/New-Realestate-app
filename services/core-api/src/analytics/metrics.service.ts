import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * BI metric registry & snapshots (BI-01):
 * - Metric definitions: code, domain, unit, direction (up_is_good / down_is_good)
 * - Snapshots: one value per metric per period with optional dimensions (projectId, entity)
 * - Trend: ordered history for a metric, delta vs previous period
 */

export interface RecordMetricInput {
  code: string;
  period: string;
  valueNum: number;
  dimensions?: Record<string, string>;
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerMetric(tenantId: string, input: {
    code: string;
    name: string;
    domain: "sales" | "finance" | "projects" | "safety" | "hr";
    unit: "paise" | "pct" | "count" | "days";
    direction?: "up_is_good" | "down_is_good";
  }) {
    const existing = await this.prisma.metricDefinition.findFirst({ where: { tenantId, code: input.code } });
    if (existing) throw new ConflictException(`metric ${input.code} already registered`);

    return this.prisma.metricDefinition.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        domain: input.domain,
        unit: input.unit,
        direction: input.direction ?? "up_is_good",
      },
    });
  }

  /** Upsert a snapshot value for a metric+period (idempotent re-recording). */
  async recordSnapshot(tenantId: string, input: RecordMetricInput) {
    const metric = await this.prisma.metricDefinition.findFirst({ where: { tenantId, code: input.code } });
    if (!metric) throw new NotFoundException(`metric ${input.code} not registered`);

    return this.prisma.metricSnapshot.upsert({
      where: { tenantId_metricCode_period: { tenantId, metricCode: input.code, period: input.period } },
      create: {
        tenantId,
        metricCode: input.code,
        period: input.period,
        valueNum: input.valueNum,
        dimensions: (input.dimensions as object) ?? undefined,
      },
      update: {
        valueNum: input.valueNum,
        dimensions: (input.dimensions as object) ?? undefined,
      },
    });
  }

  /** Latest value + delta vs previous period and health tone per direction. */
  async latest(tenantId: string, code: string) {
    const metric = await this.prisma.metricDefinition.findFirst({ where: { tenantId, code } });
    if (!metric) throw new NotFoundException(`metric ${code} not registered`);

    const snaps = await this.prisma.metricSnapshot.findMany({
      where: { tenantId, metricCode: code },
      orderBy: { period: "desc" },
      take: 2,
    });
    if (snaps.length === 0) throw new NotFoundException(`no snapshots recorded for ${code}`);

    const latest = snaps[0]!;
    const prev = snaps[1];
    const valueNum = Number(latest.valueNum);
    const deltaPct = prev ? Math.round(((valueNum - Number(prev.valueNum)) / Number(prev.valueNum)) * 10000) / 100 : null;

    let tone: "GOOD" | "BAD" | "NEUTRAL" = "NEUTRAL";
    if (deltaPct !== null && deltaPct !== 0) {
      const improved = deltaPct > 0;
      tone = (metric.direction === "up_is_good") === improved ? "GOOD" : "BAD";
    }

    return {
      metricCode: code,
      name: metric.name,
      unit: metric.unit,
      period: latest.period,
      valueNum,
      deltaPct,
      tone,
      dimensions: latest.dimensions,
    };
  }
}
