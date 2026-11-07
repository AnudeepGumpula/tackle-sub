import "server-only";
import { createClient, type Client as LibsqlClient, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// One database client per server process.
// Local:   file:./data/app.db (auto-created)
// Hosted:  DATABASE_URL=libsql://<db>.turso.io + DATABASE_AUTH_TOKEN (Turso free tier)
// Vercel without Turso falls back to /tmp, which works but resets on cold starts.

const globalForDb = globalThis as unknown as { __db?: LibsqlClient; __dbReady?: Promise<void> };

function resolveUrl(): string {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (url) {
    if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
    return url;
  }
  const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "app.db")}`;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL DEFAULT 'My Studio',
    business_email TEXT NOT NULL DEFAULT '',
    business_address TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'USD',
    default_tax_rate REAL NOT NULL DEFAULT 0,
    payment_terms_days INTEGER NOT NULL DEFAULT 14,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    next_number INTEGER NOT NULL DEFAULT 1001
  )`,
  `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS clients_name_idx ON clients (lower(name))`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(id),
    status TEXT NOT NULL DEFAULT 'draft',
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    currency TEXT NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    notes TEXT,
    source_text TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    paid_at TEXT,
    paid_via TEXT,
    paypal_order_id TEXT,
    paypal_capture_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS line_items_invoice_idx ON line_items (invoice_id)`,
  `CREATE INDEX IF NOT EXISTS events_invoice_idx ON events (invoice_id)`,
];

export async function db(): Promise<LibsqlClient> {
  if (!globalForDb.__db) {
    globalForDb.__db = createClient({
      url: resolveUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  if (!globalForDb.__dbReady) {
    const client = globalForDb.__db;
    globalForDb.__dbReady = client.batch(SCHEMA, "write").then(() => undefined).catch((err) => {
      globalForDb.__dbReady = undefined;
      throw err;
    });
  }
  await globalForDb.__dbReady;
  return globalForDb.__db;
}

export type Row = Record<string, InValue>;

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await (await db()).execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function get<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  await (await db()).execute({ sql, args });
}

export async function batch(statements: { sql: string; args: InValue[] }[]): Promise<void> {
  await (await db()).batch(statements, "write");
}
