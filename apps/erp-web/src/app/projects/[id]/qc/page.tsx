import { cookies } from "next/headers";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { StatusChip } from "../../project-nav";
import { ClearanceButtons, PourCardForm } from "./pour-form";

interface CubeTest { sampleNo: string; testingAgeDays: number; isPassed: boolean; actualNmm2: unknown; }
interface PourCard {
  id: string;
  pourNo: string;
  locationElement: string;
  concreteGrade: string;
  targetVolumeCum: unknown;
  rebarCleared: boolean;
  shutterCleared: boolean;
  mepCleared: boolean;
  qcCleared: boolean;
  status: string;
  cubeTests?: CubeTest[];
}

/** QC / pour cards (11 §7): 4-point clearance gate. */
export default async function QcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let cards: PourCard[] = [];
  try {
    cards = (await serverApi(token).get<PourCard[]>(`/v1/siteops/quality/pour-cards?projectId=${projectId}`)) ?? [];
  } catch {
    /* degraded */
  }
  const approved = cards.filter((c) => c.status === "approved").length;

  return (
    <main className="p-6">
      <h2 className="mb-4 text-lg font-semibold">QC & pour cards</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Pour cards" value={cards.length} />
        <StatCard label="Approved" value={approved} tone="success" />
        <StatCard label="Pending clearances" value={cards.length - approved} tone={cards.length - approved ? "warning" : "success"} />
      </div>

      <PourCardForm projectId={projectId} />

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["Pour", "Element", "Grade", "m3", "Clearances", "Status", "Cubes"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{c.pourNo}</td>
                <td className="px-3 py-2">{c.locationElement}</td>
                <td className="px-3 py-2">{c.concreteGrade}</td>
                <td className="px-3 py-2">{String(c.targetVolumeCum)}</td>
                <td className="px-3 py-2"><ClearanceButtons pourNo={c.pourNo} card={c} /></td>
                <td className="px-3 py-2"><StatusChip label={c.status} tone={c.status === "approved" ? "success" : "warning"} /></td>
                <td className="px-3 py-2" style={{ color: "var(--bo-text-muted)" }}>
                  {(c.cubeTests ?? []).map((t) => `${t.testingAgeDays}d ${t.isPassed ? "pass" : "fail"}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No pour cards. Open NCRs and open pours block milestone certification.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
