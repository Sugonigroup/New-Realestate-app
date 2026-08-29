import { Money } from "@buildos/money-utils";

/** FIFO receipt allocation against open demands (FR-7.3: oldest demand first). */

export interface OpenDemand {
  id: string;
  amountPaise: bigint;
  paidPaise: bigint;
  dueDate: Date | null;
  status?: string;
}

export interface DemandAllocation {
  demandId: string;
  amountPaise: bigint;
  fullySettled: boolean;
}

export interface AllocationResult {
  allocations: DemandAllocation[];
  unallocated: Money; // advance if receipt exceeds open demands
}

export function allocateFifo(demands: OpenDemand[], receipt: Money): AllocationResult {
  const ordered = [...demands]
    .filter((d) => d.amountPaise - d.paidPaise > 0n)
    .sort((a, b) => {
      const aKey = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bKey = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aKey - bKey;
    });

  let remaining = receipt.paise;
  const allocations: DemandAllocation[] = [];
  for (const d of ordered) {
    if (remaining <= 0n) break;
    const outstanding = d.amountPaise - d.paidPaise;
    const applied = outstanding <= remaining ? outstanding : remaining;
    allocations.push({ demandId: d.id, amountPaise: applied, fullySettled: applied === outstanding });
    remaining -= applied;
  }
  return { allocations, unallocated: Money.fromPaise(remaining) };
}

/** Outstanding principal on a demand after allocations (interest base). */
export function outstandingPaise(d: OpenDemand): bigint {
  const out = d.amountPaise - d.paidPaise;
  return out > 0n ? out : 0n;
}
