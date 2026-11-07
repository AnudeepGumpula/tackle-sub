export function toCents(amount: number): number {
  return Math.round((Number.isFinite(amount) ? amount : 0) * 100);
}

export function formatMoney(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** PayPal wants a plain decimal string, e.g. "1200.00". */
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface TotalsInput {
  quantity: number;
  unit_price_cents: number;
}

export function lineAmountCents(item: TotalsInput): number {
  return Math.round(item.quantity * item.unit_price_cents);
}

export function computeTotals(items: TotalsInput[], taxRatePercent: number) {
  const subtotal = items.reduce((sum, item) => sum + lineAmountCents(item), 0);
  const tax = Math.round((subtotal * (taxRatePercent || 0)) / 100);
  return { subtotal_cents: subtotal, tax_cents: tax, total_cents: subtotal + tax };
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"] as const;
