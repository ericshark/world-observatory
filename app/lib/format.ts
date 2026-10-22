const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatInteger(value: number): string {
  return integer.format(Math.floor(value));
}

export function formatRate(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude < 1) return twoDecimals.format(value);
  return magnitude < 10 ? oneDecimal.format(value) : integer.format(value);
}

export function formatSignedRate(value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatRate(Math.abs(value))}`;
}

export function formatSignedInteger(value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatInteger(Math.abs(value))}`;
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}
