import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import Link from "next/link";
import CreateAssetForm from "./create-form";
import CompleteWoForm from "./complete-wo-form";

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  purchaseValPaise: string;
  currentMeterVal: string | number;
  meterUnit: string | null;
  workOrders?: Array<{ woNo: string; status: string; type: string }>;
}

/** Asset register from GET /v1/assets. */
export default async function AssetsPage() {
  const rows = await loadList<Asset>("/v1/assets");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Assets</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>{rows.length} registered assets</p>
      <Subnav items={PROJECT_NAV} />
      <CreateAssetForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((a) => (
          <div key={a.id} className="border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{a.assetTag} · {a.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {a.category}{a.meterUnit ? ` · meter ${a.currentMeterVal} ${a.meterUnit}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={asPaise(a.purchaseValPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{a.status}</span>
              <Link href={`/assets/${a.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>books</Link>
            </div>
          </div>
          {(a.workOrders ?? []).filter((w) => w.status !== "completed" && w.status !== "cancelled").map((w) => (
            <div key={w.woNo} className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--bo-text-muted)" }}>
              <span>{w.woNo} · {w.type} · {w.status}</span>
              <CompleteWoForm woNo={w.woNo} />
            </div>
          ))}
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No assets.</div>}
      </div>
    </main>
  );
}
