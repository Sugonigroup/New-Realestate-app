import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Assets / EAM & Maintenance CMMS service (P2):
 * - Asset registry with Straight-Line Method (SLM) depreciation calculation
 * - Preventive maintenance plans (time-based & meter/usage-based)
 * - Work order lifecycle (open → in_progress → completed with downtime tracking)
 * - Spare part consumption per work order
 * - Reliability KPIs: Mean Time Between Failures (MTBF) and Mean Time To Repair (MTTR)
 */

export interface MaintenancePlanInput {
  title: string;
  intervalDays?: number;
  meterInterval?: number;
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Asset Registry ──────────────────────────────────────────────────────

  async createAsset(tenantId: string, input: {
    assetTag: string;
    name: string;
    category: string;
    projectId?: string;
    location?: string;
    purchaseDate: Date;
    purchaseValPaise: bigint;
    salvageValPaise?: bigint;
    usefulLifeMonths: number;
    meterUnit?: string;
  }) {
    if (input.usefulLifeMonths <= 0) throw new BadRequestException("usefulLifeMonths must be > 0");
    const existing = await this.prisma.asset.findFirst({ where: { tenantId, assetTag: input.assetTag } });
    if (existing) throw new ConflictException(`asset tag ${input.assetTag} already exists`);
    return this.prisma.asset.create({
      data: {
        tenantId,
        assetTag: input.assetTag,
        name: input.name,
        category: input.category,
        projectId: input.projectId,
        location: input.location,
        purchaseDate: input.purchaseDate,
        purchaseValPaise: input.purchaseValPaise,
        salvageValPaise: input.salvageValPaise ?? 0n,
        usefulLifeMonths: input.usefulLifeMonths,
        meterUnit: input.meterUnit,
        status: "commissioned",
      },
    });
  }

  /** Straight-Line Method (SLM) monthly depreciation & net book value. */
  async depreciationSchedule(tenantId: string, assetId: string, asOfDate: Date = new Date()) {
    const asset = await this.prisma.asset.findFirst({ where: { tenantId, id: assetId } });
    if (!asset) throw new NotFoundException(`asset ${assetId} not found`);

    const depreciableCost = asset.purchaseValPaise - asset.salvageValPaise;
    const monthlyDepreciation = depreciableCost / BigInt(asset.usefulLifeMonths);

    // Calculate elapsed months since purchase
    const pDate = new Date(asset.purchaseDate);
    const monthsElapsed = Math.max(
      0,
      (asOfDate.getFullYear() - pDate.getFullYear()) * 12 + (asOfDate.getMonth() - pDate.getMonth()),
    );
    const cappedMonths = Math.min(monthsElapsed, asset.usefulLifeMonths);

    const accumulatedDepreciation = monthlyDepreciation * BigInt(cappedMonths);
    const netBookValuePaise = asset.purchaseValPaise - accumulatedDepreciation;

    return {
      assetId: asset.id,
      assetTag: asset.assetTag,
      purchaseValPaise: asset.purchaseValPaise,
      salvageValPaise: asset.salvageValPaise,
      usefulLifeMonths: asset.usefulLifeMonths,
      monthlyDepreciationPaise: monthlyDepreciation,
      monthsElapsed: cappedMonths,
      accumulatedDepreciationPaise: accumulatedDepreciation,
      netBookValuePaise,
      isFullyDepreciated: cappedMonths >= asset.usefulLifeMonths,
    };
  }

  // ── Meter Readings & PM Triggering ──────────────────────────────────────

  async recordMeterReading(tenantId: string, assetId: string, meterVal: number) {
    const asset = await this.prisma.asset.findFirst({
      where: { tenantId, id: assetId },
      include: { plans: true },
    });
    if (!asset) throw new NotFoundException(`asset ${assetId} not found`);
    if (meterVal < Number(asset.currentMeterVal)) {
      throw new BadRequestException(`meter reading ${meterVal} cannot regress from current ${asset.currentMeterVal}`);
    }

    const updated = await this.prisma.asset.update({
      where: { id: asset.id },
      data: { currentMeterVal: meterVal },
    });

    // Check usage-based PM plans to see if threshold exceeded
    const triggeredPlans = [];
    for (const plan of asset.plans) {
      if (plan.status !== "active" || !plan.meterInterval) continue;
      const lastMeter = plan.lastRunMeter ? Number(plan.lastRunMeter) : 0;
      if (meterVal - lastMeter >= Number(plan.meterInterval)) {
        triggeredPlans.push(plan);
      }
    }

    return { asset: updated, PMsTriggeredCount: triggeredPlans.length, triggeredPlans };
  }

  // ── Maintenance Plans ───────────────────────────────────────────────────

  async createPlan(tenantId: string, assetId: string, input: MaintenancePlanInput) {
    const asset = await this.prisma.asset.findFirst({ where: { tenantId, id: assetId } });
    if (!asset) throw new NotFoundException(`asset ${assetId} not found`);
    if (!input.intervalDays && !input.meterInterval) {
      throw new BadRequestException("plan must specify either intervalDays or meterInterval");
    }
    return this.prisma.maintenancePlan.create({
      data: {
        tenantId,
        assetId: asset.id,
        title: input.title,
        intervalDays: input.intervalDays,
        meterInterval: input.meterInterval,
        status: "active",
      },
    });
  }

