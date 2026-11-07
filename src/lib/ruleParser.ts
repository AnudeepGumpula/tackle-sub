// Rule-based "one sentence" invoice parser.
// Used when no ANTHROPIC_API_KEY is configured, or if the Claude call fails,
// so the core workflow always works (important for live demos and Wren runs).

import type { DraftLineItem, InvoiceDraft } from "./types.ts";
import { addDays, endOfMonth, isValidISODate, nextWeekday, WEEKDAYS } from "./dates.ts";

export interface ParseContext {
  today: string;
  currency: string;
  defaultTaxRate: number;
  paymentTermsDays: number;
  knownClients?: { name: string; email: string | null }[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const CURRENCY_SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR" };
const SYM = "[$€£₹]";
const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k)?";

function toNumber(raw: string, k?: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

function cleanDescription(raw: string): string {
  let d = raw
    .replace(/^[\s:,-]+|[\s:,.-]+$/g, "")
    .replace(/^(?:for|of|the|a|an|on)\s+/i, "")
    .replace(/\s+(?:for|at|of)$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!d) d = "Services";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function parseLineItem(segment: string): DraftLineItem | null {
  const s = segment.trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;

  // "10h design at $120", "10 hours of design @ 120/hr", "2.5 hrs consulting x $90"
  m = s.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:h|hr|hrs|hour|hours)\\b\\s*(?:of\\s+)?(.*?)\\s*(?:at|@|x|for)\\s*${SYM}?\\s*${NUM}(?:\\s*(?:/|per)\\s*(?:h|hr|hour))?`, "i"));
  if (m) {
    return { description: cleanDescription(m[2] || "Hourly work"), quantity: parseFloat(m[1]), unit_price: toNumber(m[3], m[4]) };
  }

  // "design for 10 hours at $120"
  m = s.match(new RegExp(`(.+?)\\s+(?:for\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:h|hr|hrs|hours?)\\b\\s*(?:at|@|x)\\s*${SYM}?\\s*${NUM}`, "i"));
  if (m) {
    return { description: cleanDescription(m[1]), quantity: parseFloat(m[2]), unit_price: toNumber(m[3], m[4]) };
  }

  // "3 logos at $200 each", "3 x banner @ $50"
  m = s.match(new RegExp(`^(\\d+)\\s*(?:x\\s*)?(.+?)\\s*(?:at|@)\\s*${SYM}?\\s*${NUM}\\s*(?:each|apiece|ea)?`, "i"));
  if (m) {
    return { description: cleanDescription(m[2]), quantity: parseInt(m[1], 10), unit_price: toNumber(m[3], m[4]) };
  }

  // "$500 for logo design", "$1.5k website"
  m = s.match(new RegExp(`${SYM}\\s*${NUM}\\s*(?:for\\s+)?(.*)`, "i"));
  if (m && m[3].trim()) {
    return { description: cleanDescription(m[3]), quantity: 1, unit_price: toNumber(m[1], m[2]) };
  }

  // "logo design for $500", "website: $2,000"
  m = s.match(new RegExp(`(.+?)\\s*(?:for|at|=|:|-)?\\s*${SYM}\\s*${NUM}`, "i"));
  if (m) {
    return { description: cleanDescription(m[1]), quantity: 1, unit_price: toNumber(m[2], m[3]) };
  }

  // "logo design for 500", "website 2000 usd"
  m = s.match(/(.+?)\s+(?:for|at|=|:)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:usd|eur|gbp|inr|dollars|bucks)?\s*$/i);
  if (m && /[a-z]/i.test(m[1])) {
    return { description: cleanDescription(m[1]), quantity: 1, unit_price: toNumber(m[2], m[3]) };
  }

  return null;
}

function extractDueDate(text: string, ctx: ParseContext): { due: string | null; rest: string } {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\b(?:due|by|payable)\s+(?:on\s+|by\s+)?(\d{4}-\d{2}-\d{2})\b/i, (m) => (isValidISODate(m[1]) ? m[1] : null)],
    [/\b(?:due|payable)\s+(?:with)?in\s+(\d+)\s+(day|week)s?\b/i, (m) => addDays(ctx.today, parseInt(m[1], 10) * (m[2].toLowerCase() === "week" ? 7 : 1))],
    [/\bin\s+(\d+)\s+(day|week)s?\b/i, (m) => addDays(ctx.today, parseInt(m[1], 10) * (m[2].toLowerCase() === "week" ? 7 : 1))],
    [/\bnet\s*-?\s*(\d+)\b/i, (m) => addDays(ctx.today, parseInt(m[1], 10))],
    [/\b(?:due|by)\s+(?:on\s+)?(today|tomorrow)\b/i, (m) => addDays(ctx.today, m[1].toLowerCase() === "today" ? 0 : 1)],
    [/\b(?:due|by)\s+(?:on\s+|this\s+|next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => nextWeekday(ctx.today, WEEKDAYS.findIndex((d) => d.startsWith(m[1].toLowerCase())))],
    [/\b(?:due|by)\s+(?:the\s+)?end\s+of\s+(?:the\s+)?month\b/i, () => endOfMonth(ctx.today)],
    [/\b(?:due|by)\s+(?:on\s+)?next\s+week\b/i, () => addDays(ctx.today, 7)],
    [/\b(?:due|by)\s+(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, (m) => {
      const month = MONTHS.indexOf(m[1].toLowerCase());
      const [year] = ctx.today.split("-").map(Number);
      let iso = `${year}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      if (isValidISODate(iso) && iso < ctx.today) iso = `${year + 1}${iso.slice(4)}`;
      return isValidISODate(iso) ? iso : null;
    }],
  ];
  for (const [re, fn] of patterns) {
    const m = text.match(re);
    if (m) {
      const due = fn(m);
      if (due) return { due, rest: text.replace(m[0], " ") };
    }
  }
  return { due: null, rest: text };
}

