export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type DisplayStatus = InvoiceStatus | "overdue";

/** A line item as typed/edited in the UI. Prices are in major units (dollars). */
export interface DraftLineItem {
  description: string;
  quantity: number;
  unit_price: number;
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
  /** Things the parser guessed, shown to the user as chips. */
  assumptions: string[];
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
