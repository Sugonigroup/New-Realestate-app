/** Consent gating — DPDP + channel rules (01 BR-J, `20-notification-architecture.md §4`). */

export type Channel = "whatsapp" | "email" | "sms";
export type Purpose = "transactional" | "promotional";

export interface ConsentRow {
  channel: Channel;
  purpose: Purpose;
  grantedAt?: Date | null;
  revokedAt?: Date | null;
}

export interface ConsentDecision {
  allowed: boolean;
  reason: "granted" | "transactional-default" | "no-consent" | "revoked";
}

/**
 * Promotional sends need an explicit, unrevoked grant (DPDP purpose limitation).
 * Transactional (contract performance — demands, receipts, OTP) is allowed by
 * default; a revocation still blocks the channel entirely (STOP is absolute).
 */
export function canSend(consents: ConsentRow[], channel: Channel, purpose: Purpose): ConsentDecision {
  const relevant = consents.filter((c) => c.channel === channel);
  const revoked = relevant.some((c) => c.revokedAt !== null && c.revokedAt !== undefined);
  if (revoked) return { allowed: false, reason: "revoked" };
  if (purpose === "transactional") return { allowed: true, reason: "transactional-default" };
  const granted = relevant.some(
    (c) => c.purpose === "promotional" && c.grantedAt !== null && c.grantedAt !== undefined,
  );
  return granted ? { allowed: true, reason: "granted" } : { allowed: false, reason: "no-consent" };
}