  // ── Work Orders ─────────────────────────────────────────────────────────

  async createWorkOrder(tenantId: string, input: {
    woNo: string;
    assetId: string;
    planId?: string;
    type: "preventive" | "corrective" | "breakdown" | "inspection";
    description: string;
    priority?: "low" | "medium" | "high" | "critical";
    assignedTo?: string;
    breakdownAt?: Date;
  }) {
    const asset = await this.prisma.asset.findFirst({ where: { tenantId, id: input.assetId } });
    if (!asset) throw new NotFoundException(`asset ${input.assetId} not found`);
    const existing = await this.prisma.workOrder.findFirst({ where: { tenantId, woNo: input.woNo } });
    if (existing) throw new ConflictException(`work order ${input.woNo} already exists`);

    const wo = await this.prisma.workOrder.create({
      data: {
        tenantId,
        woNo: input.woNo,
        assetId: asset.id,
        planId: input.planId,
        type: input.type,
        description: input.description,
        priority: input.priority ?? "medium",
        assignedTo: input.assignedTo,
        breakdownAt: input.type === "breakdown" ? input.breakdownAt ?? new Date() : undefined,
        status: "open",
      },
    });

    if (input.type === "breakdown") {
      await this.prisma.asset.update({ where: { id: asset.id }, data: { status: "in_maintenance" } });
    }

    return wo;
  }

  async completeWorkOrder(tenantId: string, woNo: string, input: {
    completedAt: Date;
    spares?: Array<{ materialId: string; qty: number; unitCostPaise: bigint }>;
  }) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { tenantId, woNo },
      include: { asset: true, plan: true },
    });
    if (!wo) throw new NotFoundException(`work order ${woNo} not found`);
    if (wo.status === "completed") throw new ConflictException(`work order ${woNo} is already completed`);

    let totalSpareCostPaise = 0n;
    if (input.spares && input.spares.length > 0) {
      for (const sp of input.spares) {
        const cost = BigInt(Math.round(sp.qty)) * sp.unitCostPaise;
        totalSpareCostPaise += cost;
        await this.prisma.spareUsage.create({
          data: {
            tenantId,
            workOrderId: wo.id,
            materialId: sp.materialId,
            qty: sp.qty,
            unitCostPaise: sp.unitCostPaise,
          },
        });
      }
    }

    const updatedWo = await this.prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        status: "completed",
        completedAt: input.completedAt,
        costPaise: totalSpareCostPaise,
      },
    });

    // Update PM plan last run markers if WO came from a plan
    if (wo.planId) {
      await this.prisma.maintenancePlan.update({
        where: { id: wo.planId },
        data: { lastRunAt: input.completedAt, lastRunMeter: wo.asset.currentMeterVal },
      });
    }

    // Restore asset status to in_service if it was in maintenance
    if (wo.asset.status === "in_maintenance") {
      await this.prisma.asset.update({ where: { id: wo.asset.id }, data: { status: "in_service" } });
    }

    return updatedWo;
  }

  // ── Reliability Metrics (MTBF & MTTR) ───────────────────────────────────

  /** Mean Time Between Failures (MTBF in hours) & Mean Time To Repair (MTTR in hours). */
  async reliabilityMetrics(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { tenantId, id: assetId } });
    if (!asset) throw new NotFoundException(`asset ${assetId} not found`);

    const breakdownWos = await this.prisma.workOrder.findMany({
      where: { tenantId, assetId: asset.id, type: "breakdown", status: "completed" },
    });

    if (breakdownWos.length === 0) {
      return { assetId: asset.id, assetTag: asset.assetTag, failureCount: 0, mtbfHours: null, mttrHours: null };
    }

    // Calculate total repair downtime in hours
    let totalDowntimeHours = 0;
    for (const wo of breakdownWos) {
      const start = wo.breakdownAt ?? wo.startedAt ?? wo.createdAt;
      if (wo.completedAt && start) {
        const hours = (wo.completedAt.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalDowntimeHours += Math.max(0, hours);
      }
    }
    const mttrHours = Math.round((totalDowntimeHours / breakdownWos.length) * 100) / 100;

    // Operating hours calculation (meter value if hours, or time since purchase)
    const totalOperatingHours = asset.meterUnit === "hours"
      ? Number(asset.currentMeterVal)
      : (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60);

    const netOperatingHours = Math.max(0, totalOperatingHours - totalDowntimeHours);
    const mtbfHours = Math.round((netOperatingHours / breakdownWos.length) * 100) / 100;

    return {
      assetId: asset.id,
      assetTag: asset.assetTag,
      failureCount: breakdownWos.length,
      totalDowntimeHours,
      mttrHours,
      mtbfHours,
    };
  }
}
