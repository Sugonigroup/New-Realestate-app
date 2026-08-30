import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapCapturedPayment, verifyRazorpaySignature, type RazorpayPaymentPayload } from "./razorpay-webhook.js";

const SECRET = "whsec_test_123";
const body = JSON.stringify({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_GAbcd1234",
        order_id: "order_GXyz",
        amount: 25000000, // ₹2,50,000 in paise — Razorpay-native
        currency: "INR",
        method: "upi",
        vpa: "ravi@okhdfcbank",
        notes: { bookingId: "bk-1", unitId: "unit-9" },
      },
    },
  },
} satisfies RazorpayPaymentPayload);

describe("Razorpay webhook (WP-2B live adapter)", () => {
  it("verifies a correct HMAC-SHA256 signature", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyRazorpaySignature(body, sig, SECRET)).toBe(true);
  });

  it("rejects tampered bodies and wrong secrets", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyRazorpaySignature(body + " ", sig, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, sig, "wrong")).toBe(false);
  });

  it("maps captured payments to receipt inputs (paise-native, no conversion)", () => {
    const payload = JSON.parse(body) as RazorpayPaymentPayload;
    const mapped = mapCapturedPayment(payload);
    expect(mapped).toEqual({
      bookingId: "bk-1",
      unitId: "unit-9",
      amountPaise: 25000000n,
      instrument: "gateway",
      gatewayRef: "pay_GAbcd1234",
      instrumentRef: "pay_GAbcd1234",
    });
  });

  it("returns null for non-captured events and unattributable payments", () => {
    const failed = JSON.parse(body) as RazorpayPaymentPayload;
    failed.event = "payment.failed";
    expect(mapCapturedPayment(failed)).toBeNull();
    const noNotes = JSON.parse(body) as RazorpayPaymentPayload;
    noNotes.event = "payment.captured";
    noNotes.payload.payment.entity.notes = {};
    expect(mapCapturedPayment(noNotes)).toBeNull();
  });
});
