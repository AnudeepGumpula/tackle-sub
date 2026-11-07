import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { formatDate, isValidISODate, WEEKDAYS } from "./dates.ts";
import { CURRENCIES, formatMoney } from "./money.ts";
import { parseInvoiceSentence, type ParseContext } from "./ruleParser.ts";
import { BILLING_TYPES, FLAG_FIELDS, usesRate, type FieldFlag, type Invoice, type InvoiceDraft, type Settings } from "./types.ts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

// Server-side fallback: if the model declines a request, the API re-runs it on a
// fallback model in the same call. Harmless for normal invoice traffic.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

// ---------- 1. One sentence -> invoice draft ----------

const DraftSchema = z.object({
  client_name: z.string().describe("Person or company being billed. Empty string if not mentioned; never invent one."),
  client_email: z.string().nullable().describe("Client email if mentioned or known, else null."),
  line_items: z.array(
    z.object({
      kind: z.enum(BILLING_TYPES).describe("How this line is billed: hourly, day_rate, flat_fee, milestone, deposit or retainer."),
      description: z.string().describe("Short, professional line item description, Title case first word."),
      quantity: z.number().describe("Hours for hourly, days for day_rate, otherwise 1."),
      unit_price: z.number().describe("Hourly or daily rate for hourly/day_rate; otherwise the line's full amount. Major currency units. 0 if unknown."),
    }),
  ),
  due_date: z.string().nullable().describe("YYYY-MM-DD. null if no due date or terms were mentioned."),
  tax_rate: z.number().nullable().describe("Tax percent, e.g. 8.5. null if not mentioned."),
  currency: z.string().nullable().describe("ISO 4217 code if a currency is implied, else null."),
  notes: z.string().nullable().describe("A note to print on the invoice only if the user asked for one, else null."),
  assumptions: z
    .array(z.object({ field: z.enum(FLAG_FIELDS), message: z.string() }))
    .describe("Only real guesses, each tied to the field it affects. message is a short note shown under that field, e.g. \"Matched to your client Acme Corp. Check it.\" Don't flag things the sentence stated clearly, or fields left empty."),
});

const PARSE_SYSTEM = `You turn one casual sentence from a freelancer into a structured invoice draft.
- Split work into separate line items and give each a kind:
  - hourly: "10h design at $120" means quantity 10 (hours), unit_price 120 (rate).
  - day_rate: "3 days on site at $800/day" means quantity 3 (days), unit_price 800.
  - flat_fee: "$450 for a logo refresh" means quantity 1, unit_price 450. "3 banners at $80 each" is one flat_fee line "3 banners" for 240.
  - milestone: payment tied to a project stage, e.g. "$2,000 for the wireframe milestone".
  - deposit: an up-front payment, e.g. "50% deposit of $3,000".
  - retainer: a recurring fee for ongoing work, e.g. "$1,500 November retainer".
- "$1.5k" means 1500.
- Resolve relative due dates ("Friday", "in 2 weeks", "net 30", "end of month") against today's date given below. A bare weekday means the next one after today.
- If the client matches a known client, use that exact name and their email.
- Never invent a client name, amount, rate, due date, email, or tax. Leave them empty, null or 0; the review form asks the user for required ones.
- Keep descriptions short and invoice-ready (fix typos, no filler words).`;

export async function parseWithClaude(text: string, ctx: ParseContext): Promise<InvoiceDraft> {
  const weekday = WEEKDAYS[new Date(`${ctx.today}T12:00:00`).getDay()];
  const known = (ctx.knownClients ?? []).slice(0, 100).map((c) => `- ${c.name}${c.email ? ` <${c.email}>` : ""}`).join("\n") || "(none yet)";

  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
    system: PARSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today is ${weekday}, ${ctx.today}. Default currency: ${ctx.currency}.\nKnown clients:\n${known}\n\nSentence:\n<sentence>${text}</sentence>`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Claude could not parse the sentence (stop_reason: ${response.stop_reason})`);
  }
  const out = response.parsed_output;
  const assumptions: FieldFlag[] = out.assumptions.filter((a) => a.message.trim()).map((a) => ({ field: a.field, message: a.message.trim() }));

  // Due date is required: blank if the sentence didn't give one, so the review form asks for it.
  const due_date = out.due_date && isValidISODate(out.due_date) ? out.due_date : "";
  const currency = out.currency && (CURRENCIES as readonly string[]).includes(out.currency.toUpperCase()) ? out.currency.toUpperCase() : ctx.currency;
  const line_items = out.line_items
    .filter((i) => i.description.trim())
    .map((i) => ({
      kind: i.kind,
      description: i.description.trim(),
      quantity: usesRate(i.kind) && i.quantity > 0 ? i.quantity : 1,
      unit_price: Math.max(0, i.unit_price),
    }));

  return {
    client_name: out.client_name.trim(),
    client_email: out.client_email?.trim().toLowerCase() || null,
    line_items: line_items.length ? line_items : [{ kind: "flat_fee", description: "Services", quantity: 1, unit_price: 0 }],
    due_date,
    tax_rate: out.tax_rate ?? ctx.defaultTaxRate,
    currency,
    notes: out.notes?.trim() || null,
    assumptions: assumptions.slice(0, 6),
    source: "ai",
  };
}

