import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Partner portal API (U5, v1): code-based lookup (partner auth = OTP via
 * phone in Phase 7; code entry is the interim).
 */
@ApiTags("partners")
@Controller("partners")
export class PartnerPortalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":code/dashboard")
  async dashboard(@Param("code") code: string): Promise<unknown> {
    const partner = await this.prisma.channelPartner.findFirst({
      where: { code, status: "active" },
    });
    if (!partner) return { error: "partner not found" };

    const panels = await this.prisma.partnerPanel.findMany({
      where: { partnerId: partner.id, active: true },
    });
    const ledger = await this.prisma.commissionLedgerEntry.findMany({
      where: { partnerId: partner.id, status: { in: ["accrued", "paid"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const leads = await this.prisma.lead.findMany({
      where: { tenantId: partner.tenantId, source: "partner", sourceRef: partner.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      partner: { code: partner.code, name: partner.name, reraAgentNo: partner.reraAgentNo },
      panelProjectIds: panels.map((p) => p.projectId),
      leads: leads.map((l) => ({ id: l.id, name: l.fullName, status: l.status, createdAt: l.createdAt })),
      commissions: {
        accruedPaise: ledger.filter((l) => l.status === "accrued").reduce((s, l) => s + BigInt(l.accruedPaise), 0n).toString(),
        paidPaise: ledger.filter((l) => l.status === "paid").reduce((s, l) => s + BigInt(l.accruedPaise), 0n).toString(),
        entries: ledger.map((l) => ({ bookingId: l.bookingId, accruedPaise: l.accruedPaise.toString(), status: l.status })),
      },
    };
  }
}
