import "server-only";
import { get, run } from "./db.ts";

// Small key/value store for app-level preferences (savings counter, import info).
// Kept in its own table so it never collides with the core schema in db.ts.

let ready: Promise<void> | null = null;
function ensure() {
  ready ??= run("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export async function getMeta(key: string): Promise<string | null> {
  await ensure();
  const row = await get<{ value: string }>("SELECT value FROM app_meta WHERE key = ?", [key]);
  return row ? String(row.value) : null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await ensure();
  await run("INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function setMetaIfMissing(key: string, value: string): Promise<void> {
  await ensure();
  await run("INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)", [key, value]);
}
