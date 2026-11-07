import { aiEnabled } from "@/lib/ai";
import { paypalEnabled, testPaymentsEnabled } from "@/lib/paypal";
import { getSettings } from "@/lib/store";
import { DemoControls } from "@/components/DemoControls";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const persistent = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) || !process.env.VERCEL;
  const checks = [
    { label: "Claude AI parsing", ok: aiEnabled(), hint: "Set ANTHROPIC_API_KEY" },
    { label: `PayPal checkout (${process.env.PAYPAL_ENV === "live" ? "live" : "sandbox"})`, ok: paypalEnabled(), hint: "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET" },
    { label: "Test payments button", ok: testPaymentsEnabled(), hint: "Set ENABLE_TEST_PAYMENTS=true" },
    { label: "Persistent database", ok: persistent, hint: "Set DATABASE_URL + DATABASE_AUTH_TOKEN (Turso)" },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-slate-500">Shown on every invoice you send.</p>
      </div>
      <SettingsForm initial={settings} />
      <section className="card p-6">
        <h2 className="font-semibold">Integrations</h2>
        <ul className="mt-3 space-y-2 text-sm" data-testid="integrations">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-emerald-500" : "bg-slate-300"}`} />
                {c.label}
              </span>
              <span className={c.ok ? "text-emerald-700" : "text-slate-400"}>{c.ok ? "On" : c.hint}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-semibold">Demo data</h2>
          <p className="text-sm text-slate-500">Load a full set of sample invoices (replaces current ones), or wipe everything before a fresh test run.</p>
        </div>
        <div className="flex gap-2"><DemoControls mode="seed" confirmReplace /><DemoControls mode="reset" /></div>
      </section>
    </div>
  );
}
