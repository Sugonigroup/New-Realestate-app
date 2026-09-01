import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import Link from "next/link";
import { ParcelForm, JdaForm } from "./land-forms";

interface Parcel {
  id: string;
  parcelNo: string;
  surveyNo: string;
  location: string;
  areaSqFt: number;
  purchaseValPaise: string;
  titleStatus: string;
}

interface Jda {
  id: string;
  jdaNo: string;
  landownerName: string;
  landownerSharePct: number;
  developerSharePct: number;
  status: string;
  landParcel?: { parcelNo: string };
}

/** Land parcels and JDAs from GET /v1/land/parcels and /v1/land/jdas. */
export default async function LandPage() {
  const [parcels, jdas] = await Promise.all([
    loadList<Parcel>("/v1/land/parcels"),
    loadList<Jda>("/v1/land/jdas"),
  ]);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Land &amp; JDA</h1>
      <Subnav items={PROJECT_NAV} />

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Parcels</h2>
      <ParcelForm />
      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {parcels.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{p.parcelNo} · {p.location}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>survey {p.surveyNo} · {p.areaSqFt.toLocaleString("en-IN")} sqft</div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={asPaise(p.purchaseValPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{p.titleStatus}</span>
            </div>
          </div>
        ))}
        {parcels.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No parcels.</div>}
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>JDAs</h2>
      <JdaForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {jdas.map((j) => (
          <div key={j.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{j.jdaNo} · {j.landownerName}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {j.landParcel?.parcelNo ?? "parcel"} · LO {j.landownerSharePct}% / Dev {j.developerSharePct}%
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{j.status}</span>
              <Link href={`/land/jdas/${encodeURIComponent(j.jdaNo)}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>split</Link>
            </div>
          </div>
        ))}
        {jdas.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No JDAs.</div>}
      </div>
    </main>
  );
}
