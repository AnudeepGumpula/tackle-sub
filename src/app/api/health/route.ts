import { aiEnabled } from "@/lib/ai";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { paypalEnabled, testPaymentsEnabled } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";
  try {
    await (await db()).execute("SELECT 1");
  } catch (err) {
    database = err instanceof Error ? err.message : "error";
  }
  return json({
    ok: database === "ok",
    database,
    persistent_db: Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) || !process.env.VERCEL,
    ai: aiEnabled(),
    paypal: paypalEnabled(),
    paypal_env: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
    test_payments: testPaymentsEnabled(),
  });
}
