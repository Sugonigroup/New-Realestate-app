import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import { COMPLIANCE_NAV, Subnav } from "@/app/subnav";

interface StatutoryItem { kind: string; label: string; period: string; dueOn: string; ownerRole: string }

/** Statutory calendar (U4): month view of GST/TDS/PF/ESIC/PT due dates. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year = "2026", month = "9" } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  let items: StatutoryItem[] = [];
  try {
    items = (await serverApi(token).get<StatutoryItem[]>(`/v1/compliance/statutory?year=${year}&month=${month}`)) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Statutory calendar — {month}/{year}</h1>
      <Subnav items={COMPLIANCE_NAV} />
      <div className="rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {items.map((i) => (
          <div key={i.kind} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <span className="font-medium">{i.label}</span>
              <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>{i.period}</span>
            </div>
            <div className="text-right">
              <div>due {new Date(i.dueOn).toLocaleDateString("en-IN")}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>owner: {i.ownerRole}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
