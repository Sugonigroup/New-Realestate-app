import { Injectable, NotFoundException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { computePayroll, type PayrollResult } from "./payroll.js";
import { evaluateAttendance, aggregateMuster, type GeoFence, type AttendanceCheck } from "./attendance.js";

/** HR service (Phase 4/5): attendance, payroll runs, muster aggregation. */
@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  /** Geo-attendance check with anomaly detection. */
  async checkIn(tenantId: string, input: {
    employeeId: string;
    deviceId: string;
    geoLat: number;
    geoLng: number;
    fenceCenter: { lat: number; lng: number };
    fenceRadiusMeters: number;
  }): Promise<unknown> {
    const check: AttendanceCheck = {
      userId: input.employeeId,
      deviceId: input.deviceId,
      at: { lat: input.geoLat, lng: input.geoLng },
      timestamp: new Date(),
    };
    const fence: GeoFence = { center: input.fenceCenter, radiusMeters: input.fenceRadiusMeters };

    const recent = (await this.prisma.attendanceRecord.findMany({
      where: { tenantId, date: new Date(new Date().toDateString()) },
    })) as unknown as Array<{ geoLat: unknown; geoLng: unknown; employeeId: string }>;

    const recentChecks = recent.map((r) => ({
      userId: r.employeeId,
      deviceId: "unknown",
      at: { lat: Number(r.geoLat ?? 0), lng: Number(r.geoLng ?? 0) },
      timestamp: new Date(),
    }));

    const evaluation = evaluateAttendance(check, fence, recentChecks);
    const record = await this.prisma.attendanceRecord.create({
      data: {
        tenantId,
        employeeId: input.employeeId,
        date: new Date(new Date().toDateString()),
        checkIn: new Date(),
        geoLat: input.geoLat,
        geoLng: input.geoLng,
        status: evaluation.anomalies.length > 0 ? "anomaly" : "present",
        anomalies: evaluation.anomalies as unknown as object,
      },
    });
    return { recordId: record.id, ...evaluation };
  }

  /** Payroll run: compute all active employees for a period (dual-control: draft→approve). */
  async computePayrollRun(tenantId: string, period: string, stateCode: string, daysInMonth: number, initiatedBy: string): Promise<unknown> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: "active" },
    });
    const results: Array<{ employeeId: string; name: string; net: PayrollResult }> = [];
    for (const emp of employees) {
      const result = computePayroll({
        structure: {
          basicMonthly: emp.basicMonthlyPaise,
          hraMonthly: emp.hraMonthlyPaise,
          specialMonthly: emp.specialMonthlyPaise,
        },
        daysInMonth,
        paidDays: daysInMonth, // WP-4F: LOP from attendance data
        stateCode: stateCode as "KA" | "MH" | "TN" | "TG" | "UP",
      });
      results.push({ employeeId: emp.id, name: emp.name, net: result });
    }
    const totals = {
      grossPaise: results.reduce((s, r) => s + r.net.earnedGrossPaise, 0n).toString(),
      pfPaise: results.reduce((s, r) => s + r.net.pfEmployeePaise, 0n).toString(),
      tdsPaise: results.reduce((s, r) => s + r.net.tdsPaise, 0n).toString(),
      netPaise: results.reduce((s, r) => s + r.net.netPaise, 0n).toString(),
    };
    const run = await this.prisma.payrollRun.upsert({
      where: { tenantId_period_stateCode: { tenantId, period, stateCode } },
      update: { totals: totals as object, initiatedBy },
      create: { tenantId, period, stateCode, totals: totals as object, initiatedBy },
    });
    return { runId: run.id, period, employees: results.length, totals };
  }

  /** Contractor muster from site reports. */
  async muster(tenantId: string, projectId: string): Promise<unknown> {
    const rows = (await this.prisma.attendanceRecord.findMany({
      where: { tenantId, status: { in: ["present", "anomaly"] } },
    })) as unknown as Array<{ date: Date; employeeId: string }>;
    const employees = await this.prisma.employee.findMany({ where: { tenantId } });
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const days: Array<{ date: Date; contractorId: string; trade: string; headcount: number }> = [];
    for (const row of rows) {
      const emp = empMap.get(row.employeeId);
      if (emp?.contractorId) {
        days.push({ date: row.date, contractorId: emp.contractorId, trade: emp.role, headcount: 1 });
      }
    }
    return [...aggregateMuster(days).values()];
  }
}
