import "server-only";
import crypto from "node:crypto";
import { batch, get, run } from "./db.ts";
import { addDays, todayISO } from "./dates.ts";
import { buildPreview, IMPORT_SOURCES, type ImportPreview, type ImportSource } from "./csvImport.ts";
import { setMeta, setMetaIfMissing } from "./meta.ts";
import { TOOLS } from "./savings.ts";
import { createInvoice, getSettings } from "./store.ts";
import { invoiceInput } from "./validation.ts";

export const MAX_IMPORT_ROWS = 1000;

export interface ImportResult {
  invoices_created: number;
  clients_created: number;
  duplicates: number;
  paid: number;
  open: number;
  drafts: number;
  outstanding: number;
  errors: { line: number; reason: string }[];
}

export function previewImport(csv: string): ImportPreview {
  const preview = buildPreview(csv);
  if (preview.rows.length > MAX_IMPORT_ROWS || preview.clients.length > MAX_IMPORT_ROWS) {
    throw new Error(`That's more than ${MAX_IMPORT_ROWS} rows. Split the file and import it in parts.`);
  }
  return preview;
}

async function ensureClient(name: string, email: string | null): Promise<boolean> {
  const existing = await get<{ id: string; email: string | null }>("SELECT id, email FROM clients WHERE lower(name) = lower(?)", [name]);
  if (existing) {
    if (email && !existing.email) await run("UPDATE clients SET email = ? WHERE id = ?", [email, String(existing.id)]);
    return false;
  }
  await run("INSERT INTO clients (id, name, email, created_at) VALUES (?, ?, ?, ?)", [crypto.randomUUID(), name, email, new Date().toISOString()]);
  return true;
}

export async function runImport(csv: string, source: ImportSource): Promise<ImportResult> {
  const preview = previewImport(csv);
  const label = IMPORT_SOURCES.find((s) => s.key === source)?.label ?? "CSV";
  const settings = await getSettings();
  const today = todayISO();
  const result: ImportResult = { invoices_created: 0, clients_created: 0, duplicates: 0, paid: 0, open: 0, drafts: 0, outstanding: 0, errors: [...preview.skipped] };

  for (const c of preview.clients) {
    if (await ensureClient(c.name, c.email)) result.clients_created++;
  }

  for (const row of preview.rows) {
    // source_text marks where an invoice came from, and lets a re-import skip what is already here.
    const marker = `Imported from ${label}${row.number ? ` (#${row.number})` : ` (row ${row.line}, ${row.client_name}, ${row.amount})`}`;
    if (await get("SELECT id FROM invoices WHERE source_text = ?", [marker])) {
      result.duplicates++;
      continue;
    }
    try {
      const issue = row.issue_date ?? today;
      const input = invoiceInput.parse({
        client_name: row.client_name,
        client_email: row.client_email,
        // One line per imported invoice keeps the total exact. "kind" is used by the billing-type
        // version of the editor and ignored by older schemas.
        line_items: [{ kind: "flat_fee", description: row.description ?? (row.number ? `Invoice ${row.number}` : "Services"), quantity: 1, unit_price: row.amount }],
        due_date: row.due_date ?? addDays(issue, settings.payment_terms_days),
        tax_rate: 0,
        currency: row.currency ?? settings.currency,
        notes: null,
        source_text: marker,
        send: row.status !== "draft",
      });
      const invoice = await createInvoice(input, { issueDate: issue, createdAt: new Date(`${issue}T12:00:00Z`).toISOString() });
      const updates: { sql: string; args: (string | null)[] }[] = [];
      if (row.number) {
        const clash = await get("SELECT id FROM invoices WHERE number = ? AND id <> ?", [row.number, invoice.id]);
        if (!clash) updates.push({ sql: "UPDATE invoices SET number = ? WHERE id = ?", args: [row.number, invoice.id] });
      }
      if (row.status === "paid") {
        const paidAt = new Date(`${row.paid_date ?? row.due_date ?? issue}T12:00:00Z`).toISOString();
        updates.push({ sql: "UPDATE invoices SET status = 'paid', paid_at = ?, paid_via = 'import' WHERE id = ?", args: [paidAt, invoice.id] });
        result.paid++;
      } else if (row.status === "draft") result.drafts++;
      else {
        result.open++;
        result.outstanding += row.amount;
      }
      updates.push({
        sql: "INSERT INTO events (id, invoice_id, type, message, created_at) VALUES (?, ?, 'imported', ?, ?)",
        args: [crypto.randomUUID(), invoice.id, `Imported from ${label}${row.status === "paid" ? " (already paid)" : ""}`, new Date().toISOString()],
      });
      await batch(updates);
      result.invoices_created++;
    } catch (err) {
      result.errors.push({ line: row.line, reason: err instanceof Error ? err.message.split("\n")[0].slice(0, 140) : "Could not import" });
    }
  }

  // Point the savings counter at the tool you came from, unless you already chose one.
  // switched_at keeps the first day you used OneLine, so re-imports don't reset your savings.
  if (result.invoices_created + result.clients_created > 0) {
    const tool = TOOLS.find((t) => t.key === source);
    if (tool && source !== "other") {
      await setMetaIfMissing("savings_tool", tool.key);
      await setMetaIfMissing("savings_monthly", String(tool.monthly));
    }
    await setMetaIfMissing("switched_at", new Date().toISOString());
    await setMeta("imported_from", label);
  }
  result.outstanding = Math.round(result.outstanding * 100) / 100;
  return result;
}
