import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { HR_NAV, Subnav } from "@/app/subnav";
import ExitForm from "./exit-form";
import ClearExitForm from "./clear-exit-form";

interface Employee {
  id: string;
  code: string;
  name: string;
  role: string;
  stateCode: string;
  basicMonthlyPaise: string;
  status: string;
}

/** Employee register from GET /v1/hr/employees. */
export default async function EmployeesPage() {
  const rows = await loadList<Employee>("/v1/hr/employees");

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/hr/recruitment" style={{ color: "var(--bo-primary)" }}>Recruitment →</Link>
          <Link href="/hr/payroll" style={{ color: "var(--bo-primary)" }}>Payroll →</Link>
        </div>
      </div>
      <Subnav items={HR_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{e.code} · {e.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{e.role} · {e.stateCode}</div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={asPaise(e.basicMonthlyPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{e.status}</span>
              {e.status === "active" && <ExitForm employeeId={e.id} />}
              {e.status !== "exited" && <ClearExitForm employeeId={e.id} />}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No employees.</div>}
      </div>
    </main>
  );
}