/** Claude first, rules as a safety net. Never throws for normal input. */
export async function parseSentence(text: string, ctx: ParseContext): Promise<{ draft: InvoiceDraft; warning?: string }> {
  if (aiEnabled()) {
    try {
      return { draft: await parseWithClaude(text, ctx) };
    } catch (err) {
      console.error("[ai] parse failed, using rule parser:", err instanceof Error ? err.message : err);
      return { draft: parseInvoiceSentence(text, ctx), warning: "AI was unavailable, so this was filled in automatically. Double-check it." };
    }
  }
  return { draft: parseInvoiceSentence(text, ctx) };
}

// ---------- 2. Payment reminder email ----------

export type ReminderTone = "friendly" | "firm" | "final";

const ReminderSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Plain-text email body. No markdown. Include the payment link exactly once."),
});

export async function draftReminder(
  invoice: Invoice,
  settings: Settings,
  payUrl: string,
  tone: ReminderTone,
  today: string,
): Promise<{ subject: string; body: string; source: "ai" | "template" }> {
  const facts = {
    from: settings.business_name,
    client: invoice.client.name,
    invoice_number: invoice.number,
    amount: formatMoney(invoice.total_cents, invoice.currency),
    due_date: formatDate(invoice.due_date),
    status: invoice.display_status,
    today: formatDate(today),
    items: invoice.line_items.map((i) => i.description),
    times_client_viewed: invoice.events.filter((e) => e.type === "viewed").length,
    previous_reminders: invoice.events.filter((e) => e.type === "reminder").length,
    pay_link: payUrl,
  };

  if (aiEnabled()) {
    try {
      const response = await anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        ...FALLBACK,
        output_config: { effort: "low", format: betaZodOutputFormat(ReminderSchema) },
        system:
          "You write short payment reminder emails for freelancers. Under 120 words. Warm and human, never groveling or passive-aggressive. Sign off with the sender's business name. Tone levels: friendly = light nudge; firm = clear and direct, mention how overdue it is; final = polite but states this is the final reminder before further steps.",
        messages: [{ role: "user", content: `Tone: ${tone}\nFacts (JSON):\n${JSON.stringify(facts, null, 2)}` }],
      });
      if (response.parsed_output && response.stop_reason !== "refusal") {
        const { subject, body } = response.parsed_output;
        const fullBody = body.includes(payUrl) ? body : `${body}\n\nPay online: ${payUrl}`;
        return { subject, body: fullBody, source: "ai" };
      }
    } catch (err) {
      console.error("[ai] reminder failed, using template:", err instanceof Error ? err.message : err);
    }
  }

  const opener = {
    friendly: `Hi ${invoice.client.name},\n\nJust a friendly reminder that invoice ${invoice.number} for ${facts.amount} is due ${facts.due_date}.`,
    firm: `Hi ${invoice.client.name},\n\nInvoice ${invoice.number} for ${facts.amount} was due ${facts.due_date} and is still open. Could you take care of it this week?`,
    final: `Hi ${invoice.client.name},\n\nThis is a final reminder that invoice ${invoice.number} for ${facts.amount} (due ${facts.due_date}) remains unpaid. Please settle it as soon as possible.`,
  }[tone];
  return {
    subject: `${tone === "final" ? "Final reminder" : "Reminder"}: invoice ${invoice.number} (${facts.amount})`,
    body: `${opener}\n\nYou can pay securely here: ${payUrl}\n\nThanks,\n${settings.business_name}`,
    source: "template",
  };
}
