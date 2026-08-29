/**
 * Critical Path Method (WP-3B, 11 §2): forward/backward pass over
 * finish-to-start dependencies. Deterministic; golden-tested on a known network.
 * Durations are whole days; a schedule is only as honest as its activity list.
 */

export interface CpmActivity {
  id: string;
  durationDays: number;
  deps: string[]; // finish-to-start predecessors
}

export interface CpmResult {
  nodes: Record<string, { es: number; ef: number; ls: number; lf: number; float: number; critical: boolean }>;
  projectDuration: number;
  criticalPath: string[];
}

export function computeCpm(activities: CpmActivity[]): CpmResult {
  if (activities.length === 0) throw new RangeError("empty activity network");
  const byId = new Map(activities.map((a) => [a.id, a]));
  if (byId.size !== activities.length) throw new RangeError("duplicate activity ids");

  // cycle detection via DFS
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map(activities.map((a) => [a.id, WHITE]));
  const visit = (id: string): void => {
    const c = color.get(id)!;
    if (c === GREY) throw new RangeError(`dependency cycle at "${id}"`);
    if (c === BLACK) return;
    color.set(id, GREY);
    for (const dep of byId.get(id)?.deps ?? []) {
      if (!byId.has(dep)) throw new RangeError(`unknown dependency "${dep}" on "${id}"`);
      visit(dep);
    }
    color.set(id, BLACK);
  };
  for (const a of activities) visit(a.id);

  // topological order
  const order: string[] = [];
  const temp = new Set<string>();
  const done = new Set<string>();
  const topo = (id: string): void => {
    if (done.has(id) || temp.has(id)) return;
    temp.add(id);
    for (const dep of byId.get(id)?.deps ?? []) topo(dep);
    temp.delete(id);
    done.add(id);
    order.push(id);
  };
  for (const a of activities) topo(a.id);

  // forward pass
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const a = byId.get(id)!;
    const start = a.deps.reduce((max, dep) => Math.max(max, ef.get(dep) ?? 0), 0);
    es.set(id, start);
    ef.set(id, start + a.durationDays);
  }
  const projectDuration = Math.max(...activities.map((a) => ef.get(a.id)!));

  // backward pass
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const a = byId.get(id)!;
    const successors = activities.filter((x) => x.deps.includes(id));
    const lateFinish = successors.length === 0 ? projectDuration : Math.min(...successors.map((s) => ls.get(s.id)!));
    lf.set(id, lateFinish);
    ls.set(id, lateFinish - a.durationDays);
  }

  const nodes: CpmResult["nodes"] = {};
  const criticalPath: string[] = [];
  for (const a of activities) {
    const float = ls.get(a.id)! - es.get(a.id)!;
    const critical = float === 0;
    nodes[a.id] = { es: es.get(a.id)!, ef: ef.get(a.id)!, ls: ls.get(a.id)!, lf: lf.get(a.id)!, float, critical };
    if (critical) criticalPath.push(a.id);
  }
  return { nodes, projectDuration, criticalPath };
}

/** Standard residential high-rise template (11 §1 extract) — ready for tenants to clone. */
export function residentialHighriseActivities(): CpmActivity[] {
  return [
    { id: "mobilisation", durationDays: 30, deps: [] },
    { id: "excavation", durationDays: 45, deps: ["mobilisation"] },
    { id: "foundation", durationDays: 90, deps: ["excavation"] },
    { id: "plinth", durationDays: 25, deps: ["foundation"] },
    { id: "structure_rcc", durationDays: 252, deps: ["plinth"] }, // 18 slabs × 14 d
    { id: "blockwork", durationDays: 180, deps: ["structure_rcc"] },
    { id: "mep_roughin", durationDays: 200, deps: ["structure_rcc"] },
    { id: "waterproofing", durationDays: 40, deps: ["structure_rcc"] },
    { id: "flooring", durationDays: 144, deps: ["blockwork"] },
    { id: "joinery", durationDays: 90, deps: ["blockwork"] },
    { id: "painting", durationDays: 108, deps: ["flooring"] },
    { id: "lifts_dg_fire", durationDays: 90, deps: ["structure_rcc"] },
    { id: "external_dev", durationDays: 60, deps: ["lifts_dg_fire"] },
    { id: "testing_commissioning", durationDays: 30, deps: ["painting", "external_dev"] },
    { id: "cc_oc_possession", durationDays: 45, deps: ["testing_commissioning"] },
  ];
}
