import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../procurement-nav";
import VendorForm from "./vendor-form";

interface Vendor { id: string; code: string; name: string; gstin: string | null; status: string }
interface Rating { vendorId: string; grnCount: number; score: number | null; band: string; onTimePct: number | null; acceptancePct: number | null }

export default async function VendorsPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let vendors: Vendor[] = [];
  try {
    vendors = (await api.get<Vendor[]>("/v1/procurement/vendors")) ?? [];
  } catch { /* degraded */ }

  const ratings = new Map<string, Rating>();
  await Promise.all(vendors.map(async (v) => {
    try {
      ratings.set(v.id, await api.get<Rating>(`/v1/procurement/vendors/${v.id}/rating`));
    } catch { /* skip */ }
  }));

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Vendors</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Unique vendor code. Rating is on-time GRN vs promised date plus accepted qty %.
      </p>
      <VendorForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {vendors.map((v) => {
          const r = ratings.get(v.id);
          return (
            <div key={v.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{v.code} · {v.name}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{v.gstin ?? "no GSTIN"}{r ? ` · ${r.grnCount} GRN · on-time ${r.onTimePct ?? "—"}% · accept ${r.acceptancePct ?? "—"}%` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <ToneChip label={v.status} tone={v.status === "active" ? "success" : "danger"} />
                {r && <ToneChip label={r.band} tone={r.band === "A" || r.band === "B" ? "success" : r.band === "unrated" ? "neutral" : "warning"} />}
              </div>
            </div>
          );
        })}
        {vendors.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No vendors. Create one or re-seed the Verde chain.</div>}
      </div>
    </main>
  );
}
