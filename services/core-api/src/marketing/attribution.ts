import { Money } from "@buildos/money-utils";

/** Attribution engine (WP-5A, FR-4.3): closed-loop lead→booking with three models. */

export interface Touch {
  leadId: string;
  ts: Date;
  channel: string;
  campaignId: string;
}

export interface BookingResult {
  leadId: string;
  valuePaise: bigint;
  bookedAt: Date;
}

export type AttributionModel = "first_touch" | "last_touch" | "linear";

export interface CampaignAttribution {
  campaignId: string;
  bookings: number;
  valuePaise: bigint;
}

/** Attribute each booking's value to campaigns per the model. */
export function attribute(touches: Touch[], bookings: BookingResult[], model: AttributionModel): CampaignAttribution[] {
  const byLead = new Map<string, Touch[]>();
  for (const t of [...touches].sort((a, b) => a.ts.getTime() - b.ts.getTime())) {
    const list = byLead.get(t.leadId) ?? [];
    list.push(t);
    byLead.set(t.leadId, list);
  }

  const out = new Map<string, CampaignAttribution>();
  const addValue = (campaignId: string, value: bigint) => {
    const cur = out.get(campaignId) ?? { campaignId, bookings: 0, valuePaise: 0n };
    cur.valuePaise += value;
    out.set(campaignId, cur);
  };
  const countBooking = (campaignId: string) => {
    const cur = out.get(campaignId) ?? { campaignId, bookings: 0, valuePaise: 0n };
    cur.bookings += 1;
    out.set(campaignId, cur);
  };

  for (const booking of bookings) {
    const touchesForLead = byLead.get(booking.leadId) ?? [];
    if (touchesForLead.length === 0) continue;

    if (model === "linear") {
      // value split equally (exact paise); booking counted once per participating campaign
      const shares = Money.fromPaise(booking.valuePaise).allocate(touchesForLead.map(() => 1));
      const participating = new Set<string>();
      touchesForLead.forEach((t, i) => {
        addValue(t.campaignId, shares[i]!.paise);
        participating.add(t.campaignId);
      });
      for (const c of participating) countBooking(c);
    } else {
      const t = model === "first_touch" ? touchesForLead[0]! : touchesForLead[touchesForLead.length - 1]!;
      addValue(t.campaignId, booking.valuePaise);
      countBooking(t.campaignId);
    }
  }
  return [...out.values()].sort((a, b) => (b.valuePaise > a.valuePaise ? 1 : -1));
}

export interface SpendRow {
  campaignId: string;
  spendPaise: bigint;
  leads: number;
}

export interface EfficiencyRow {
  campaignId: string;
  spendPaise: bigint;
  leads: number;
  cplPaise: bigint | null;
  bookings: number;
  cpbPaise: bigint | null;
}

/** CPL/CPB efficiency per campaign (null when division is by zero — never Infinity). */
export function efficiency(spend: SpendRow[], attributed: CampaignAttribution[]): EfficiencyRow[] {
  const attrBy = new Map(attributed.map((a) => [a.campaignId, a]));
  return spend.map((s) => {
    const attr = attrBy.get(s.campaignId);
    const cpl = s.leads > 0 ? s.spendPaise / BigInt(s.leads) : null;
    const cpb = attr && attr.bookings > 0 ? s.spendPaise / BigInt(attr.bookings) : null;
    return {
      campaignId: s.campaignId,
      spendPaise: s.spendPaise,
      leads: s.leads,
      cplPaise: cpl,
      bookings: attr?.bookings ?? 0,
      cpbPaise: cpb,
    };
  });
}
