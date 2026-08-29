import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:8080";

type PaymentsPayload = {
  schedule: Array<{ seq: number; label: string; amountPaise: string; amountFormatted: string; dueDate: string | null }>;
  receipts: Array<{ id: string; amountPaise: string; amountFormatted: string; instrument: string; clearedAt: string }>;
};

/** Payments: full demand schedule + cleared receipts. */
export default async function PaymentsPage() {
  const token = (await cookies()).get("access_token")?.value;
  let data: PaymentsPayload | null = null;
  try {
    const res = await fetch(`${CORE_API}/v1/portal/payments`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
      cache: "no-store",
    });
    if (res.ok) data = (await res.json()) as PaymentsPayload;
  } catch { /* degraded */ }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Payments & receipts</h1>

      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
        Payment schedule
      </h2>
      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(data?.schedule ?? []).map((s) => (
          <div
            key={s.seq}
            className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0"
            style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
          >
            <div>
              <div>{s.label}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {s.dueDate ? `due ${new Date(s.dueDate).toLocaleDateString("en-IN")}` : "due on construction milestone"}
              </div>
            </div>
            <MoneyText paise={BigInt(s.amountPaise)} />
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
        Receipts
      </h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(data?.receipts ?? []).map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0"
            style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
          >
            <div>
              <div>Payment received</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {r.instrument} · {new Date(r.clearedAt).toLocaleDateString("en-IN")}
              </div>
            </div>
            <MoneyText paise={BigInt(r.amountPaise)} />
          </div>
        ))}
        {(data?.receipts ?? []).length === 0 && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            No receipts yet.
          </div>
        )}
      </div>
      <a href="/" className="mt-6 inline-block text-sm" style={{ color: "var(--bo-primary)" }}>
        ← Back home
      </a>
    </main>
  );
}
