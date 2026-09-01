import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../finance-nav";
import { CloseForm } from "./close-form";

interface Period { id: string; period: string; start: string; end: string; status: string }

export default async function PeriodsPage() {
  const token = (await cookies()).get("access_token")?.value;
  let periods: Period[] = [];
  try {
    periods = (await serverApi(token).get<Period[]>("/v1/gl/periods")) ?? [];
  } catch { /* degraded */ }

  const tone = (s: string) => s === "open" ? "success" : s === "soft_closed" ? "warning" : "danger";

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Fiscal periods</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        FY 2026-27 (Apr–Mar). Soft close blocks new postings. Hard close is final. Draft journals in the month must be posted or reversed first. CFO permission required.
      </p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {periods.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <span className="font-medium">{p.period}</span>
              <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {new Date(p.start).toLocaleDateString("en-IN")} – {new Date(p.end).toLocaleDateString("en-IN")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ToneChip label={p.status} tone={tone(p.status)} />
              <CloseForm period={p.period} disabled={p.status === "hard_closed"} />
            </div>
          </div>
        ))}
        {periods.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No periods. Run seed.</div>}
      </div>
    </main>
  );
}
