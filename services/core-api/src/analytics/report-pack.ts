import { Money } from "@buildos/money-utils";

/**
 * Report pack builder (WP-5C, 13): deterministic sections from computed KPIs —
 * numbers are never invented; a section whose data is stale renders "data pending".
 */

export interface PackSection {
  title: string;
  asOf: Date; // data freshness stamp of the section's snapshot
  rows: Array<{ label: string; value: string }>;
  notes?: string[];
}

export interface BoardPack {
  title: string;
  asOf: Date;
  sections: Array<{ title: string; rows: Array<{ label: string; value: string }>; notes?: string[] }>;
  stalenessFlagged: string[];
}

const STALENESS_LIMIT_MS = 24 * 3_600_000;

export function buildBoardPack(title: string, sections: PackSection[], generatedAt: Date): BoardPack {
  const stalenessFlagged: string[] = [];
  const clean = sections.map((s) => {
    if (generatedAt.getTime() - s.asOf.getTime() > STALENESS_LIMIT_MS) {
      stalenessFlagged.push(s.title);
      return { ...s, rows: [{ label: "data", value: "pending — snapshot older than 24h" }] };
    }
    return { title: s.title, rows: s.rows, notes: s.notes };
  });
  return { title, asOf: generatedAt, sections: clean, stalenessFlagged };
}

/** Render the pack as deterministic markdown (PDF renderer consumes this). */
export function renderPackMarkdown(pack: BoardPack): string {
  const lines: string[] = [`# ${pack.title}`, ``, `As of: ${pack.asOf.toISOString()}`];
  for (const section of pack.sections) {
    lines.push(``, `## ${section.title}`);
    for (const row of section.rows) lines.push(`- ${row.label}: ${row.value}`);
    for (const note of section.notes ?? []) lines.push(`> ${note}`);
  }
  if (pack.stalenessFlagged.length) {
    lines.push(``, `> Staleness flagged: ${pack.stalenessFlagged.join(", ")}`);
  }
  return lines.join("\n");
}

/** Money formatting helper for section rows. */
export const packMoney = (paise: bigint): string => Money.fromPaise(paise).formatIndian();
