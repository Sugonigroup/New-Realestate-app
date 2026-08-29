/**
 * Workflow state machine — pure transitions + SLA helpers (`03 §3`, `09 §1`).
 * States are the law: illegal transitions throw; silence never approves (`09 §3`).
 */

export type InstanceState = "draft" | "pending" | "approved" | "rejected" | "withdrawn" | "expired";

export type TaskState = "pending" | "approved" | "rejected" | "query" | "escalated" | "cancelled";

export type TaskDecision = "approve" | "reject" | "query" | "escalate";

export function applyTaskDecision(current: TaskState, decision: TaskDecision): TaskState {
  if (current !== "pending" && current !== "escalated" && current !== "query") {
    throw new RangeError(`cannot ${decision} a task in state "${current}"`);
  }
  switch (decision) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "query":
      return "query"; // back to maker; re-answer returns it to pending via reopenTask
    case "escalate":
      return "escalated";
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

export function applyInstanceStateTransition(
  current: InstanceState,
  event: "submit" | "final-approve" | "reject" | "withdraw" | "expire",
): InstanceState {
  const table: Record<InstanceState, Partial<Record<typeof event, InstanceState>>> = {
    draft: { submit: "pending", withdraw: "withdrawn" },
    pending: { "final-approve": "approved", reject: "rejected", withdraw: "withdrawn", expire: "expired" },
    approved: {},
    rejected: {},
    withdrawn: {},
    expired: {},
  };
  const next = table[current][event];
  if (!next) throw new RangeError(`illegal transition: ${current} --${event}-->`);
  return next;
}

export function slaDue(now: Date, slaMinutes: number): Date {
  return new Date(now.getTime() + slaMinutes * 60_000);
}

export function isOverdue(task: { slaDue: Date; state: TaskState }, now: Date): boolean {
  return task.state === "pending" && task.slaDue.getTime() < now.getTime();
}

/** Escalation ladder (`07-micro-management.md §7`): at 100% SLA the escalateTo role may act. */
export function mayAct(
  task: { assignedRole: string; assignedUserId?: string | null; state: TaskState; slaDue: Date },
  actor: { userId: string; roles: string[] },
  opts?: { escalateToRole?: string; delegated?: boolean },
): { allowed: boolean; reason: string } {
  if (task.state !== "pending" && task.state !== "query") {
    return { allowed: false, reason: `task is ${task.state}` };
  }
  if (task.assignedUserId && task.assignedUserId === actor.userId) return { allowed: true, reason: "assigned" };
  if (actor.roles.includes(task.assignedRole)) return { allowed: true, reason: "role" };
  if (opts?.delegated) return { allowed: true, reason: "delegated" };
  if (opts?.escalateToRole && isOverdue(task, new Date()) && actor.roles.includes(opts.escalateToRole)) {
    return { allowed: true, reason: "escalated" };
  }
  return { allowed: false, reason: "actor cannot act on this task" };
}
