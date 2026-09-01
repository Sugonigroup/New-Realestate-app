import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Msg {
  id: string;
  channel: string;
  direction: string;
  body: string;
  deliveryStatus: string;
  createdAt: string;
}

/** Conversation from GET /v1/crm/comms/threads/:threadId. */
export default async function ThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string }>;
}) {
  const { threadId } = await searchParams;
  const rows = threadId ? await loadList<Msg>(`/v1/crm/comms/threads/${encodeURIComponent(threadId)}`) : [];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Comms thread</h1>
      <Subnav items={CRM_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Thread ID</label>
          <input name="threadId" defaultValue={threadId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((m) => (
          <div key={m.id} className="border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.direction} · {m.channel}</span>
              <span className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{new Date(m.createdAt).toLocaleString("en-IN")} · {m.deliveryStatus}</span>
            </div>
            <p className="mt-1">{m.body}</p>
          </div>
        ))}
        {threadId && rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No messages.</div>}
      </div>
    </main>
  );
}
