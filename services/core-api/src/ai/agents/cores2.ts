import { classifyIncident, type IncidentSeverity } from "../../projects/site-ops.js";
import { contractorComposite, type ContractorScores } from "../../analytics/kpis.js";
import type { AgentComputation } from "../runtime.js";
import type { Severity } from "../policy.js";

/** Remaining agent cores (Phase 6/7) — deterministic, evidence-carrying. */

type Core = Omit<AgentComputation, "confidence"> & { confidence: number };

// ── Project Manager Agent (08 #1): portfolio/project health composite ───────

export interface HealthInput {
  projectId: string;
  spi: number;
  cpi: number;
  overdueMilestones: number;
  openNcrs: number;
  escrowBreach: boolean;
}

export interface HealthOutput extends Core {}

export function assessProjectHealth(input: HealthInput): HealthOutput {
  const risks: string[] = [];
  if (input.spi < 0.9) risks.push(`SPI ${input.spi.toFixed(2)}`);
  if (input.cpi < 0.9) risks.push(`CPI ${input.cpi.toFixed(2)}`);
  if (input.overdueMilestones > 0) risks.push(`${input.overdueMilestones} overdue milestone(s)`);
  if (input.openNcrs > 0) risks.push(`${input.openNcrs} open NCR(s)`);
  if (input.escrowBreach) risks.push("escrow breach");

  const severity: Severity = input.escrowBreach || input.spi < 0.85 ? 1 : risks.length >= 2 ? 2 : risks.length === 1 ? 3 : 4;
  const healthy = risks.length === 0;
  return {
    observation: { projectId: input.projectId, risks },
    risk: { severity },
    recommendation: healthy ? "project healthy — no action" : `action needed: ${risks.join("; ")}`,
    actionType: healthy ? "emit_event" : "create_task",
    actionPayload: healthy
      ? { event: "project.risk_changed", level: "none" }
      : { taskType: "review_project_health", projectId: input.projectId, reasons: risks },
    confidence: 0.99, // fully deterministic composite
    evidence: [{ type: "kpi", ref: `project-health:${input.projectId}` }],
  };
}

// ── Procurement Agent (08 #4): PR draft from shortage (L4 payload) ──────────

export interface ProcurementInput {
  projectId: string;
  shortage: { materialId: string; materialName: string; suggestedQty: number; unit: string; daysToStockout: number; confidence: number };
  stockRef: string;
  openPoRef: string;
}

export interface ProcurementOutput extends Core {}

export function draftPurchaseRequest(input: ProcurementInput): ProcurementOutput {
  const urgent = input.shortage.daysToStockout <= 7;
  const severity: Severity = urgent ? 1 : 2;
  return {
    observation: {
      material: input.shortage.materialName,
      daysToStockout: input.shortage.daysToStockout,
      suggestedQty: input.shortage.suggestedQty,
    },
    risk: { severity },
    recommendation: `draft PR for ${input.shortage.suggestedQty} ${input.shortage.unit} of ${input.shortage.materialName} (stockout in ${input.shortage.daysToStockout}d)`,
    actionType: "create_purchase_request",
    actionPayload: {
      projectId: input.projectId,
      materialId: input.shortage.materialId,
      qty: input.shortage.suggestedQty,
      unit: input.shortage.unit,
      basis: { stockRef: input.stockRef, openPoRef: input.openPoRef },
      reason: `projected shortage in ${input.shortage.daysToStockout} days`,
    },
    confidence: input.shortage.confidence,
    evidence: [
      { type: "computation", ref: `days-of-cover:${input.shortage.materialId}` },
      { type: "record", ref: input.stockRef },
    ],
  };
}

// ── Contractor Agent (08 #6): scorecard (L1 recommend) ──────────────────────

export interface ContractorInput {
  contractorId: string;
  scores: ContractorScores;
  trend: "improving" | "stable" | "declining";
}

export interface ContractorOutput extends Core {}

