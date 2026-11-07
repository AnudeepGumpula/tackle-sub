import "server-only";
import { get } from "./db.ts";
import { getMeta, setMeta, setMetaIfMissing } from "./meta.ts";

// "You've saved $X vs FreshBooks": the subscription you no longer pay, counted per month.
// Prices are typical monthly list prices for the entry plan; the user can edit them.

export interface Tool { key: string; label: string; monthly: number }

export const TOOLS: Tool[] = [
  { key: "freshbooks", label: "FreshBooks", monthly: 21 },
  { key: "quickbooks", label: "QuickBooks", monthly: 38 },
  { key: "bonsai", label: "Bonsai", monthly: 25 },
  { key: "honeybook", label: "HoneyBook", monthly: 36 },
  { key: "wave", label: "Wave Pro", monthly: 16 },
  { key: "other", label: "my old tool", monthly: 20 },
];

export interface Savings {
  tool: Tool;
  monthly: number;
  since: string; // ISO date
  months: number;
  saved: number;
  yearly: number;
}

function monthsSince(sinceISO: string, now = new Date()): number {
  const since = new Date(sinceISO);
  const months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth()) + (now.getDate() >= since.getDate() ? 1 : 0);
  return Math.max(1, months); // this month's bill is already one you didn't pay
}

export async function getSavings(): Promise<Savings> {
  const [toolKey, monthlyRaw, sinceRaw] = await Promise.all([getMeta("savings_tool"), getMeta("savings_monthly"), getMeta("switched_at")]);
  const tool = TOOLS.find((t) => t.key === toolKey) ?? TOOLS[0];
  const monthly = monthlyRaw !== null && Number.isFinite(Number(monthlyRaw)) ? Number(monthlyRaw) : tool.monthly;
  let since = sinceRaw;
  if (!since) {
    const first = await get<{ first: string | null }>("SELECT MIN(created_at) AS first FROM invoices");
    since = first?.first ? String(first.first) : new Date().toISOString();
    await setMetaIfMissing("switched_at", since);
  }
  const months = monthsSince(since);
  return { tool, monthly, since, months, saved: Math.round(months * monthly * 100) / 100, yearly: Math.round(monthly * 12 * 100) / 100 };
}

export async function updateSavings(toolKey: string, monthly?: number) {
  const tool = TOOLS.find((t) => t.key === toolKey);
  if (!tool) throw new Error("Unknown tool");
  await setMeta("savings_tool", tool.key);
  await setMeta("savings_monthly", String(monthly !== undefined && Number.isFinite(monthly) && monthly >= 0 ? Math.min(monthly, 10_000) : tool.monthly));
}
