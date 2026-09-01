import { FinanceNav } from "./finance-nav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          Finance · books of record
        </p>
        <h1 className="text-xl font-semibold">General ledger</h1>
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Shree Developers · Verde Residences ₹100 Cr GDV · FY 2026-27 · Tally is export only
        </p>
        <FinanceNav />
      </header>
      {children}
    </div>
  );
}