export function contractorScorecard(input: ContractorInput): ContractorOutput {
  const { score, band } = contractorComposite(input.scores);
  const declining = input.trend === "declining" || band === "D";
  const severity: Severity = band === "D" ? 1 : declining ? 2 : 3;
  return {
    observation: { contractorId: input.contractorId, score, band, trend: input.trend },
    risk: { severity },
    recommendation:
      band === "D"
        ? `contractor ${input.contractorId} scored ${score} (D) — review engagement at procurement council`
        : `scorecard ${score} (${band}) — within tolerance`,
    actionType: declining ? "notify_role" : "emit_event",
    actionPayload: declining
      ? { role: "procurement_manager", template: "contractor_declining", vars: { contractorId: input.contractorId, score: String(score) } }
      : { event: "contractor.scored.v1", score: String(score) },
    confidence: 0.98,
    evidence: [{ type: "kpi", ref: `contractor-score:${input.contractorId}` }],
  };
}

// ── Quality Agent (08 #9): NCR draft from failed inspection (L4 payload) ────

export interface QualityInput {
  inspectionId: string;
  projectId: string;
  failedItems: string[];
  severity: "minor" | "major" | "critical";
  photoRefs: string[];
}

export interface QualityOutput extends Core {}

export function draftNcr(input: QualityInput): QualityOutput {
  const sev: Severity = input.severity === "critical" ? 1 : input.severity === "major" ? 2 : 3;
  return {
    observation: { inspectionId: input.inspectionId, failedItems: input.failedItems },
    risk: { severity: sev },
    recommendation: `raise NCR for ${input.failedItems.length} failed item(s) on inspection ${input.inspectionId}`,
    actionType: "create_ncr",
    actionPayload: {
      projectId: input.projectId,
      inspectionId: input.inspectionId,
      defectClass: input.severity,
      photos: input.photoRefs,
      evidence: input.failedItems,
    },
    confidence: input.photoRefs.length >= 3 ? 0.9 : 0.6,
    evidence: [
      { type: "record", ref: input.inspectionId },
      { type: "document", ref: input.photoRefs[0] ?? "no-photos" },
    ],
  };
}

// ── Safety Agent (08 #10): incident → CAPA tasks (L3) ───────────────────────

export interface SafetyInput {
  incidentId: string;
  projectId: string;
  severity: IncidentSeverity;
  description: string;
}

export interface SafetyOutput extends Core {}

export function planIncidentCapa(input: SafetyInput): SafetyOutput {
  const classification = classifyIncident(input.severity);
  const sev: Severity = input.severity === "fatal" ? 0 : input.severity === "major" ? 1 : 2;
  return {
    observation: { incidentId: input.incidentId, severity: input.severity, classification },
    risk: { severity: sev },
    recommendation:
      classification.reportableToAuthority
        ? `${input.severity} incident — reportable; open CAPA (SLA ${classification.capaSlaDays}d) and notify safety head + compliance`
        : `open CAPA for ${input.severity} incident (SLA ${classification.capaSlaDays}d)`,
    actionType: "create_task",
    actionPayload: {
      taskType: "incident_capa",
      projectId: input.projectId,
      ref: input.incidentId,
      slaDays: classification.capaSlaDays,
      reportable: classification.reportableToAuthority,
      workStoppage: classification.workStoppage,
    },
    confidence: 0.98,
    evidence: [{ type: "record", ref: input.incidentId }],
  };
}

// ── Document Intelligence Agent (08 #11): classification from metadata ──────

export interface DocumentInput {
  documentId: string;
  filename: string;
  mimeType: string;
  hasFormFields: boolean;
}

export interface DocumentOutput extends Core {}

export function classifyDocument(input: DocumentInput): DocumentOutput {
  const name = input.filename.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/drawing|dwg|gfc/, "drawing"],
    [/boq|soe/, "boq"],
    [/invoice|bill/, "invoice"],
    [/contract|agreement|aft/, "contract"],
    [/noc|certificate|licen/, "certificate"],
  ];
  const docClass = rules.find(([re]) => re.test(name))?.[1] ?? (input.mimeType.includes("image") ? "site_photo" : "other");
  const confidence = docClass === "other" ? 0.4 : 0.85;
  return {
    observation: { documentId: input.documentId, filename: input.filename, classified: docClass },
    risk: { severity: 3 },
    recommendation: `filed as ${docClass} — route to ${docClass} register`,
    actionType: "emit_event",
    actionPayload: { documentId: input.documentId, docClass },
    confidence,
    evidence: [{ type: "document", ref: input.documentId }],
  };
}
