import { loadOne } from "@/lib/load";
import { COMPLIANCE_NAV, Subnav } from "@/app/subnav";

interface Bundle {
  filename: string;
  json: string;
}

/** State portal bundle from GET /v1/compliance/qpr/bundle. */
export default async function QprBundlePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state = "KA" } = await searchParams;
  const bundle = await loadOne<Bundle>(`/v1/compliance/qpr/bundle?stateCode=${encodeURIComponent(state)}`);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">QPR export bundle</h1>
      <Subnav items={COMPLIANCE_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>State</label>
          <select name="state" defaultValue={state} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
            {["KA", "MH", "TN", "TG", "UP"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Export</button>
      </form>
      {bundle ? (
        <>
          <p className="mb-2 text-sm" style={{ color: "var(--bo-text-muted)" }}>{bundle.filename}</p>
          <pre className="overflow-auto rounded-lg border p-4 text-xs" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            {bundle.json}
          </pre>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Bundle unavailable.</p>
      )}
    </main>
  );
}
