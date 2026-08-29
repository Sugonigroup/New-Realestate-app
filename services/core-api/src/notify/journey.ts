/**
 * Journey engine v1 (05 §3, 01 §M11.3): event-triggered step sequences with waits,
 * quiet-hour deferral handled by the send layer. Pure runner — persistence in service.
 */

export type JourneyStep =
  | { type: "send"; channel: "whatsapp" | "email" | "sms"; templateKey: string; vars?: Record<string, string> }
  | { type: "wait"; minutes: number }
  | { type: "stop" };

export interface JourneyDefinition {
  steps: JourneyStep[];
}

export interface JourneyRunState {
  stepIndex: number;
  status: "running" | "completed" | "stopped";
  nextRunAt?: Date;
  sends: Array<{ stepIndex: number; channel: string; templateKey: string; vars: Record<string, string> }>;
}

/**
 * Advance a journey run from `stepIndex`, executing send steps and stopping at the
 * first wait (sets nextRunAt) or the end/stop. Idempotent: re-running a completed
 * state is a no-op.
 */
export function advanceJourney(
  def: JourneyDefinition,
  state: JourneyRunState,
  vars: Record<string, string> = {},
  now: Date = new Date(),
): JourneyRunState {
  if (state.status !== "running") return state;
  const out: JourneyRunState = { ...state, sends: [...state.sends] };
  let i = state.stepIndex;
  while (i < def.steps.length) {
    const step = def.steps[i]!;
    if (step.type === "send") {
      out.sends.push({
        stepIndex: i,
        channel: step.channel,
        templateKey: step.templateKey,
        vars: { ...vars, ...(step.vars ?? {}) },
      });
      i += 1;
      continue;
    }
    if (step.type === "wait") {
      out.stepIndex = i + 1;
      out.nextRunAt = new Date(now.getTime() + step.minutes * 60_000);
      return out;
    }
    if (step.type === "stop") {
      out.stepIndex = i;
      out.status = "stopped";
      return out;
    }
  }
  out.stepIndex = i;
  out.status = "completed";
  return out;
}
