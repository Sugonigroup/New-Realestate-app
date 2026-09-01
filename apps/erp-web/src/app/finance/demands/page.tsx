import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import GenerateForm from "./generate-form";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface Demand {
  id: string;
  demandNo: string;
  bookingId: string;
  label: string;
  amountPaise: string;
  paidPaise: string;
  dueDate: string | null;
  status: string;
  lastDunningStep?: string | null;
}

/** Demands console (U2, 04 §4): status table + bulk generate from certification. */
export default async function DemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; generated?: string }>;
}) {
  const { status, generated } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  let demands: Demand[] = [];
  try {
    demands = (await serverApi(token).get<Demand[]>(`/v1/finance/demands${status ? `?status=${status}` : ""}`)) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Demands console</h1>
        <Link href="/finance/ledger" className="text-sm" style={{ color: "var(--bo-primary)" }}>Ledger →</Link>
      </div>
      <Subnav items={FINANCE_NAV} />

      {generated && (
        <p className="mb-4 rounded border p-3 text-sm" style={{ borderColor: "var(--bo-success)", background: "var(--bo-surface)" }}>
          Generated: {generated}
        </p>
      )}

      <GenerateForm />

      <div className="mt-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {demands.map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{d.demandNo} · {d.label}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {d.dueDate ? `due ${new Date(d.dueDate).toLocaleDateString("en-IN")}` : "due on certification"}
                {d.lastDunningStep ? ` · dunning ${d.lastDunningStep}` : ""}
              </div>
            </div>
            <div className="text-right">
              <MoneyText paise={BigInt(d.amountPaise)} />
              {d.paidPaise !== "0" && (
                <div className="text-xs" style={{ color: "var(--bo-success)" }}>
                  paid <MoneyText paise={BigInt(d.paidPaise)} />
                </div>
              )}
            </div>
            <span className="ml-4 rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{d.status}</span>
          </div>
        ))}
        {demands.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No demands.</div>}
      </div>
    </main>
  );
}
