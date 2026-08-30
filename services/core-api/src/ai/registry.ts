import type { AgentDef, ToolDef } from "./policy.js";

/** Tool catalog (09 §2/§3): every gate is explicit; L5 tools exist only to be denied. */
export const TOOL_CATALOG: Record<string, ToolDef> = {
  // read (L0)
  read_kpis: { name: "read_kpis", gate: "read" },
  read_record: { name: "read_record", gate: "read" },
  search_records: { name: "search_records", gate: "read" },
  read_events: { name: "read_events", gate: "read" },
  retrieve_knowledge: { name: "retrieve_knowledge", gate: "read" },
  read_memory: { name: "read_memory", gate: "read" },
  // L3 low-risk execution
  notify_role: { name: "notify_role", gate: "L3", actionClass: "notify" },
  create_task: { name: "create_task", gate: "L3", actionClass: "task" },
  update_status: { name: "update_status", gate: "L3", actionClass: "status" },
  generate_report: { name: "generate_report", gate: "L3", actionClass: "report" },
  create_draft_inspection: { name: "create_draft_inspection", gate: "L3", actionClass: "quality" },
  emit_event: { name: "emit_event", gate: "L3", actionClass: "event" },
  // L4 — human approval mandatory
  create_purchase_request: { name: "create_purchase_request", gate: "L4", actionClass: "procurement.pr" },
  create_ncr: { name: "create_ncr", gate: "L4", actionClass: "quality.ncr" },
  flag_bill_anomaly: { name: "flag_bill_anomaly", gate: "L4", actionClass: "contractors.billing" },
  propose_baseline_revision: { name: "propose_baseline_revision", gate: "L4", actionClass: "projects.baseline" },
  propose_budget_revision: { name: "propose_budget_revision", gate: "L4", actionClass: "finance.budget" },
  create_demand_correction: { name: "create_demand_correction", gate: "L4", actionClass: "finance.demand" },
  // L5 — prohibited (present only so denial is testable and explicit)
  create_purchase_order: { name: "create_purchase_order", gate: "L5" },
  release_payment_run: { name: "release_payment_run", gate: "L5" },
  approve_ra_bill: { name: "approve_ra_bill", gate: "L5" },
  change_contract_terms: { name: "change_contract_terms", gate: "L5" },
  modify_autonomy_policy: { name: "modify_autonomy_policy", gate: "L5" },
  execute_refund: { name: "execute_refund", gate: "L5" },
};

/** The 12 agents (08) — registry as data (ADR-AI1); narrow scopes, explicit ceilings. */
export const AGENTS: AgentDef[] = [
  { code: "project_manager_agent", name: "Project Manager Agent", ceiling: 2,
    tools: ["read_kpis", "read_record", "read_events", "read_memory", "create_task", "notify_role", "emit_event"],
    dailyBudgetPaise: 50_000n, triggers: ["cron:daily", "project.risk_changed", "dpr.submitted"] },
  { code: "progress_agent", name: "Construction Progress Agent", ceiling: 2,
    tools: ["read_kpis", "read_record", "read_events", "retrieve_knowledge", "create_task", "emit_event", "generate_report"],
    dailyBudgetPaise: 60_000n, triggers: ["dpr.submitted", "progress.updated", "cron:daily"] },
  { code: "schedule_agent", name: "Schedule Agent", ceiling: 2,
    tools: ["read_kpis", "read_record", "read_events", "propose_baseline_revision", "emit_event"],
    dailyBudgetPaise: 40_000n, triggers: ["activity.delayed", "cron:weekly"] },
  { code: "procurement_agent", name: "Procurement Agent", ceiling: 2,
    tools: ["read_kpis", "read_record", "search_records", "create_purchase_request", "create_task", "notify_role", "emit_event"],
    dailyBudgetPaise: 60_000n, triggers: ["material.low_stock", "material.shortage.predicted", "purchase_order.delayed"] },
  { code: "material_agent", name: "Material Intelligence Agent", ceiling: 2,
    tools: ["read_kpis", "read_record", "read_events", "create_task", "notify_role", "emit_event"],
    dailyBudgetPaise: 40_000n, triggers: ["stock_movement.created", "cron:daily"] },
  { code: "contractor_agent", name: "Contractor Agent", ceiling: 1,
    tools: ["read_kpis", "read_record", "notify_role", "emit_event"],
    dailyBudgetPaise: 30_000n, triggers: ["rabill.approved", "quality.ncr_created", "safety.incident_created", "cron:weekly"] },
  { code: "billing_verification_agent", name: "Billing Verification Agent", ceiling: 1,
    tools: ["read_record", "retrieve_knowledge", "flag_bill_anomaly", "emit_event"],
    dailyBudgetPaise: 50_000n, triggers: ["bill.submitted"] },
  { code: "cost_control_agent", name: "Cost Control Agent", ceiling: 1,
    tools: ["read_kpis", "read_record", "propose_budget_revision", "notify_role", "emit_event"],
    dailyBudgetPaise: 40_000n, triggers: ["commitment.created", "actual_cost.posted", "cron:daily"] },
  { code: "quality_agent", name: "Quality Agent", ceiling: 3,
    tools: ["read_record", "create_draft_inspection", "create_ncr", "create_task", "notify_role", "emit_event"],
    dailyBudgetPaise: 40_000n, triggers: ["inspection.completed"] },
  { code: "safety_agent", name: "Safety Agent", ceiling: 3,
    tools: ["read_record", "create_task", "notify_role", "generate_report", "emit_event"],
    dailyBudgetPaise: 40_000n, triggers: ["safety.incident_created", "cron:daily"] },
  { code: "document_agent", name: "Document Intelligence Agent", ceiling: 3,
    tools: ["retrieve_knowledge", "emit_event"],
    dailyBudgetPaise: 50_000n, triggers: ["document.uploaded"] },
  { code: "management_agent", name: "Management Intelligence Agent", ceiling: 2,
    tools: ["read_kpis", "read_events", "generate_report", "notify_role", "emit_event"],
    dailyBudgetPaise: 80_000n, triggers: ["cron:daily", "cron:weekly", "cron:monthly"] },
];

export const AGENT_MAP: Map<string, AgentDef> = new Map(AGENTS.map((a) => [a.code, a]));

export function agentFor(code: string): AgentDef {
  const a = AGENT_MAP.get(code);
  if (!a) throw new RangeError(`unknown agent: ${code}`);
  return a;
}

export function toolFor(name: string): ToolDef {
  const t = TOOL_CATALOG[name];
  if (!t) throw new RangeError(`unknown tool: ${name}`);
  return t;
}
