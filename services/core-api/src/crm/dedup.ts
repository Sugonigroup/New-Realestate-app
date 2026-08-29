/** Dedup engine — WP-1A: phone is the identity anchor (BR-2A in 01 §M2). */

export interface ExistingLead {
  id: string;
  phone: string;
  email?: string | null;
  projectId?: string | null;
  status: string;
}

export interface LeadCandidate {
  phone: string;
  email?: string;
  projectId?: string;
}

export type DedupKind = "duplicate" | "linked" | "new";

export interface DedupDecision {
  kind: DedupKind;
  matchLeadId?: string;
  reason: string;
}

/**
 * Rules (`01 §M2.1`):
 *  - same phone + same project → DUPLICATE (merge suggestion, no new lead)
 *  - same phone + different project → LINKED new opportunity for that project
 *  - same email (no phone match) → DUPLICATE
 *  - else NEW
 */
export function dedupDecision(existing: ExistingLead[], candidate: LeadCandidate): DedupDecision {
  const phoneMatch = existing.find((l) => l.phone === candidate.phone);
  if (phoneMatch) {
    if (candidate.projectId && phoneMatch.projectId === candidate.projectId) {
      return { kind: "duplicate", matchLeadId: phoneMatch.id, reason: "same phone and project" };
    }
    return { kind: "linked", matchLeadId: phoneMatch.id, reason: "same phone, different project" };
  }
  if (candidate.email) {
    const emailMatch = existing.find((l) => l.email && l.email === candidate.email);
    if (emailMatch) {
      return { kind: "duplicate", matchLeadId: emailMatch.id, reason: "same email" };
    }
  }
  return { kind: "new", reason: "no match" };
}
