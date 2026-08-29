import { Money } from "@buildos/money-utils";

/**
 * Pricing engine (WP-1C, FR-3.2): line-wise unit price computation.
 * Deterministic only — the same inputs must always produce the same paise
 * (golden-tested). No LLM, no floats in the money path.
 */

export interface PriceListShape {
  baseRatePaise: bigint; // per sqm of SBA
  floorRisePaise: bigint; // per sqm per floor above ground
  viewPremiumPaise: bigint; // per sqm
  plcPaise: bigint; // flat
  edcPaise: bigint;
  idcPaise: bigint;
  clubPaise: bigint;
  corpusPaise: bigint;
  gstRateBps: number;
}

export interface UnitPricingShape {
  sbaSqm: string; // decimal string, e.g. "138.75"
  floor: number; // ground = 0
  hasView?: boolean;
}

export interface PriceBreakdown {
  lines: Array<{ key: string; label: string; amount: Money }>;
  base: Money;
  floorRise: Money;
  view: Money;
  plc: Money;
  edc: Money;
  idc: Money;
  club: Money;
  corpus: Money;
  subtotal: Money; // excl. GST
  gst: Money;
  total: Money; // incl. GST
}

function perSqm(ratePaise: bigint, sbaSqm: string): Money {
  return Money.fromPaise(ratePaise).multiply(sbaSqm);
}

export function computeUnitPrice(priceList: PriceListShape, unit: UnitPricingShape): PriceBreakdown {
  if (unit.sbaSqm === undefined || unit.sbaSqm === null) throw new TypeError("SBA area is required for pricing");
  const sba = Number(unit.sbaSqm);
  if (!Number.isFinite(sba) || sba <= 0) throw new TypeError(`invalid SBA: ${unit.sbaSqm}`);
  if (unit.floor < 0) throw new TypeError(`invalid floor: ${unit.floor}`);

  const base = perSqm(priceList.baseRatePaise, unit.sbaSqm);
  const floorRise = unit.floor > 0 ? perSqm(priceList.floorRisePaise, unit.sbaSqm).multiply(unit.floor) : Money.zero();
  const view = unit.hasView ? perSqm(priceList.viewPremiumPaise, unit.sbaSqm) : Money.zero();
  const plc = Money.fromPaise(priceList.plcPaise);
  const edc = Money.fromPaise(priceList.edcPaise);
  const idc = Money.fromPaise(priceList.idcPaise);
  const club = Money.fromPaise(priceList.clubPaise);
  const corpus = Money.fromPaise(priceList.corpusPaise);

  // GST applies to the construction value (base+floorRise+view+PLC); flat EDC/IDC
  // are treated as part of the taxable value per UTC composition practice — kept
  // configurable via gstRateBps=0 for exempt contexts.
  const taxable = Money.sum([base, floorRise, view, plc, edc, idc]);
  const gst = taxable.percent(priceList.gstRateBps / 100);

  const lines = [
    { key: "base", label: "Base price (SBA × rate)", amount: base },
    { key: "floor_rise", label: "Floor rise", amount: floorRise },
    { key: "view", label: "View premium", amount: view },
    { key: "plc", label: "Preferential location charges", amount: plc },
    { key: "edc", label: "External development charges", amount: edc },
    { key: "idc", label: "Internal development charges", amount: idc },
    { key: "club", label: "Club membership", amount: club },
    { key: "corpus", label: "Corpus fund", amount: corpus },
    { key: "gst", label: `GST @ ${priceList.gstRateBps / 100}%`, amount: gst },
  ].filter((l) => !l.amount.isZero() || l.key === "base");

  const total = Money.sum([taxable, club, corpus, gst]);
  return { lines, base, floorRise, view, plc, edc, idc, club, corpus, subtotal: taxable.add(club).add(corpus), gst, total };
}
