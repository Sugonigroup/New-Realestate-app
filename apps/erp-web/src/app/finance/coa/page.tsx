import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../finance-nav";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  isPostable: boolean;
}

export default async function CoaPage() {
  const token = (await cookies()).get("access_token")?.value;
  let accounts: Account[] = [];
  try {
    accounts = (await serverApi(token).get<Account[]>("/v1/gl/accounts")) ?? [];
  } catch { /* degraded */ }

  const types = ["asset", "liability", "equity", "revenue", "expense"];

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Chart of accounts</h2>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Indian real-estate structure. Header accounts are not postable. B will attach entityId without replacing codes.
      </p>
      {types.map((type) => {
        const rows = accounts.filter((a) => a.type === type);
        if (rows.length === 0) return null;
        return (
          <section key={type} className="mb-6">
            <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>{type}</h3>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
              {rows.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                  <div>
                    <span className="font-mono text-xs">{a.code}</span>
                    <span className="ml-3 font-medium">{a.name}</span>
                    {a.parentCode && <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>under {a.parentCode}</span>}
                  </div>
                  <ToneChip label={a.isPostable ? "postable" : "header"} tone={a.isPostable ? "success" : "neutral"} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {accounts.length === 0 && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No accounts. Run core-api seed.</p>}
    </main>
  );
}
