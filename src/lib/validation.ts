import { z } from "zod";
import { isValidISODate } from "./dates.ts";
import { CURRENCIES } from "./money.ts";
import { BILLING_TYPES, usesRate } from "./types.ts";

export const lineItemInput = z
  .object({
    kind: z.enum(BILLING_TYPES).default("flat_fee"),
    description: z.string().trim().min(1, "Each line item needs a description").max(300),
    quantity: z.coerce.number().positive("Hours or days must be more than 0").max(1_000_000),
    unit_price: z.coerce.number().positive("Each line needs a rate or amount").max(10_000_000),
  })
  // Single-amount lines always have quantity 1.
  .transform((i) => (usesRate(i.kind) ? i : { ...i, quantity: 1 }));

export const invoiceInput = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(200),
  client_email: z
    .string()
    .trim()
    .max(320)
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Client email looks invalid"),
  line_items: z.array(lineItemInput).min(1, "Add at least one line item").max(100),
  due_date: z.string().refine((v) => v !== "", "Due date is required").refine((v) => v === "" || isValidISODate(v), "Due date must be YYYY-MM-DD"),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  currency: z.enum(CURRENCIES).default("USD"),
  notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
  source_text: z.string().trim().max(2000).nullish().transform((v) => v || null),
  send: z.boolean().optional(),
});

export type InvoiceInput = z.infer<typeof invoiceInput>;

export const settingsInput = z.object({
  business_name: z.string().trim().min(1).max(200),
  business_email: z.string().trim().max(320),
  business_address: z.string().trim().max(1000),
  currency: z.enum(CURRENCIES),
  default_tax_rate: z.coerce.number().min(0).max(100),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  invoice_prefix: z.string().trim().max(20),
}).partial();

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
