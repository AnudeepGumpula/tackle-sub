// Turns an invoice or client CSV export (FreshBooks, QuickBooks, Wave, or anything similar)
// into rows OneLine can import. Pure functions only, so it is easy to test.

export type ImportSource = "freshbooks" | "quickbooks" | "wave" | "other";

export const IMPORT_SOURCES: { key: ImportSource; label: string }[] = [
  { key: "freshbooks", label: "FreshBooks" },
  { key: "quickbooks", label: "QuickBooks" },
  { key: "wave", label: "Wave" },
  { key: "other", label: "Another tool / spreadsheet" },
];

export type ImportStatus = "open" | "paid" | "draft";

export interface ImportRow {
  line: number;
  client_name: string;
  client_email: string | null;
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  amount: number;
  currency: string | null;
  status: ImportStatus;
  description: string | null;
}

export interface ImportPreview {
  kind: "invoices" | "clients";
  columns: Partial<Record<Field, string>>;
  rows: ImportRow[];
  clients: { name: string; email: string | null }[];
  skipped: { line: number; reason: string }[];
}

type Field = "client" | "email" | "number" | "issue" | "due" | "paid" | "total" | "balance" | "status" | "currency" | "description";

// Header aliases, compared after lowercasing and removing everything but letters/digits.
const ALIASES: Record<Field, string[]> = {
  client: ["client", "clientname", "customer", "customername", "organization", "organisation", "company", "companyname", "billto", "contact", "contactname", "name", "fullname", "displayname"],
  email: ["email", "clientemail", "customeremail", "emailaddress", "contactemail", "billingemail", "mainemail"],
  number: ["invoice", "invoicenumber", "invoiceno", "invoicenum", "invoiceid", "number", "no", "num", "ref", "reference", "docnumber", "transactionno"],
  issue: ["date", "issuedate", "dateissued", "invoicedate", "createddate", "datecreated", "created", "txndate", "transactiondate"],
  due: ["duedate", "datedue", "due", "paymentdue"],
  paid: ["datepaid", "paiddate", "paymentdate", "lastpaymentdate", "paidon"],
  total: ["total", "amount", "invoicetotal", "totalamount", "invoiceamount", "grandtotal", "totaldue"],
  balance: ["balance", "balancedue", "outstanding", "amountoutstanding", "amountdue", "openbalance", "duebalance", "remaining", "outstandingamount"],
  status: ["status", "invoicestatus", "state", "paymentstatus"],
  currency: ["currency", "currencycode"],
  description: ["description", "item", "items", "memo", "notes", "service", "lineitem", "itemdescription", "productservice"],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** RFC 4180-style parser: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src);
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

