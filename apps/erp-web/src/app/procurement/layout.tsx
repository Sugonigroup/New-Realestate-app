import { ProcurementNav } from "./procurement-nav";

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          Procurement · sourcing loop
        </p>
        <h1 className="text-xl font-semibold">Indent to GRN</h1>
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Verde Residences · vendor, PR, RFQ, PO, GRN. RA bills stay contractor BOQ/MB, not PO-linked.
        </p>
        <ProcurementNav />
      </header>
      {children}
    </div>
  );
}
