import { loadList } from "@/lib/load";
import Link from "next/link";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";
import CreateVendorForm from "./create-form";

interface Vendor {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  status: string;
}

/** Vendor register from GET /v1/procurement/vendors. */
export default async function VendorsPage() {
  const rows = await loadList<Vendor>("/v1/procurement/vendors");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Vendors</h1>
      <Subnav items={PROCUREMENT_NAV} />
      <CreateVendorForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((v) => (
          <div key={v.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{v.code} · {v.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{v.gstin ?? "no GSTIN"}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{v.status}</span>
              <Link href={`/procurement/vendors/${v.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>rating</Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No vendors.</div>}
      </div>
    </main>
  );
}