function mapColumns(header: string[]): Partial<Record<Field, number>> {
  const normalized = header.map(norm);
  const map: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  // More specific fields first so "Due Date" isn't taken by "date", "Client Email" by "client", etc.
  const order: Field[] = ["email", "due", "paid", "balance", "number", "currency", "status", "issue", "total", "client", "description"];
  for (const f of order) {
    for (const alias of ALIASES[f]) {
      const idx = normalized.findIndex((h, i) => !used.has(i) && h === alias);
      if (idx >= 0) {
        map[f] = idx;
        used.add(idx);
        break;
      }
    }
  }
  // "First Name" + "Last Name" style client exports
  if (map.client === undefined) {
    const first = normalized.findIndex((h) => h === "firstname");
    if (first >= 0) map.client = first;
  }
  return map;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Accepts 2026-11-07, 11/07/2026 (US order), 07.11.2026, Nov 7 2026, 7 Nov 2026. Returns YYYY-MM-DD or null. */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) [m, d, y] = [+match[1], +match[2], +match[3]];
  else if ((match = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else if ((match = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) [m, d, y] = [MONTHS.indexOf(match[1].toLowerCase()) + 1, +match[2], +match[3]];
  else if ((match = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/i))) [d, m, y] = [+match[1], MONTHS.indexOf(match[2].toLowerCase()) + 1, +match[3]];
  else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** "$1,200.50", "1.200,50 €", "(45.00)", "USD 300" -> number; negatives and junk -> null. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (/^\(.*\)$/.test(s) || s.startsWith("-")) return null;
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  // European format: 1.200,50
  if (/,\d{1,2}$/.test(s) && (s.match(/,/g)?.length ?? 0) === 1) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseStatus(raw: string | undefined, total: number | null, balance: number | null): ImportStatus | "void" {
  const s = (raw ?? "").toLowerCase();
  if (/void|cancel|delet|write.?off|written/.test(s)) return "void";
  if (/draft/.test(s)) return "draft";
  if (/^(paid|closed|complete|completed|fully paid|auto.?paid)$/.test(s.trim()) || (s.includes("paid") && !/unpaid|partial|part/.test(s))) return "paid";
  if (!s && balance !== null && total !== null && balance === 0 && total > 0) return "paid";
  return "open";
}

const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"];

export function buildPreview(text: string): ImportPreview {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("That file has no data rows. Export your invoices (or clients) as CSV and try again.");
  const [header, ...body] = table;
  const cols = mapColumns(header);
  if (cols.client === undefined) {
    throw new Error(`Couldn't find a client/customer column. Columns found: ${header.slice(0, 12).join(", ")}`);
  }
  const hasAmounts = cols.total !== undefined || cols.balance !== undefined;
  const columns: Partial<Record<Field, string>> = {};
  for (const [f, i] of Object.entries(cols)) columns[f as Field] = header[i as number];

  const firstNameIdx = header.map(norm).findIndex((h) => h === "firstname");
  const lastNameIdx = header.map(norm).findIndex((h) => h === "lastname");
  const personName = (r: string[]) => [firstNameIdx, lastNameIdx].filter((i) => i >= 0 && i !== cols.client).map((i) => r[i] ?? "").join(" ").trim();
  const get = (r: string[], f: Field) => (cols[f] === undefined ? undefined : r[cols[f]!]);
  const rows: ImportRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const clientMap = new Map<string, { name: string; email: string | null }>();

  body.forEach((r, i) => {
    const line = i + 2;
    let name = (get(r, "client") ?? "").trim();
    if (cols.client === firstNameIdx) name = `${name} ${personName(r)}`;
    else if (!name) name = personName(r);
    name = name.replace(/\s+/g, " ").trim();
    if (!name) return skipped.push({ line, reason: "No client name" });
    if (/^(total|totals|grand total|subtotal)$/i.test(name)) return; // summary rows in report exports
    const emailRaw = (get(r, "email") ?? "").trim().toLowerCase();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
    const key = name.toLowerCase();
    const known = clientMap.get(key);
    if (!known) clientMap.set(key, { name, email });
    else if (!known.email && email) known.email = email;

    if (!hasAmounts) return;
    const total = parseAmount(get(r, "total"));
    const balance = parseAmount(get(r, "balance"));
    const status = parseStatus(get(r, "status"), total, balance);
    if (status === "void") return skipped.push({ line, reason: "Voided or cancelled" });
    const amount = status === "paid" ? total ?? balance : balance && balance > 0 ? balance : total;
    if (!amount || amount <= 0) return skipped.push({ line, reason: "No amount" });
    const cur = (get(r, "currency") ?? "").toUpperCase().trim();
    rows.push({
      line,
      client_name: name,
      client_email: email,
      number: (get(r, "number") ?? "").trim() || null,
      issue_date: parseDate(get(r, "issue")),
      due_date: parseDate(get(r, "due")),
      paid_date: parseDate(get(r, "paid")),
      amount,
      currency: CURRENCY_CODES.includes(cur) ? cur : null,
      status,
      description: (get(r, "description") ?? "").trim().slice(0, 300) || null,
    });
  });

  return { kind: hasAmounts ? "invoices" : "clients", columns, rows, clients: [...clientMap.values()], skipped };
}

export const SAMPLE_FRESHBOOKS_CSV = `Invoice #,Client Name,Client Email,Date Issued,Due Date,Status,Invoice Total,Outstanding,Currency,Description
0042,Brightside Bakery,orders@brightside.example,2026-10-01,2026-10-31,Paid,"1,250.00",0.00,USD,Menu redesign
0043,Lumen Labs,ap@lumenlabs.example,2026-10-20,2026-11-19,Sent,"3,400.00","3,400.00",USD,Website build - phase 1
0044,Harbor Yoga,hello@harboryoga.example,2026-10-05,2026-10-20,Overdue,480.00,480.00,USD,Class schedule posters
0045,Lumen Labs,ap@lumenlabs.example,2026-11-02,2026-12-02,Partial,"1,800.00",900.00,USD,Website build - phase 2
0046,Old Client Co,,2026-09-01,2026-09-30,Void,700.00,0.00,USD,Cancelled project
`;
