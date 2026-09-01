import Link from "next/link";
import { loadList } from "@/lib/load";
import { ADMIN_NAV, Subnav } from "@/app/subnav";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  lastLoginAt: string | null;
}

/** Tenant users from GET /v1/admin/users. */
export default async function AdminUsersPage() {
  const rows = await loadList<UserRow>("/v1/admin/users");

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/roles" style={{ color: "var(--bo-primary)" }}>Roles →</Link>
          <Link href="/admin/audit" style={{ color: "var(--bo-primary)" }}>Audit →</Link>
        </div>
      </div>
      <Subnav items={ADMIN_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((u) => (
          <div key={u.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{u.fullName}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{u.email}</div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{u.status}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No users.</div>}
      </div>
    </main>
  );
}
