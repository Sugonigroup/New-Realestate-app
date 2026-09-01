import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import RaBillForm from "./ra-form";

interface RaBill {
  id: string;
  billNo: string;
  contractorId: string;
  status: string;
  billQty: string;
  billRatePaise: string;
  recommendation: string | null;
  anomalies: Array<{ kind: string; expected: string; actual: string }> | null;
}

/** RA bills (U3): list with AI verification anomalies (08 #7 output). */
export default async function RaBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  const q = projectId ? `?projectId=${projectId}` : "";
  let bills: RaBill[] = [];
  let projects: Array<{ id: string; code: string }> = [];
  try {
    bills = (await api.get<RaBill[]>(`/v1/procurement/ra-bills${q}`)) ?? [];
  } catch { /* degraded */ }
  try { projects = (await api.get<Array<{ id: string; code: string }>>("/v1/projects")) ?? []; } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">RA bills — AI verification</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Contractor BOQ/MB verifier. Not linked to PO or GRN.
      </p>
      <RaBillForm projects={projects} />

      <div className="space-y-4">
        {bills.map((b) => {
          const clean = !b.anomalies || b.anomalies.length === 0;
          return (
            <div key={b.id} className="rounded-lg border p-4" style={{
              borderColor: clean ? "var(--bo-border)" : "var(--bo-warning)",
              background: "var(--bo-surface)",
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{b.billNo}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                    contractor {b.contractorId.slice(0, 8)} · qty {b.billQty} × ₹{(Number(b.billRatePaise) / 100000).toFixed(0)}/unit
                  </span>
                </div>
                <span className="rounded px-2 py-1 text-xs" style={{
                  background: clean ? "var(--bo-success)" : "var(--bo-warning)",
                  color: "white",
                }}>
                  {clean ? "clean" : `${b.anomalies!.length} anomaly(s)`}
                </span>
              </div>
              {b.anomalies && b.anomalies.length > 0 && (
                <ul className="mt-2 text-sm" style={{ color: "var(--bo-warning)" }}>
                  {b.anomalies.map((a, i) => (
                    <li key={i}>{a.kind}: expected {a.expected}, got {a.actual}</li>
                  ))}
                </ul>
              )}
              {b.recommendation && (
                <div className="mt-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  AI recommendation: <strong>{b.recommendation}</strong> — approval stays human (L1)
                </div>
              )}
              <div className="mt-2 text-sm">
                Value: <MoneyText paise={BigInt(Math.round(Number(b.billQty) * Number(b.billRatePaise)))} />
              </div>
            </div>
          );
        })}
        {bills.length === 0 && (
          <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>
            No RA bills yet. Submit via the form above.
          </div>
        )}
      </div>
    </main>
  );
}
