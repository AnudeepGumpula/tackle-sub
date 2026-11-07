export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type DisplayStatus = InvoiceStatus | "overdue";

/** How a freelancer charges for a line. Hourly and day rate use quantity x rate; the rest are a single amount. */
export const BILLING_TYPES = ["hourly", "day_rate", "flat_fee", "milestone", "deposit", "retainer"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  hourly: "Hourly",
  day_rate: "Day rate",
  flat_fee: "Flat fee",
  milestone: "Milestone",
  deposit: "Deposit",
  retainer: "Retainer",
};

/** Hourly and day-rate lines have a quantity and a rate; every other type is one amount (quantity 1). */
export function usesRate(kind: BillingType): boolean {
  return kind === "hourly" || kind === "day_rate";
}

/** A line item as typed/edited in the UI. Prices are in major units (dollars). */
export interface DraftLineItem {
  kind: BillingType;
  description: string;
  /** Hours or days for rate-based lines; 1 otherwise. */
  quantity: number;
  /** The rate for rate-based lines; the amount otherwise. */
  unit_price: number;
}

/** Fields the parser can flag, so the review form shows the note on that field. */
export const FLAG_FIELDS = ["client_name", "client_email", "line_items", "due_date", "tax_rate", "currency"] as const;
export type FlagField = (typeof FLAG_FIELDS)[number];

export interface FieldFlag {
  field: FlagField;
  message: string;
}

/** What the "one sentence" parser returns; the user reviews it before saving. */
export interface InvoiceDraft {
  client_name: string;
  client_email: string | null;
  line_items: DraftLineItem[];
  /** YYYY-MM-DD */
  due_date: string;
  /** Percent, e.g. 8.5 */
  tax_rate: number;
  currency: string;
  notes: string | null;
  /** Things the parser guessed, shown under the field they belong to. */
  assumptions: FieldFlag[];
  source: "ai" | "rules";
}

export interface Settings {
  business_name: string;
  business_email: string;
  business_address: string;
  currency: string;
  default_tax_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
}

export interface LineItem {
  id: string;
  kind: BillingType;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
}

export interface InvoiceEvent {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  public_id: string;
  number: string;
  status: InvoiceStatus;
  display_status: DisplayStatus;
  client: Client;
  issue_date: string;
  due_date: string;
  currency: string;
  tax_rate: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  source_text: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  paid_via: string | null;
  paypal_order_id: string | null;
  line_items: LineItem[];
  events: InvoiceEvent[];
}
