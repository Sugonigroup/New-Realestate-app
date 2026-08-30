/**
 * Autonomy policy engine (Phase 6, `docs/architecture/10-ai-autonomy-policy.md`).
 * Policy-as-data; the gate is pure and the SAME for every agent — security is
 * enforced outside the model (binding principle 3/17).
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ToolGate = "read" | "L3" | "L4" | "L5";
export type Severity = 0 | 1 | 2 | 3 | 4; // S0..S4 (20 §1 inverted: 0 = most critical)
export type Verdict = "ALLOW" | "EXECUTE" | "APPROVAL_REQUIRED" | "DOWNGRADE_DRAFT" | "DENY";

export interface ToolDef {
  name: string;
  gate: ToolGate;
  actionClass?: string; // for delegation/matrix resolution on L4
}

export interface AgentDef {
  code: string;
  name: string;
  ceiling: AutonomyLevel;
  tools: string[]; // allowlist (tool names)
  dailyBudgetPaise: bigint;
  triggers: string[];
}

export interface PolicyConfig {
  l3ConfidenceMin: number; // default 0.85
  l3MaxSeverity: Severity; // default 2 (S2 worst auto-executable)
  /** action classes that ALWAYS require human approval even if a tool says L3 */
  l4Actions: string[];
}

export const DEFAULT_POLICY: PolicyConfig = {
  l3ConfidenceMin: 0.85,
  l3MaxSeverity: 2,
  l4Actions: [
    "sales.discount", "finance.refund", "procurement.po", "finance.paymentrun",
    "compliance.qpr", "hr.payroll", "projects.baseline", "finance.budget",
  ],
};

export interface PolicyRequest {
  agentCode: string;
  tool: string;
  confidence: number; // 0..1 (model + deterministic validators agree)
  severity: Severity;
  actionClass?: string; // e.g. "sales.discount" when the tool exercises an authority-matrix action
  argsValid: boolean;
}

export interface PolicyVerdict {
  verdict: Verdict;
  reason: string;
  level: AutonomyLevel | null;
}

export function evaluatePolicy(
  req: PolicyRequest,
  agent: AgentDef,
  tool: ToolDef,
  config: PolicyConfig = DEFAULT_POLICY,
): PolicyVerdict {
  // 1. allowlist — the agent may only call tools in its registry entry
  if (!agent.tools.includes(req.tool)) {
    return { verdict: "DENY", reason: `tool "${req.tool}" not in ${req.agentCode} allowlist`, level: null };
  }
  // 2. L5 — prohibited outright (registry-level gate, defense in depth)
  if (tool.gate === "L5") {
    return { verdict: "DENY", reason: `tool "${req.tool}" is L5-prohibited (never autonomous)`, level: 5 };
  }
  // 3. action-class override: authority-matrix actions always need approval
  if (req.actionClass && config.l4Actions.includes(req.actionClass)) {
    return { verdict: "APPROVAL_REQUIRED", reason: `action class "${req.actionClass}" requires human approval (L4)`, level: 4 };
  }
  // 4. tool gate
  if (tool.gate === "read") return { verdict: "ALLOW", reason: "read-only", level: 0 };
  if (tool.gate === "L4") {
    return { verdict: "APPROVAL_REQUIRED", reason: `tool "${req.tool}" is L4 — human approval mandatory`, level: 4 };
  }
  // 5. L3 low-risk execution: confidence + severity + arg validation
  if (tool.gate === "L3") {
    if (req.confidence >= config.l3ConfidenceMin && req.severity <= config.l3MaxSeverity && req.argsValid) {
      if (agent.ceiling >= 3) return { verdict: "EXECUTE", reason: "L3 low-risk execution within agent ceiling", level: 3 };
      return { verdict: "DOWNGRADE_DRAFT", reason: `agent ceiling is L${agent.ceiling}`, level: 2 };
    }
    return { verdict: "DOWNGRADE_DRAFT", reason: "confidence/severity/args below L3 thresholds", level: 2 };
  }
  // unreachable with a closed gate union
  return { verdict: "DENY", reason: `unknown gate ${tool.gate}`, level: null };
}
