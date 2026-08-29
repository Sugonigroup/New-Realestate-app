/** Routing engine — WP-1A: first matching rule wins; least-loaded user, round-robin tie-break. */

export interface RoutingRule {
  projectId?: string;
  segment?: string;
  language?: string;
  /** candidate users to load-balance across (empty/absent → assign to role queue) */
  assignToUsers?: string[];
  assignToRole?: string; // fallback when no users configured
}

export interface RoutedLead {
  projectId?: string;
  segment?: string;
  language?: string;
}

export interface RoutingResult {
  ruleIndex: number;
  assignedUserId?: string;
  assignedRole?: string;
}

/**
 * Match = every defined field of the rule equals the lead's (undefined rule
 * fields match anything). Load = current open-lead count per user; winner is
 * the least loaded with round-robin tie-break via lastAssigned order.
 */
export function route(
  lead: RoutedLead,
  rules: RoutingRule[],
  userLoad: Map<string, number>,
  lastAssigned: Map<string, number>,
): RoutingResult | null {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if (rule.projectId && rule.projectId !== lead.projectId) continue;
    if (rule.segment && rule.segment !== lead.segment) continue;
    if (rule.language && rule.language !== lead.language) continue;

    const users = rule.assignToUsers ?? [];
    if (users.length === 0) {
      return { ruleIndex: i, assignedRole: rule.assignToRole ?? "crm_executive" };
    }
    const pick = users.reduce((best, uid) => {
      const load = userLoad.get(uid) ?? 0;
      const bestLoad = userLoad.get(best) ?? 0;
      if (load !== bestLoad) return load < bestLoad ? uid : best;
      return (lastAssigned.get(uid) ?? 0) < (lastAssigned.get(best) ?? 0) ? uid : best;
    }, users[0]!);
    return { ruleIndex: i, assignedUserId: pick };
  }
  return null; // no rule matched → caller escalates to manager task
}
