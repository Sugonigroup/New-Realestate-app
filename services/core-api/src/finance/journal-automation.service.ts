import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { GlService } from "./gl.service.js";

/**
 * Journal templates & recurring journals (FIN-03):
 * - Template = reusable named line set (accountCode + fixed amount or "amount" placeholder)
 * - Recurring rule = template + frequency + day-of-month; run() materializes a posted
 *   GL journal from the template, advances nextRunOn, and is idempotent per period.
 */

interface TemplateLine {
  accountCode: string;
  debitPaise?: bigint | "amount";
  creditPaise?: bigint | "amount";
  description?: string;
}

@Injectable()
export class JournalAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  async createTemplate(tenantId: string, input: {
    code: string;
    name: string;
    description?: string;
    lines: TemplateLine[];
  }) {
    if (input.lines.length < 2) throw new BadRequestException("template needs at least 2 lines");
    const existing = await this.prisma.journalTemplate.findFirst({ where: { tenantId, code: input.code } });
    if (existing) throw new ConflictException(`template ${input.code} already exists`);
    return this.prisma.journalTemplate.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        description: input.description,
        lines: input.lines as unknown as object,
        isActive: true,
      },
    });
  }

  async createRecurringRule(tenantId: string, input: {
    templateCode: string;
    frequency: "monthly" | "quarterly";
    dayOfMonth: number;
    nextRunOn: Date;
  }) {
    if (input.dayOfMonth < 1 || input.dayOfMonth > 28) {
      throw new BadRequestException("dayOfMonth must be 1-28 (safe for all months)");
    }
    const template = await this.prisma.journalTemplate.findFirst({ where: { tenantId, code: input.templateCode } });
    if (!template) throw new NotFoundException(`template ${input.templateCode} not found`);
    const existing = await this.prisma.recurringJournalRule.findFirst({ where: { tenantId, templateCode: input.templateCode } });
    if (existing) throw new ConflictException(`recurring rule for ${input.templateCode} already exists`);

    return this.prisma.recurringJournalRule.create({
      data: {
        tenantId,
        templateCode: input.templateCode,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        nextRunOn: input.nextRunOn,
        status: "active",
      },
    });
  }

  /**
   * Run a recurring rule: materialize a posted journal from its template.
   * amountPaise fills every "amount" placeholder line.
   */
  async runRecurring(tenantId: string, templateCode: string, amountPaise: bigint, asOfDate: Date = new Date()) {
    const rule = await this.prisma.recurringJournalRule.findFirst({ where: { tenantId, templateCode } });
    if (!rule) throw new NotFoundException(`recurring rule for ${templateCode} not found`);
    if (rule.status !== "active") throw new ConflictException(`recurring rule ${templateCode} is ${rule.status}`);
    if (asOfDate < new Date(rule.nextRunOn as unknown as string)) {
      throw new BadRequestException(`rule not due until ${new Date(rule.nextRunOn as unknown as string).toISOString()}`);
    }

    const template = await this.prisma.journalTemplate.findFirst({ where: { tenantId, code: templateCode } });
    if (!template) throw new NotFoundException(`template ${templateCode} not found`);

    const rawLines = template.lines as unknown as TemplateLine[];
    const lines = rawLines.map((l) => ({
      accountCode: l.accountCode,
      debitPaise: l.debitPaise === "amount" ? amountPaise : (l.debitPaise as bigint) ?? 0n,
      creditPaise: l.creditPaise === "amount" ? amountPaise : (l.creditPaise as bigint) ?? 0n,
      description: l.description,
    }));

    const voucherNo = `RJ-${templateCode}-${asOfDate.toISOString().slice(0, 7)}`;
    const journal = await this.gl.createJournal({
      tenantId,
      voucherNo,
      type: "journal",
      date: asOfDate,
      narration: `Recurring journal ${template.name}`,
      createdBy: "system:recurring",
      lines,
    });
    await this.gl.postJournal(tenantId, journal.journalId, "system:recurring");

    // Advance nextRunOn by frequency and stamp last run
    const next = new Date(rule.nextRunOn as unknown as string);
    if (rule.frequency === "monthly") next.setMonth(next.getMonth() + 1);
    else next.setMonth(next.getMonth() + 3);

    await this.prisma.recurringJournalRule.update({
      where: { id: rule.id },
      data: { nextRunOn: next, lastRunAt: new Date() },
    });

    return { journalId: journal.journalId, voucherNo, nextRunOn: next };
  }
}
