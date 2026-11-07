import "server-only";
import crypto from "node:crypto";
import type { InValue } from "@libsql/client";
import { all, batch, get, run } from "./db.ts";
import { addDays, todayISO } from "./dates.ts";
import { computeTotals, lineAmountCents, toCents } from "./money.ts";
import { BILLING_TYPES, type BillingType, type Client, type DisplayStatus, type Invoice, type InvoiceEvent, type InvoiceStatus, type LineItem, type Settings } from "./types.ts";
import type { InvoiceInput } from "./validation.ts";

const nowISO = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const newPublicId = () => crypto.randomBytes(9).toString("base64url");

type Row = Record<string, unknown>;

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  const row = (await get<Row>("SELECT * FROM settings WHERE id = 1"))!;
  return {
    business_name: String(row.business_name),
    business_email: String(row.business_email),
    business_address: String(row.business_address),
    currency: String(row.currency),
    default_tax_rate: Number(row.default_tax_rate),
    payment_terms_days: Number(row.payment_terms_days),
    invoice_prefix: String(row.invoice_prefix),
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const keys = Object.keys(patch) as (keyof Settings)[];
  if (keys.length) {
    await run(
      `UPDATE settings SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = 1`,
      keys.map((k) => patch[k] as InValue),
    );
  }
  return getSettings();
}

// ---------- clients ----------

function mapClient(row: Row): Client {
  return { id: String(row.id), name: String(row.name), email: (row.email as string) ?? null, created_at: String(row.created_at) };
}

export async function listClients() {
  const today = todayISO();
  const rows = await all<Row>(
    `SELECT c.*,
       COUNT(i.id) AS invoice_count,
       COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_cents END), 0) AS paid_cents,
       COALESCE(SUM(CASE WHEN i.status = 'sent' THEN i.total_cents END), 0) AS outstanding_cents,
       COALESCE(SUM(CASE WHEN i.status = 'sent' AND i.due_date < ? THEN 1 END), 0) AS overdue_count,
       MAX(i.created_at) AS last_invoice_at
     FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
     GROUP BY c.id ORDER BY last_invoice_at DESC, c.name`,
    [today],
  );
  return rows.map((r) => ({
    ...mapClient(r),
    invoice_count: Number(r.invoice_count),
    paid_cents: Number(r.paid_cents),
    outstanding_cents: Number(r.outstanding_cents),
    overdue_count: Number(r.overdue_count),
  }));
}

export async function clientDirectory(): Promise<{ name: string; email: string | null }[]> {
  const rows = await all<Row>("SELECT name, email FROM clients ORDER BY name LIMIT 200");
  return rows.map((r) => ({ name: String(r.name), email: (r.email as string) ?? null }));
}

async function findOrCreateClient(name: string, email: string | null): Promise<Client> {
  const existing = await get<Row>("SELECT * FROM clients WHERE lower(name) = lower(?)", [name]);
  if (existing) {
    if (email && existing.email !== email) {
      await run("UPDATE clients SET email = ? WHERE id = ?", [email, String(existing.id)]);
      existing.email = email;
    }
    return mapClient(existing);
  }
  const client: Client = { id: newId(), name, email, created_at: nowISO() };
  await run("INSERT INTO clients (id, name, email, created_at) VALUES (?, ?, ?, ?)", [client.id, name, email, client.created_at]);
  return client;
}

// ---------- invoices ----------

export function displayStatus(status: InvoiceStatus, dueDate: string, today = todayISO()): DisplayStatus {
  return status === "sent" && dueDate < today ? "overdue" : status;
}

function mapInvoiceRow(row: Row, client: Client, items: LineItem[], events: InvoiceEvent[]): Invoice {
  const status = String(row.status) as InvoiceStatus;
  return {
    id: String(row.id),
    public_id: String(row.public_id),
    number: String(row.number),
    status,
    display_status: displayStatus(status, String(row.due_date)),
    client,
    issue_date: String(row.issue_date),
    due_date: String(row.due_date),
    currency: String(row.currency),
    tax_rate: Number(row.tax_rate),
    subtotal_cents: Number(row.subtotal_cents),
    tax_cents: Number(row.tax_cents),
    total_cents: Number(row.total_cents),
    notes: (row.notes as string) ?? null,
    source_text: (row.source_text as string) ?? null,
    created_at: String(row.created_at),
    sent_at: (row.sent_at as string) ?? null,
    paid_at: (row.paid_at as string) ?? null,
    paid_via: (row.paid_via as string) ?? null,
    paypal_order_id: (row.paypal_order_id as string) ?? null,
    line_items: items,
    events,
  };
}

