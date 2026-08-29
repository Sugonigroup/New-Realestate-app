import { cookies } from "next/headers";
import { MoneyText, StatCard } from "@buildos/ui";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:8080";

type HomePayload = {
  booking: { customerName: string; totalPaise: string; aftStatus: string };
  nextDue: { demandNo: string; label: string; outstanding: string; dueDate: string | null } | null;
};

/** Home (D11): next due + booking summary, buyer-scoped via portal token. */
export default async function PortalHome() {
  const token = (await cookies()).get("access_token")?.value;
  let home: HomePayload | null = null;
  try {
    const res = await fetch(`${CORE_API}/v1/portal/home`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
      cache: "no-store",
    });
    if (res.ok) home = (await res.json()) as HomePayload;
  } catch { /* degraded */ }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Namaste, {home?.booking.customerName ?? "Homeowner"} 🙏</h1>
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Agreement status: {home?.booking.aftStatus ?? "—"}
        </p>
      </header>

      {home?.nextDue ? (
        <section className="mb-6 rounded-lg border p-5" style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
            Next payment due · {home.nextDue.demandNo}
          </div>
          <div className="mt-1 text-2xl font-semibold">{home.nextDue.outstanding}</div>
          <div className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {home.nextDue.label}
            {home.nextDue.dueDate ? ` · due ${new Date(home.nextDue.dueDate).toLocaleDateString("en-IN")}` : ""}
          </div>
          <a
            href="/payments"
            className="mt-4 inline-block rounded px-4 py-2 font-medium text-white"
            style={{ background: "var(--bo-primary)" }}
          >
            Pay now
          </a>
        </section>
      ) : (
        <StatCard label="Payments" value="You're all caught up ✨" tone="success" />
      )}

      <nav className="flex gap-4 text-sm" style={{ color: "var(--bo-primary)" }}>
        <a href="/payments">Payments & receipts</a>
        <a href="/consents">Communication settings</a>
      </nav>
    </main>
  );
}
