import Link from "next/link";
import { loadOne } from "@/lib/load";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";

interface Rating {
  vendorId: string;
  grnCount: number;
  onTimePct: number | null;
  acceptancePct: number | null;
  score: number | null;
  band: string;
}

/** Vendor rating from GET /v1/procurement/vendors/:id/rating. */
export default async function VendorRatingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await loadOne<Rating>(`/v1/procurement/vendors/${id}/rating`);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Vendor rating</h1>
      <Subnav items={PROCUREMENT_NAV} />
      <p className="mb-4 text-sm">
        <Link href="/procurement/vendors" style={{ color: "var(--bo-primary)" }}>← Vendors</Link>
      </p>
      {!r ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Rating unavailable.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Band", r.band],
            ["Score", r.score == null ? "—" : String(r.score)],
            ["GRNs", String(r.grnCount)],
            ["On-time", r.onTimePct == null ? "—" : `${r.onTimePct}%`],
            ["Acceptance", r.acceptancePct == null ? "—" : `${r.acceptancePct}%`],
          ].map(([label, v]) => (
            <div key={label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
              <div className="mt-1 text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
