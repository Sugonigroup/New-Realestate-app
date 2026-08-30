import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import InteractionForm from "./interaction-form";

interface Interaction {
  id: string;
  type: string;
  disposition?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  source: string;
  status: string;
  score: number;
  budgetPaise?: string | null;
}

/** Lead Detail (U1): split view — info panel + interaction timeline + quick log. */
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let lead: (Lead & { interactions: Interaction[] }) | null = null;
  try {
    lead = (await serverApi(token).get<Lead & { interactions: Interaction[] }>(`/v1/crm/leads/${id}`)) ?? null;
  } catch { /* degraded */ }
  if (!lead) notFound();

  return (
    <main className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{lead.fullName}</h1>
          <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {lead.phone} · {lead.source} · {lead.status}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Score</div>
          <div className="text-2xl font-semibold">{lead.score}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Details</h2>
          <dl className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="flex justify-between py-1"><dt>Email</dt><dd>{lead.email ?? "—"}</dd></div>
            <div className="flex justify-between py-1"><dt>Budget</dt><dd>{lead.budgetPaise ? <MoneyText paise={BigInt(lead.budgetPaise)} /> : "—"}</dd></div>
          </dl>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Timeline</h2>
          <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            {(lead.interactions ?? []).length === 0 && <p style={{ color: "var(--bo-text-muted)" }}>No interactions yet.</p>}
            {(lead.interactions ?? []).map((i) => (
              <div key={i.id} className="border-b py-2 last:border-b-0" style={{ borderColor: "var(--bo-border)" }}>
                <span className="font-medium">{i.type}</span>
                {i.disposition ? ` · ${i.disposition}` : ""}
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  {new Date(i.createdAt).toLocaleString("en-IN")}
                </div>
                {i.notes && <div>{i.notes}</div>}
              </div>
            ))}
          </div>
          <InteractionForm leadId={lead.id} />
        </section>
      </div>
    </main>
  );
}
