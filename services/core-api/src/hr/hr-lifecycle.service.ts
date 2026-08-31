import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * HR Employee Lifecycle service (HR-01):
 * - Job requisition: draft → (approval, maker-checker SoD) → open → filled
 * - Candidate pipeline state machine: applied → screening → interview → offer_sent
 *   → offer_accepted → joined (or rejected at any pre-offer stage)
 * - Offer lifecycle: draft → sent → accepted/declined (expiry enforced)
 * - Exit: initiated → cleared (full & final dues) → employee marked exited
 */

const STAGE_FLOW: Record<string, string> = {
  applied: "screening",
  screening: "interview",
  interview: "offer_sent",
};

@Injectable()
export class HrLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Requisitions ────────────────────────────────────────────────────────

  async createRequisition(tenantId: string, input: {
    reqNo: string;
    position: string;
    department: string;
    headcount?: number;
    projectId?: string;
    requesterId: string;
  }) {
    const existing = await this.prisma.jobRequisition.findFirst({ where: { tenantId, reqNo: input.reqNo } });
    if (existing) throw new ConflictException(`requisition ${input.reqNo} already exists`);
    return this.prisma.jobRequisition.create({
      data: {
        tenantId,
        reqNo: input.reqNo,
        position: input.position,
        department: input.department,
        headcount: input.headcount ?? 1,
        projectId: input.projectId,
        requestedBy: input.requesterId,
        status: "draft",
      },
    });
  }

  /** Approve requisition — maker-checker: the requester cannot approve their own request. */
  async approveRequisition(tenantId: string, reqNo: string, approverId: string) {
    const req = await this.prisma.jobRequisition.findFirst({ where: { tenantId, reqNo } });
    if (!req) throw new NotFoundException(`requisition ${reqNo} not found`);
    if (req.status !== "draft") throw new ConflictException(`requisition ${reqNo} is ${req.status}`);
    if (req.requestedBy === approverId) {
      throw new BadRequestException(`maker-checker violation: ${approverId} raised and cannot approve requisition ${reqNo}`);
    }
    return this.prisma.jobRequisition.update({
      where: { id: req.id },
      data: { status: "open", approvedBy: approverId, approvedAt: new Date() },
    });
  }

  // ── Candidate pipeline ──────────────────────────────────────────────────

  async addCandidate(tenantId: string, input: {
    requisitionId: string;
    name: string;
    phone: string;
    email?: string;
    source: "portal" | "referral" | "agency" | "walk_in";
  }) {
    const req = await this.prisma.jobRequisition.findFirst({ where: { tenantId, id: input.requisitionId } });
    if (!req) throw new NotFoundException(`requisition ${input.requisitionId} not found`);
    if (req.status !== "open") {
      throw new ConflictException(`requisition ${req.reqNo} is ${req.status}; only open requisitions accept candidates`);
    }
    return this.prisma.jobCandidate.create({
      data: {
        tenantId,
        requisitionId: req.id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        source: input.source,
        stage: "applied",
      },
    });
  }

  /** Advance candidate one stage forward, or reject. State machine enforced. */
  async moveCandidateStage(tenantId: string, candidateId: string, action: "advance" | "reject", rating?: number) {
    const candidate = await this.prisma.jobCandidate.findFirst({ where: { tenantId, id: candidateId } });
    if (!candidate) throw new NotFoundException(`candidate ${candidateId} not found`);

    if (action === "reject") {
      if (candidate.stage === "joined" || candidate.stage === "rejected") {
        throw new ConflictException(`candidate is already ${candidate.stage}`);
      }
      return this.prisma.jobCandidate.update({
        where: { id: candidate.id },
        data: { stage: "rejected" },
      });
    }

    const next = STAGE_FLOW[candidate.stage];
    if (!next) throw new ConflictException(`cannot advance from stage ${candidate.stage}; use offer accept/join flow`);

    return this.prisma.jobCandidate.update({
      where: { id: candidate.id },
      data: { stage: next, rating: rating ?? candidate.rating },
    });
  }

  // ── Offers ──────────────────────────────────────────────────────────────

  async issueOffer(tenantId: string, input: {
    offerNo: string;
    candidateId: string;
    offeredCtcPaise: bigint;
    validUntil: Date;
    joiningDate?: Date;
  }) {
    const candidate = await this.prisma.jobCandidate.findFirst({ where: { tenantId, id: input.candidateId } });
    if (!candidate) throw new NotFoundException(`candidate ${input.candidateId} not found`);
    if (candidate.stage !== "interview") {
      throw new ConflictException(`candidate is at ${candidate.stage}; offers can only be issued after interview stage`);
    }
    const existing = await this.prisma.jobOffer.findFirst({ where: { tenantId, offerNo: input.offerNo } });
    if (existing) throw new ConflictException(`offer ${input.offerNo} already exists`);

    const offer = await this.prisma.jobOffer.create({
      data: {
        tenantId,
        offerNo: input.offerNo,
        candidateId: candidate.id,
        offeredCtcPaise: input.offeredCtcPaise,
        validUntil: input.validUntil,
        joiningDate: input.joiningDate,
        status: "sent",
      },
    });
    await this.prisma.jobCandidate.update({ where: { id: candidate.id }, data: { stage: "offer_sent" } });
    return offer;
  }

  async respondOffer(tenantId: string, offerNo: string, accept: boolean) {
    const offer = await this.prisma.jobOffer.findFirst({ where: { tenantId, offerNo } });
    if (!offer) throw new NotFoundException(`offer ${offerNo} not found`);
    if (offer.status !== "sent") throw new ConflictException(`offer ${offerNo} is ${offer.status}`);
    if (new Date() > new Date(offer.validUntil as unknown as string)) {
      throw new ConflictException(`offer ${offerNo} expired on ${new Date(offer.validUntil as unknown as string).toISOString()}`);
    }

    const updated = await this.prisma.jobOffer.update({
      where: { id: offer.id },
      data: { status: accept ? "accepted" : "declined", respondedAt: new Date() },
    });
    await this.prisma.jobCandidate.update({
      where: { id: offer.candidateId },
      data: { stage: accept ? "offer_accepted" : "rejected" },
    });
    return updated;
  }

  /** Mark candidate joined — fills the requisition when headcount is reached. */
  async markJoined(tenantId: string, offerNo: string, joiningDate: Date) {
    const offer = await this.prisma.jobOffer.findFirst({ where: { tenantId, offerNo }, include: { candidate: true } });
    if (!offer) throw new NotFoundException(`offer ${offerNo} not found`);
    if (offer.status !== "accepted") throw new ConflictException(`offer ${offerNo} is ${offer.status}; must be accepted first`);

    await this.prisma.jobCandidate.update({
      where: { id: offer.candidateId },
      data: { stage: "joined" },
    });
    const candidate = offer.candidate as { requisitionId: string };
    const req = await this.prisma.jobRequisition.findFirst({
      where: { tenantId, id: candidate.requisitionId },
      include: { candidates: true },
    });
    if (req) {
      const joined = req.candidates.filter((c) => c.stage === "joined").length;
      if (joined >= (req.headcount as number)) {
        await this.prisma.jobRequisition.update({ where: { id: req.id }, data: { status: "filled" } });
      }
    }
    return { offerNo, joinedOn: joiningDate };
  }

  // ── Exits ───────────────────────────────────────────────────────────────

  async initiateExit(tenantId: string, input: {
    employeeId: string;
    reason: "resignation" | "termination" | "absconding" | "retirement";
    noticeDays?: number;
    lastWorkingDay: Date;
  }) {
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, id: input.employeeId } });
    if (!employee) throw new NotFoundException(`employee ${input.employeeId} not found`);
    if (employee.status === "exited") throw new ConflictException(`employee ${employee.code} has already exited`);

    const openExit = await this.prisma.employeeExit.findFirst({
      where: { tenantId, employeeId: input.employeeId, status: { in: ["initiated", "cleared"] } },
    });
    if (openExit) throw new ConflictException(`exit already in progress for employee ${employee.code}`);

    return this.prisma.employeeExit.create({
      data: {
        tenantId,
        employeeId: input.employeeId,
        reason: input.reason,
        noticeDays: input.noticeDays ?? 30,
        lastWorkingDay: input.lastWorkingDay,
        status: "initiated",
      },
    });
  }

  /** Clear exit with full & final dues settlement — marks employee exited. */
  async clearExit(tenantId: string, employeeId: string, duesSettledPaise: bigint, clearedBy: string) {
    const exit = await this.prisma.employeeExit.findFirst({
      where: { tenantId, employeeId, status: "initiated" },
    });
    if (!exit) throw new NotFoundException(`no initiated exit for employee ${employeeId}`);

    const cleared = await this.prisma.employeeExit.update({
      where: { id: exit.id },
      data: { status: "exited", duesSettledPaise, clearedBy },
    });
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: "exited" },
    });
    return cleared;
  }
}
