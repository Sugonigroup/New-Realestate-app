import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import JournalForm from "./journal-form";

interface Account { code: string; name: string; isPostable: boolean }

export default async function NewJournalPage() {
  const token = (await cookies()).get("access_token")?.value;
  let accounts: Account[] = [];
  try {
    accounts = ((await serverApi(token).get<Account[]>("/v1/gl/accounts")) ?? []).filter((a) => a.isPostable);
  } catch { /* degraded */ }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h2 className="mb-1 text-lg font-semibold">Journal entry</h2>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Debits must equal credits. Amounts in INR; stored as paise. Period must be open.
      </p>
      <JournalForm accounts={accounts} />
    </main>
  );
}
