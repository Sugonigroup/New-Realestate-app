/** Lead normalization — WP-1A ingestion stage 1. Deterministic; no guessing. */

export interface NormalizedLead {
  fullName: string;
  phone: string; // +91XXXXXXXXXX
  email?: string;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  return null; // invalid for the Indian mobile space → ingestion rejects
}

export function normalizeEmail(raw: string | undefined | null): string | undefined {
  const s = raw?.trim().toLowerCase();
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : undefined;
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeLead(raw: { fullName: string; phone: string; email?: string | null }): NormalizedLead | { error: string } {
  const phone = normalizePhone(raw.phone ?? "");
  if (!phone) return { error: `invalid phone: "${raw.phone}"` };
  const fullName = cleanName(raw.fullName ?? "");
  if (!fullName) return { error: "missing name" };
  const email = normalizeEmail(raw.email);
  return { fullName, phone, ...(email ? { email } : {}) };
}
