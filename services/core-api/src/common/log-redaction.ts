/** PII redaction for logs (03 §7, 16 §5): Aadhaar/PAN/phone/email never reach a log sink. */

const PATTERNS: Array<[RegExp, string]> = [
  // phone first (with +91 prefix) so 12-digit mobiles don't hit the Aadhaar pattern
  [/\b(?:\+91[- ]?)?[6-9]\d{9}\b/g, "[PHONE]"],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]"],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[AADHAAR]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[EMAIL]"],
];

export function redactPii(input: string): string {
  let out = input;
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  return out;
}

/** Deep-redact plain objects before structured logging. */
export function redactObject(obj: unknown): unknown {
  if (typeof obj === "string") return redactPii(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      // secret-shaped values redacted wholesale; PII-shaped values pattern-masked
      out[k] = /^(password|passwordhash|mfasecret)$/i.test(k) ? "[REDACTED]" : redactObject(v);
    }
    return out;
  }
  return obj;
}
