import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Org {
  id: string;
  name: string;
  orgType: string;
  gstin: string | null;
  city: string | null;
  contacts?: Array<{ id: string; fullName: string; role: string | null }>;
}

/** Channel / corporate orgs from GET /v1/crm/organizations. */
export default async function OrganizationsPage() {
  const rows = await loadList<Org>("/v1/crm/organizations");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Organizations</h1>
      <Subnav items={CRM_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((o) => (
          <div key={o.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{o.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {o.orgType} · {o.city ?? "—"} · {o.gstin ?? "no GSTIN"} · {o.contacts?.length ?? 0} contacts
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No organizations.</div>}
      </div>
    </main>
  );
}