async function loadInvoice(where: "id" | "public_id", value: string): Promise<Invoice | null> {
  const row = await get<Row>(`SELECT * FROM invoices WHERE ${where} = ?`, [value]);
  if (!row) return null;
  const [clientRow, itemRows, eventRows] = await Promise.all([
    get<Row>("SELECT * FROM clients WHERE id = ?", [String(row.client_id)]),
    all<Row>("SELECT * FROM line_items WHERE invoice_id = ? ORDER BY position", [String(row.id)]),
    all<Row>("SELECT * FROM events WHERE invoice_id = ? ORDER BY created_at DESC", [String(row.id)]),
  ]);
  const items: LineItem[] = itemRows.map((r) => ({
    id: String(r.id),
    kind: (BILLING_TYPES as readonly string[]).includes(String(r.kind)) ? (String(r.kind) as BillingType) : "flat_fee",
    description: String(r.description),
    quantity: Number(r.quantity),
    unit_price_cents: Number(r.unit_price_cents),
    amount_cents: Number(r.amount_cents),
  }));
  const events: InvoiceEvent[] = eventRows.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    message: String(r.message),
    created_at: String(r.created_at),
  }));
  return mapInvoiceRow(row, mapClient(clientRow!), items, events);
}

export const getInvoice = (id: string) => loadInvoice("id", id);
export const getInvoiceByPublicId = (publicId: string) => loadInvoice("public_id", publicId);

export interface InvoiceSummary {
  id: string;
  public_id: string;
  number: string;
  status: InvoiceStatus;
  display_status: DisplayStatus;
  client_name: string;
  client_email: string | null;
  issue_date: string;
  due_date: string;
  currency: string;
  total_cents: number;
  paid_at: string | null;
  created_at: string;
}

export async function listInvoices(): Promise<InvoiceSummary[]> {
  const rows = await all<Row>(
    `SELECT i.id, i.public_id, i.number, i.status, i.issue_date, i.due_date, i.currency, i.total_cents, i.paid_at, i.created_at,
            c.name AS client_name, c.email AS client_email
     FROM invoices i JOIN clients c ON c.id = i.client_id
     ORDER BY i.created_at DESC`,
  );
  const today = todayISO();
  return rows.map((r) => ({
    id: String(r.id),
    public_id: String(r.public_id),
    number: String(r.number),
    status: String(r.status) as InvoiceStatus,
    display_status: displayStatus(String(r.status) as InvoiceStatus, String(r.due_date), today),
    client_name: String(r.client_name),
    client_email: (r.client_email as string) ?? null,
    issue_date: String(r.issue_date),
    due_date: String(r.due_date),
    currency: String(r.currency),
    total_cents: Number(r.total_cents),
    paid_at: (r.paid_at as string) ?? null,
    created_at: String(r.created_at),
  }));
}

function lineItemStatements(invoiceId: string, items: InvoiceInput["line_items"]) {
  return items.map((item, position) => {
    const unit = toCents(item.unit_price);
    return {
      sql: "INSERT INTO line_items (id, invoice_id, position, kind, description, quantity, unit_price_cents, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [newId(), invoiceId, position, item.kind, item.description, item.quantity, unit, lineAmountCents({ quantity: item.quantity, unit_price_cents: unit })] as InValue[],
    };
  });
}

function totalsFor(input: InvoiceInput) {
  return computeTotals(input.line_items.map((i) => ({ quantity: i.quantity, unit_price_cents: toCents(i.unit_price) })), input.tax_rate);
}

function eventStatement(invoiceId: string, type: string, message: string, at = nowISO()) {
  return { sql: "INSERT INTO events (id, invoice_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)", args: [newId(), invoiceId, type, message, at] as InValue[] };
}

export async function addEvent(invoiceId: string, type: string, message: string) {
  const s = eventStatement(invoiceId, type, message);
  await run(s.sql, s.args);
}

