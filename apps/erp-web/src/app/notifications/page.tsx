import { loadList } from "@/lib/load";

interface Msg {
  id: string;
  channel: string;
  templateKey: string;
  toAddress: string;
  status: string;
  statusUpdatedAt: string;
}

/** Message log from GET /v1/notifications/messages?toRef=. */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ toRef?: string }>;
}) {
  const { toRef } = await searchParams;
  const rows = toRef ? await loadList<Msg>(`/v1/notifications/messages?toRef=${encodeURIComponent(toRef)}`) : [];

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Notification log</h1>
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Recipient ref</label>
          <input name="toRef" defaultValue={toRef ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{m.channel} · {m.templateKey}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{m.toAddress} · {new Date(m.statusUpdatedAt).toLocaleString("en-IN")}</div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{m.status}</span>
          </div>
        ))}
        {toRef && rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No messages.</div>}
      </div>
    </main>
  );
}
