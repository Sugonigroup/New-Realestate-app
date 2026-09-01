import { loadList } from "@/lib/load";
import { HR_NAV, Subnav } from "@/app/subnav";
import { PostButton } from "@/app/post-button";
import CandidateForm from "./candidate-form";
import RequisitionForm from "./requisition-form";
import OfferForm from "./offer-form";

interface Candidate {
  id: string;
  name: string;
  source: string;
  stage: string;
  rating: number | null;
  requisition?: { reqNo: string; position: string };
}

/** Candidate pipeline from GET /v1/hr/recruitment/candidates. */
export default async function RecruitmentPage() {
  const rows = await loadList<Candidate>("/v1/hr/recruitment/candidates");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Recruitment pipeline</h1>
      <Subnav items={HR_NAV} />
      <RequisitionForm />
      <CandidateForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {c.requisition?.reqNo ?? "—"} · {c.requisition?.position ?? "—"} · {c.source}
                {c.rating ? ` · rating ${c.rating}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{c.stage}</span>
              {["applied", "screening"].includes(c.stage) && (
                <>
                  <PostButton path={`/v1/hr/recruitment/candidates/${c.id}/stage`} body={{ action: "advance" }} label="Advance" />
                  <PostButton path={`/v1/hr/recruitment/candidates/${c.id}/stage`} body={{ action: "reject" }} label="Reject" />
                </>
              )}
              {c.stage === "interview" && (
                <>
                  <OfferForm candidateId={c.id} />
                  <PostButton path={`/v1/hr/recruitment/candidates/${c.id}/stage`} body={{ action: "reject" }} label="Reject" />
                </>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No candidates.</div>}
      </div>
    </main>
  );
}
