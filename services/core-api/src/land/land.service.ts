import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Land Acquisition & Joint Development Agreement (JDA) service (LAND-01):
 * - Land parcel registry with survey number and legal title verification status
 * - JDA revenue-share / area-share split calculation between Landowner and Developer
 */

@Injectable()
export class LandService {
  constructor(private readonly prisma: PrismaService) {}

  async registerLandParcel(tenantId: string, input: {
    parcelNo: string;
    surveyNo: string;
    location: string;
    areaSqFt: number;
    purchaseValPaise: bigint;
    titleStatus?: "clear" | "encumbered" | "litigation";
    legalOpinionBy?: string;
  }) {
    if (input.areaSqFt <= 0) throw new BadRequestException("areaSqFt must be > 0");
    const existing = await this.prisma.landParcel.findFirst({ where: { tenantId, parcelNo: input.parcelNo } });
    if (existing) throw new ConflictException(`land parcel ${input.parcelNo} already exists`);

    return this.prisma.landParcel.create({
      data: {
        tenantId,
        parcelNo: input.parcelNo,
        surveyNo: input.surveyNo,
        location: input.location,
        areaSqFt: input.areaSqFt,
        purchaseValPaise: input.purchaseValPaise,
        titleStatus: input.titleStatus ?? "clear",
        legalOpinionBy: input.legalOpinionBy,
      },
    });
  }

  async listParcels(tenantId: string) {
    return this.prisma.landParcel.findMany({
      where: { tenantId },
      orderBy: { parcelNo: "asc" },
      take: 200,
    });
  }

  async listJdas(tenantId: string) {
    return this.prisma.jointDevelopmentAgreement.findMany({
      where: { tenantId },
      include: { landParcel: true },
      orderBy: { jdaNo: "asc" },
      take: 200,
    });
  }

  async executeJda(tenantId: string, input: {
    jdaNo: string;
    landParcelId: string;
    landownerName: string;
    landownerSharePct: number;
    developerSharePct: number;
    revenueSharePct?: number;
    depositPaise?: bigint;
  }) {
    if (input.landownerSharePct + input.developerSharePct !== 100) {
      throw new BadRequestException("landownerSharePct + developerSharePct must equal 100%");
    }
    const parcel = await this.prisma.landParcel.findFirst({ where: { tenantId, id: input.landParcelId } });
    if (!parcel) throw new NotFoundException(`land parcel ${input.landParcelId} not found`);
    if (parcel.titleStatus !== "clear") {
      throw new BadRequestException(`cannot execute JDA on parcel with title status ${parcel.titleStatus}; clear title required`);
    }
    const existing = await this.prisma.jointDevelopmentAgreement.findFirst({ where: { tenantId, jdaNo: input.jdaNo } });
    if (existing) throw new ConflictException(`JDA ${input.jdaNo} already exists`);

    const areaShareSqFt = (Number(parcel.areaSqFt) * input.landownerSharePct) / 100;

    return this.prisma.jointDevelopmentAgreement.create({
      data: {
        tenantId,
        jdaNo: input.jdaNo,
        landParcelId: parcel.id,
        landownerName: input.landownerName,
        landownerSharePct: input.landownerSharePct,
        developerSharePct: input.developerSharePct,
        revenueSharePct: input.revenueSharePct,
        areaShareSqFt,
        depositPaise: input.depositPaise ?? 0n,
        status: "active",
      },
    });
  }

  /** Compute Revenue / Area distribution between Landowner and Developer. */
  async calculateJdaSplit(tenantId: string, jdaNo: string, totalProjectRevenuePaise: bigint) {
    const jda = await this.prisma.jointDevelopmentAgreement.findFirst({
      where: { tenantId, jdaNo },
      include: { landParcel: true },
    });
    if (!jda) throw new NotFoundException(`JDA ${jdaNo} not found`);

    const loShareBps = BigInt(Math.round(Number(jda.revenueSharePct ?? jda.landownerSharePct) * 100));
    const landownerRevenuePaise = (totalProjectRevenuePaise * loShareBps) / 10_000n;
    const developerRevenuePaise = totalProjectRevenuePaise - landownerRevenuePaise;

    return {
      jdaNo: jda.jdaNo,
      landownerName: jda.landownerName,
      landownerSharePct: Number(jda.landownerSharePct),
      developerSharePct: Number(jda.developerSharePct),
      totalAreaSqFt: Number(jda.landParcel.areaSqFt),
      landownerAreaSqFt: Number(jda.areaShareSqFt),
      totalProjectRevenuePaise,
      landownerRevenuePaise,
      developerRevenuePaise,
    };
  }
}
