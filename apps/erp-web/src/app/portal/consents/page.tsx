import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadPortal } from "@/lib/load";
import { PORTAL_NAV, Subnav } from "@/app/subnav";
import ConsentForm from "../consent-form";

interface Consent {
  channel: string;
  purpose: string;
  granted: boolean;
  at: string | null;
}

/** DPDP consent center from GET /v1/portal/consents. */
export default async function PortalConsentsPage() {
  if (!(await cookies()).get("portal_access_token")?.value) redirect("/portal");
  const rows = await loadPortal<Consent[]>("/v1/portal/consents");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Consents</h1>
      <Subnav items={PORTAL_NAV} />
      <ConsentForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(rows ?? []).map((c, i) => (
          <div key={`${c.channel}-${c.purpose}-${i}`} className="flex justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span>{c.channel} · {c.purpose}</span>
            <span>{c.granted ? "granted" : "revoked"}</span>
          </div>
        ))}
        {(rows ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No consent records.</div>}
      </div>
    </main>
  );
}
