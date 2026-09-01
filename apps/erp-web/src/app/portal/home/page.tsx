import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadPortal } from "@/lib/load";
import { PORTAL_NAV, Subnav } from "@/app/subnav";

interface Home {
  booking: { id: string; customerName: string; totalPaise: string; aftStatus: string };
  nextDue: { demandNo: string; label: string; outstanding: string; dueDate: string | null } | null;
}

/** Buyer home from GET /v1/portal/home (customer JWT). */
export default async function PortalHomePage() {
  if (!(await cookies()).get("portal_access_token")?.value) redirect("/portal");
  const home = await loadPortal<Home>("/v1/portal/home");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Your booking</h1>
      <Subnav items={PORTAL_NAV} />
      {!home?.booking ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No active booking. <Link href="/portal" style={{ color: "var(--bo-primary)" }}>Sign in again</Link></p>
      ) : (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {home.booking.customerName} · AFT {home.booking.aftStatus}
          </p>
          <div className="grid max-w-xl grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Next due</div>
              <div className="mt-1 text-lg font-semibold">{home.nextDue?.outstanding ?? "Cleared"}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {home.nextDue ? `${home.nextDue.demandNo} · ${home.nextDue.label}` : "No outstanding demand"}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
