import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../finance-nav";
import MatchForm from "./match-form";

interface Invoice {
  id: string;
  invoiceNo: string;
  vendorId: string;
  amountPaise: string;
  tdsBps: number;
  status: string;
  invoiceDate: string;
}

interface Proposal {
  proposals: Array<{ invoiceId: string; vendorId: string; amountPaise: string }>;
  totalPaise: string;
}

export default async function ApPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let invoices: Invoice[] = [];
  let proposal: Proposal | null = null;
  try {
    invoices = (await api.get<Invoice[]>("/v1/gl/ap/invoices")) ?? [];
    proposal = await api.get<Proposal>("/v1/gl/ap/payment-proposal");
  } catch { /* degraded */ }

  const tone = (s: string) => s === "3way_matched" ? "success" : s === "rejected" ? "danger" : "warning";

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Accounts payable</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        3-way match: invoice vs PO vs GRN (5% invoice/PO tolerance; GRN must equal PO). Approach B will load PO/GRN from procurement.
      </p>
      <MatchForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{inv.invoiceNo} · {inv.vendorId}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{new Date(inv.invoiceDate).toLocaleDateString("en-IN")} · TDS {inv.tdsBps} bps</div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={BigInt(inv.amountPaise)} />
              <ToneChip label={inv.status} tone={tone(inv.status)} />
            </div>
          </div>
        ))}
        {invoices.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No vendor invoices.</div>}
      </div>
      {proposal && (
        <p className="mt-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Payment proposal (3-way matched): {proposal.proposals.length} invoice(s), total <MoneyText paise={BigInt(proposal.totalPaise ?? "0")} />
        </p>
      )}
    </main>
  );
}