async function allocateNumber(): Promise<string> {
  const row = await get<Row>("UPDATE settings SET next_number = next_number + 1 WHERE id = 1 RETURNING next_number - 1 AS n, invoice_prefix");
  return `${row!.invoice_prefix}${row!.n}`;
}

export async function createInvoice(input: InvoiceInput, opts: { issueDate?: string; createdAt?: string } = {}): Promise<Invoice> {
  const client = await findOrCreateClient(input.client_name, input.client_email);
  const id = newId();
  const number = await allocateNumber();
  const totals = totalsFor(input);
  const createdAt = opts.createdAt ?? nowISO();
  const status: InvoiceStatus = input.send ? "sent" : "draft";
  await batch([
    {
      sql: `INSERT INTO invoices (id, public_id, number, client_id, status, issue_date, due_date, currency, tax_rate,
              subtotal_cents, tax_cents, total_cents, notes, source_text, created_at, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, newPublicId(), number, client.id, status, opts.issueDate ?? todayISO(), input.due_date, input.currency, input.tax_rate,
        totals.subtotal_cents, totals.tax_cents, totals.total_cents, input.notes, input.source_text, createdAt, input.send ? createdAt : null],
    },
    ...lineItemStatements(id, input.line_items),
    eventStatement(id, "created", input.source_text ? `Created from: "${input.source_text}"` : "Invoice created", createdAt),
    ...(input.send ? [eventStatement(id, "sent", "Marked as sent", createdAt)] : []),
  ]);
  return (await getInvoice(id))!;
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<Invoice | null> {
  const existing = await getInvoice(id);
  if (!existing) return null;
  if (existing.status === "paid") throw new Error("Paid invoices can't be edited");
  const client = await findOrCreateClient(input.client_name, input.client_email);
  const totals = totalsFor(input);
  await batch([
    {
      sql: `UPDATE invoices SET client_id = ?, due_date = ?, currency = ?, tax_rate = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?, notes = ? WHERE id = ?`,
      args: [client.id, input.due_date, input.currency, input.tax_rate, totals.subtotal_cents, totals.tax_cents, totals.total_cents, input.notes, id],
    },
    { sql: "DELETE FROM line_items WHERE invoice_id = ?", args: [id] },
    ...lineItemStatements(id, input.line_items),
    eventStatement(id, "edited", "Invoice edited"),
  ]);
  return getInvoice(id);
}

export async function setStatus(id: string, status: Exclude<InvoiceStatus, "paid">): Promise<Invoice | null> {
  const inv = await getInvoice(id);
  if (!inv) return null;
  if (inv.status === "paid") throw new Error("This invoice is already paid");
  const sentAt = status === "sent" ? inv.sent_at ?? nowISO() : inv.sent_at;
  const label = { sent: "Marked as sent", draft: "Moved back to draft", void: "Invoice voided" }[status];
  await batch([
    { sql: "UPDATE invoices SET status = ?, sent_at = ? WHERE id = ?", args: [status, sentAt, id] },
    eventStatement(id, status, label),
  ]);
  return getInvoice(id);
}

export async function markPaid(
  id: string,
  via: "paypal" | "test" | "manual",
  details: { orderId?: string; captureId?: string; payer?: string } = {},
): Promise<Invoice | null> {
  const inv = await getInvoice(id);
  if (!inv) return null;
  if (inv.status === "paid") return inv;
  const label = {
    paypal: `Paid with PayPal${details.payer ? ` by ${details.payer}` : ""}${details.captureId ? ` (capture ${details.captureId})` : ""}`,
    test: "Paid (test payment)",
    manual: "Marked as paid manually",
  }[via];
  await batch([
    {
      sql: "UPDATE invoices SET status = 'paid', paid_at = ?, paid_via = ?, paypal_order_id = COALESCE(?, paypal_order_id), paypal_capture_id = ?, sent_at = COALESCE(sent_at, ?) WHERE id = ?",
      args: [nowISO(), via, details.orderId ?? null, details.captureId ?? null, nowISO(), id],
    },
    eventStatement(id, "paid", label),
  ]);
  return getInvoice(id);
}

export async function savePaypalOrder(id: string, orderId: string) {
  await run("UPDATE invoices SET paypal_order_id = ? WHERE id = ?", [orderId, id]);
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const inv = await get<Row>("SELECT id FROM invoices WHERE id = ?", [id]);
  if (!inv) return false;
  await batch([
    { sql: "DELETE FROM events WHERE invoice_id = ?", args: [id] },
    { sql: "DELETE FROM line_items WHERE invoice_id = ?", args: [id] },
    { sql: "DELETE FROM invoices WHERE id = ?", args: [id] },
  ]);
  return true;
}

/** Records a "viewed" event at most once per hour so the timeline stays readable. */
export async function recordView(id: string) {
  const recent = await get<Row>(
    "SELECT id FROM events WHERE invoice_id = ? AND type = 'viewed' AND created_at > ?",
    [id, new Date(Date.now() - 3_600_000).toISOString()],
  );
  if (!recent) await addEvent(id, "viewed", "Client opened the invoice");
}

// ---------- dashboard ----------

export async function dashboardStats() {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const row = (await get<Row>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'sent' THEN total_cents END), 0) AS outstanding_cents,
       COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < ? THEN total_cents END), 0) AS overdue_cents,
       COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < ? THEN 1 END), 0) AS overdue_count,
       COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= ? THEN total_cents END), 0) AS paid_this_month_cents,
       COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 END), 0) AS draft_count,
       COUNT(*) AS invoice_count,
       MIN(created_at) AS first_created_at
     FROM invoices`,
    [today, today, monthStart],
  ))!;
  return {
    outstanding_cents: Number(row.outstanding_cents),
    overdue_cents: Number(row.overdue_cents),
    overdue_count: Number(row.overdue_count),
    paid_this_month_cents: Number(row.paid_this_month_cents),
    draft_count: Number(row.draft_count),
    invoice_count: Number(row.invoice_count),
    first_created_at: (row.first_created_at as string) ?? null,
  };
}

// ---------- demo data ----------

export async function resetAll() {
  await batch([
    { sql: "DELETE FROM events", args: [] },
    { sql: "DELETE FROM line_items", args: [] },
    { sql: "DELETE FROM invoices", args: [] },
    { sql: "DELETE FROM clients", args: [] },
    { sql: "UPDATE settings SET next_number = 1001 WHERE id = 1", args: [] },
  ]);
}

export async function seedDemo() {
  const today = todayISO();
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const s = await getSettings();
  if (s.business_name === "My Studio") await updateSettings({ business_name: "Northwind Design Studio", business_email: "hello@northwind.design" });

  const paid = await createInvoice(
    { client_name: "Acme Corp", client_email: "ap@acme.example", line_items: [{ kind: "flat_fee", description: "Brand identity package", quantity: 1, unit_price: 2400 }, { kind: "flat_fee", description: "3 revisions", quantity: 1, unit_price: 360 }], due_date: addDays(today, -10), tax_rate: 0, currency: "USD", notes: null, source_text: "Bill Acme Corp $2400 for brand identity package and 3 revisions at $120, due in 14 days", send: true },
    { issueDate: addDays(today, -24), createdAt: ago(24) },
  );
  await markPaid(paid.id, "manual");

  await createInvoice(
    { client_name: "Globex", client_email: "billing@globex.example", line_items: [{ kind: "milestone", description: "Landing page build: launch milestone", quantity: 1, unit_price: 1800 }], due_date: addDays(today, -4), tax_rate: 0, currency: "USD", notes: "Thanks for the great project!", source_text: null, send: true },
    { issueDate: addDays(today, -18), createdAt: ago(18) },
  );
  await createInvoice(
    { client_name: "Initech", client_email: "peter@initech.example", line_items: [{ kind: "hourly", description: "UX audit", quantity: 12, unit_price: 110 }], due_date: addDays(today, 9), tax_rate: 8, currency: "USD", notes: null, source_text: "Invoice Initech 12 hours UX audit at $110, 8% tax", send: true },
    { issueDate: addDays(today, -5), createdAt: ago(5) },
  );
  await createInvoice(
    { client_name: "Hooli", client_email: null, line_items: [{ kind: "day_rate", description: "Pitch deck design sprint", quantity: 2, unit_price: 475 }], due_date: addDays(today, 14), tax_rate: 0, currency: "USD", notes: null, source_text: null },
    { createdAt: ago(1) },
  );
}
