/**
 * Milestone certification gate (WP-3B, 11 §3): a milestone can be certified only
 * with complete evidence, closed QC checklists, zero open NCRs, and the
 * consultant certificate. Certification emits milestone.certified.v1 which the
 * demand engine consumes (dollar pipeline: certification → demand → dunning).
 */

export interface CertificationEvidence {
  photoCount: number; // minimum 3 per milestone activity (11 §6)
  pourCardsClosed: boolean; // stage QC checklists closed (configurable gate)
  openNcrs: number;
  structuralCertificateRef?: string | null; // Form 3 equivalent (engineer)
  caCertificateRef?: string | null; // Form 4 equivalent (architect/CA)
}

export interface CertificationDecision {
  ok: boolean;
  blockers: string[];
}

export function evaluateCertification(e: CertificationEvidence): CertificationDecision {
  const blockers: string[] = [];
  if (e.photoCount < 3) blockers.push(`photo evidence incomplete: ${e.photoCount}/3 minimum`);
  if (!e.pourCardsClosed) blockers.push("stage QC checklists (pour cards) not closed");
  if (e.openNcrs > 0) blockers.push(`${e.openNcrs} open NCR(s) must be closed or contained`);
  if (!e.structuralCertificateRef) blockers.push("structural consultant certificate missing");
  if (!e.caCertificateRef) blockers.push("CA certificate (Form 4) missing");
  return { ok: blockers.length === 0, blockers };
}
