import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay webhook signature verification (Razorpay docs: HMAC-SHA256 of the
 * raw request body with the webhook secret, compared to the
 * `x-razorpay-signature` header). Same pattern as the lead webhook (05 §4).
 */
export function verifyRazorpaySignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RazorpayPaymentPayload {
  event: "payment.captured" | "payment.failed" | "refund.processed";
  payload: {
    payment: {
      entity: {
        id: string; // pay_xxx → gatewayRef
        order_id: string;
        amount: number; // paise — Razorpay is already paise-native
        currency: string;
        method: string; // upi | card | netbanking | nach…
        vpa?: string;
        notes: Record<string, string>; // bookingId / unitId travel here
      };
    };
  };
}

/** Map a captured payment webhook to the FinanceService.applyReceipt input. */
export function mapCapturedPayment(event: RazorpayPaymentPayload): {
  bookingId: string;
  unitId: string;
  amountPaise: bigint;
  instrument: "gateway";
  gatewayRef: string;
  instrumentRef: string;
} | null {
  if (event.event !== "payment.captured") return null;
  const entity = event.payload.payment.entity;
  const bookingId = entity.notes["bookingId"];
  const unitId = entity.notes["unitId"];
  if (!bookingId || !unitId) return null; // unattributable → exceptions queue
  return {
    bookingId,
    unitId,
    amountPaise: BigInt(entity.amount),
    instrument: "gateway",
    gatewayRef: entity.id,
    instrumentRef: entity.id,
  };
}
