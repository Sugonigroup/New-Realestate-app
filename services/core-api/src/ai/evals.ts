import type { AgentComputation } from "./runtime.js";
import { AgentRuntime, type RunRecord } from "./runtime.js";
import { DEFAULT_POLICY, type PolicyConfig } from "./policy.js";

/**
 * Eval harness (Phase 7 gate, `25 §4`): golden scenario suites — every AI
 * promotion (shadow → L2 → L3) requires a green suite. Deterministic asserts
 * on computed outputs and policy verdicts; no model in the loop for these.
 */

export interface EvalCase<TInput> {
  name: string;
  input: TInput;
  compute: (input: TInput) => AgentComputation;
  expect: (computation: AgentComputation, run: RunRecord) => void;
}

export interface EvalSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  failures: Array<{ name: string; error: string }>;
}

export async function runEvalSuite<TInput>(
  suite: string,
  cases: Array<EvalCase<TInput>>,
  opts: { tenantId?: string; agentCode: string; shadowMode?: boolean; policy?: PolicyConfig },
): Promise<EvalSuiteResult> {
  const runtime = new AgentRuntime(
    { shadowMode: opts.shadowMode ?? true, policy: opts.policy ?? DEFAULT_POLICY },
    async () => {},
  );
  const result: EvalSuiteResult = { suite, passed: 0, failed: 0, failures: [] };
  for (const c of cases) {
    try {
      const computation = c.compute(c.input);
      const run = await runtime.run({
        tenantId: opts.tenantId ?? "eval-tenant",
        agentCode: opts.agentCode,
        triggerType: "manual",
        computation,
      });
      c.expect(computation, run);
      result.passed += 1;
    } catch (e) {
      result.failed += 1;
      result.failures.push({ name: c.name, error: (e as Error).message });
    }
  }
  return result;
}