export function parseInvoiceSentence(input: string, ctx: ParseContext): InvoiceDraft {
  const assumptions: string[] = [];
  let text = ` ${input.replace(/\s+/g, " ").trim()} `;

  // Email
  let client_email: string | null = null;
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) {
    client_email = email[0].toLowerCase();
    text = text.replace(email[0], " ").replace(/\(\s*\)|<\s*>/g, " ");
  }

  // Currency
  let currency = ctx.currency;
  const sym = text.match(/[$€£₹]/);
  const code = text.match(/\b(usd|eur|gbp|inr|cad|aud)\b/i);
  if (code) currency = code[1].toUpperCase();
  else if (sym && CURRENCY_SYMBOLS[sym[0]] && !(sym[0] === "$" && ["CAD", "AUD"].includes(ctx.currency))) currency = CURRENCY_SYMBOLS[sym[0]];

  // Tax
  let tax_rate = ctx.defaultTaxRate;
  const tax = text.match(/(?:(\d+(?:\.\d+)?)\s*%\s*(?:sales\s+)?(?:tax|vat|gst))|(?:(?:tax|vat|gst)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%)/i);
  if (tax) {
    tax_rate = parseFloat(tax[1] ?? tax[2]);
    text = text.replace(tax[0], " ");
  } else if (/\bno\s+tax\b/i.test(text)) {
    tax_rate = 0;
    text = text.replace(/\bno\s+tax\b/i, " ");
  }
  text = text.replace(/\b(?:plus|\+|with|and)\s*(?=\s*$)/i, " ");

  // Due date
  const dueResult = extractDueDate(text, ctx);
  text = dueResult.rest;
  let due_date = dueResult.due;
  if (!due_date) {
    due_date = addDays(ctx.today, ctx.paymentTermsDays);
    assumptions.push(`Due in ${ctx.paymentTermsDays} days (your default terms)`);
  }

  // Client name: "Bill Acme ...", "Invoice Jane Doe for ...", "Charge Bob $50 ..."
  let client_name = "";
  let body = text;
  const lead = text.match(/^\s*(?:please\s+)?(?:create\s+an?\s+)?(?:bill|invoice|charge|send\s+(?:an?\s+)?invoice\s+to|send)\s+(?:to\s+|for\s+)?(.+)$/i);
  if (lead) {
    const after = lead[1];
    const nameMatch = after.match(new RegExp(`^(.+?)(?=\\s+(?:for|\\d)|\\s*${SYM}|\\s*[,:;]|\\s*$)`, "i"));
    if (nameMatch) {
      client_name = nameMatch[1].trim();
      body = after.slice(nameMatch[0].length);
    }
  }
  client_name = client_name.replace(/^(?:to|for)\s+/i, "").replace(/[()<>]/g, "").replace(/\s{2,}/g, " ").trim();

  // Match against known clients (fills in their email)
  const known = ctx.knownClients?.find((c) => client_name && c.name.toLowerCase() === client_name.toLowerCase())
    ?? ctx.knownClients?.find((c) => client_name.length >= 3 && c.name.toLowerCase().includes(client_name.toLowerCase()));
  if (known) {
    client_name = known.name;
    if (!client_email && known.email) client_email = known.email;
  }
  if (!client_name) {
    client_name = "New client";
    assumptions.push("Couldn't spot a client name");
  }

  // Line items
  body = body.replace(/^\s*(?:for|:)\s*/i, " ");
  const segments = body.split(new RegExp(`\\s*(?:,|;|\\+|\\bplus\\b|\\band\\b(?=\\s*(?:\\d|${SYM}|an?\\s|one\\s)))\\s*`, "i"));
  const line_items: DraftLineItem[] = [];
  for (const seg of segments) {
    const item = parseLineItem(seg);
    if (item && item.unit_price > 0) line_items.push(item);
  }
  if (line_items.length === 0) {
    line_items.push({ description: cleanDescription(body) || "Services", quantity: 1, unit_price: 0 });
    assumptions.push("Couldn't find an amount; please enter one");
  }

  if (tax_rate === ctx.defaultTaxRate && ctx.defaultTaxRate > 0) assumptions.push(`Tax ${ctx.defaultTaxRate}% (your default)`);
  if (!client_email) assumptions.push("No client email yet");

  return { client_name, client_email, line_items, due_date, tax_rate, currency, notes: null, assumptions, source: "rules" };
}
