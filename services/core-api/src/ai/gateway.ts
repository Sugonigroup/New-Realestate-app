import { createHash } from "node:crypto";

/**
 * LLM gateway (WP-6, 28): the ONLY path to model providers — routing by class,
 * PII masking before any prompt leaves, per-agent daily budgets, call accounting.
 * Phase 6 runs shadow with a DeterministicProvider; real providers plug into
 * the same port when Phase 7 enables them.
 */

export type LlmTaskClass = "extract" | "reason" | "narrate" | "chat" | "embed";

export interface LlmRequest {
  taskClass: LlmTaskClass;
  agentCode: string;
  prompt: string;
  maxTokens: number;
}

export interface LlmResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costPaise: bigint;
  model: string;
  promptHash: string;
}

export interface LlmProvider {
  readonly model: string;
  readonly costPer1kTokensPaise: bigint;
  complete(prompt: string, maxTokens: number): Promise<{ text: string; tokensIn: number; tokensOut: number }>;
}

/** Phase 6 shadow provider — deterministic echo-summary; never used for money math. */
export class DeterministicProvider implements LlmProvider {
  readonly model = "deterministic-shadow-v1";
  readonly costPer1kTokensPaise = 0n;

  async complete(prompt: string, maxTokens: number): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    const text = `[shadow] ${prompt.slice(0, Math.min(80, maxTokens))}…`;
    return { text, tokensIn: Math.ceil(prompt.length / 4), tokensOut: Math.ceil(text.length / 4) };
  }
}

/** PII masking — Aadhaar/PAN/bank account numbers never leave unmasked (16 §5). */
export function maskPii(text: string): string {
  return text
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[AADHAAR_MASKED]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN_MASKED]")
    .replace(/\b\d{9,18}\b/g, "[ACCOUNT_MASKED]");
}

export class BudgetExceededError extends Error {}

export class LlmGateway {
  private readonly spentToday = new Map<string, bigint>();
  private readonly maskedCount = { aadhaar: 0, pan: 0, account: 0 };

  constructor(
    private readonly provider: LlmProvider = new DeterministicProvider(),
    private readonly dailyBudgetPaise = 500_000n, // default per-agent cap (28 §2)
  ) {}

  stats() {
    return { masked: { ...this.maskedCount }, spend: new Map(this.spentToday) };
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const spent = this.spentToday.get(req.agentCode) ?? 0n;
    if (spent >= this.dailyBudgetPaise) {
      throw new BudgetExceededError(`agent ${req.agentCode} hit its daily AI budget`);
    }

    const masked = maskPii(req.prompt);
    const counts = this.countMasked(req.prompt, masked);
    this.maskedCount.aadhaar += counts.aadhaar;
    this.maskedCount.pan += counts.pan;
    this.maskedCount.account += counts.account;

    const out = await this.provider.complete(masked, req.maxTokens);
    const costPaise =
      (BigInt(out.tokensIn + out.tokensOut) * this.provider.costPer1kTokensPaise) / 1000n;
    this.spentToday.set(req.agentCode, spent + costPaise);

    return {
      text: out.text,
      tokensIn: out.tokensIn,
      tokensOut: out.tokensOut,
      costPaise,
      model: this.provider.model,
      promptHash: createHash("sha256").update(masked).digest("hex").slice(0, 16),
    };
  }

  private countMasked(original: string, masked: string): { aadhaar: number; pan: number; account: number } {
    return {
      aadhaar: (original.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/g) ?? []).length,
      pan: (original.match(/\b[A-Z]{5}\d{4}[A-Z]\b/g) ?? []).length,
      account: (original.match(/\b\d{9,18}\b/g) ?? []).length
        - (original.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/g) ?? []).length,
    };
  }
}
