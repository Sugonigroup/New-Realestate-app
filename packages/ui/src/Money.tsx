import { Money } from "@buildos/money-utils";

/** Money display — always via money-utils; tabular numerals, no ad-hoc formatting (04 §2). */
export function MoneyText({
  paise,
  short = false,
  className,
}: {
  paise: bigint | string;
  short?: boolean;
  className?: string;
}) {
  const m = Money.fromPaise(typeof paise === "string" ? BigInt(paise) : paise);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {short ? m.toShort() : m.formatIndian()}
    </span>
  );
}
