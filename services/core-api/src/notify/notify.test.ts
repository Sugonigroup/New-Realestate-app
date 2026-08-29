import { describe, expect, it } from "vitest";
import { renderTemplate, templateVariables, TemplateError } from "./template.js";
import { canSend, type ConsentRow } from "./consent.js";
import { isQuietHours, istHour, shouldDefer } from "./quiet-hours.js";
import { advanceJourney, type JourneyDefinition } from "./journey.js";

describe("templates (strict variables)", () => {
  it("substitutes variables", () => {
    expect(renderTemplate("Dear {{name}}, due ₹{{amount}}", { name: "Ravi", amount: "45,000" })).toBe(
      "Dear Ravi, due ₹45,000",
    );
  });

  it("fails loudly on missing variables (never sends blanks)", () => {
    expect(() => renderTemplate("Dear {{name}}, due {{amount}}", { name: "Ravi" })).toThrow(TemplateError);
    expect(templateVariables("Hi {{a}} {{b.c}}")).toEqual(["a", "b.c"]);
  });
});

describe("consent gating (DPDP)", () => {
  const row = (over: Partial<ConsentRow>): ConsentRow => ({
    channel: "whatsapp",
    purpose: "promotional",
    grantedAt: new Date("2025-01-01"),
    revokedAt: null,
    ...over,
  });

  it("promotional requires an explicit grant", () => {
    expect(canSend([], "whatsapp", "promotional")).toMatchObject({ allowed: false, reason: "no-consent" });
    expect(canSend([row({})], "whatsapp", "promotional")).toMatchObject({ allowed: true, reason: "granted" });
  });

  it("transactional is default-allowed for contract performance", () => {
    expect(canSend([], "whatsapp", "transactional")).toMatchObject({ allowed: true, reason: "transactional-default" });
  });

  it("STOP revokes the channel absolutely (even transactional)", () => {
    const consents = [
      row({ purpose: "transactional", grantedAt: new Date(), revokedAt: new Date("2025-06-01") }),
      row({ grantedAt: new Date() }),
    ];
    expect(canSend(consents, "whatsapp", "promotional")).toMatchObject({ allowed: false, reason: "revoked" });
    expect(canSend(consents, "whatsapp", "transactional")).toMatchObject({ allowed: false, reason: "revoked" });
  });

  it("channels are independent", () => {
    expect(canSend([row({ channel: "email" })], "whatsapp", "promotional")).toMatchObject({ reason: "no-consent" });
  });
});

describe("quiet hours (IST 21:00–08:00)", () => {
  // 21:30 IST == 16:00 UTC
  it("computes IST hour correctly", () => {
    expect(istHour(new Date("2025-06-01T16:00:00Z"))).toBe(21.5);
    expect(istHour(new Date("2025-06-01T04:00:00Z"))).toBe(9.5); // 09:30 IST
  });

  it("defers non-S0 messages at night, S0 always goes out", () => {
    const night = new Date("2025-06-01T16:00:00Z"); // 21:30 IST
    expect(isQuietHours(night)).toBe(true);
    expect(shouldDefer(night, "S2")).toBe(true);
    expect(shouldDefer(night, "S0")).toBe(false);
    const morning = new Date("2025-06-01T04:00:00Z"); // 09:30 IST
    expect(shouldDefer(morning, "S2")).toBe(false);
  });
});

describe("journey runner v1", () => {
  const leadNurture: JourneyDefinition = {
    steps: [
      { type: "send", channel: "whatsapp", templateKey: "lead_ack", vars: {} },
      { type: "wait", minutes: 60 * 24 * 2 },
      { type: "send", channel: "whatsapp", templateKey: "lead_d2", vars: {} },
      { type: "stop" },
    ],
  };

  it("runs to the first wait, then completes on advance", () => {
    let state = advanceJourney(leadNurture, { stepIndex: 0, status: "running", sends: [] }, { name: "A" });
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0]).toMatchObject({ templateKey: "lead_ack", vars: { name: "A" } });
    expect(state.status).toBe("running");
    expect(state.nextRunAt).toBeDefined();

    state = advanceJourney(leadNurture, state);
    expect(state.sends).toHaveLength(2);
    expect(state.sends[1]?.templateKey).toBe("lead_d2");
    expect(state.status).toBe("stopped"); // explicit stop step
  });

  it("completed journeys are idempotent no-ops", () => {
    const done = { stepIndex: 4, status: "completed" as const, sends: [] };
    expect(advanceJourney(leadNurture, done).sends).toHaveLength(0);
  });
});
