"use client";
import Link from "next/link";
import { useState } from "react";
import { IMPORT_SOURCES, type ImportPreview, type ImportSource } from "@/lib/csvImport";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

interface Result {
  invoices_created: number;
  clients_created: number;
  duplicates: number;
  paid: number;
  open: number;
  drafts: number;
  outstanding: number;
  errors: { line: number; reason: string }[];
}

const HOW_TO: Record<ImportSource, string> = {
  freshbooks: "In FreshBooks: Invoices → select all → More actions → Export to CSV (or Reports → Invoice Details → Export → CSV). Client lists work too: Clients → Export.",
  quickbooks: "In QuickBooks: Reports → Invoice List (or Open Invoices) → Export → Export to CSV. Customer lists work too.",
  wave: "In Wave: Reports → Account Transactions, or Sales → Invoices → Export. Customer lists work too.",
  other: "Any CSV with a client/customer column works. Add amount, due date and status columns to bring invoices over.",
};

const STATUS_LABEL = { open: "Unpaid", paid: "Paid", draft: "Draft" } as const;

export function ImportForm({ currency }: { currency: string }) {
  const [source, setSource] = useState<ImportSource>("freshbooks");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "import">(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(commit: boolean, text = csv) {
    setErr(null);
    setBusy(commit ? "import" : "preview");
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: text, source, commit }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (commit) setResult(data.result);
      else setPreview(data.preview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
      if (!commit) setPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) return setErr("That file is over 2 MB. Split it and import it in parts.");
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setResult(null);
    call(false, text);
  }

  async function useSample() {
    const text = await (await fetch("/sample-freshbooks-export.csv")).text();
    setSource("freshbooks");
    setFileName("sample-freshbooks-export.csv");
    setCsv(text);
    setResult(null);
    call(false, text);
  }

  if (result) {
    return (
      <div className="card space-y-4 p-6" data-testid="import-result" role="status">
        <p className="text-lg font-semibold text-emerald-700">✓ You&apos;re switched over.</p>
        <ul className="space-y-1 text-sm text-slate-700">
          <li><strong>{result.invoices_created}</strong> invoice{result.invoices_created === 1 ? "" : "s"} imported ({result.open} unpaid, {result.paid} paid{result.drafts ? `, ${result.drafts} draft` : ""})</li>
          <li><strong>{result.clients_created}</strong> new client{result.clients_created === 1 ? "" : "s"} added</li>
          {result.open > 0 && <li><strong>{formatMoney(Math.round(result.outstanding * 100), currency)}</strong> still owed to you is now tracked here, with pay links ready to send</li>}
          {result.duplicates > 0 && <li>{result.duplicates} already imported earlier, so skipped</li>}
        </ul>
        {result.errors.length > 0 && (
          <details className="text-sm text-slate-500">
            <summary>{result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped</summary>
            <ul className="mt-2 list-disc pl-5">{result.errors.slice(0, 20).map((e) => <li key={e.line}>Row {e.line}: {e.reason}</li>)}</ul>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/?filter=unpaid" className="btn-primary" data-testid="import-done">See unpaid invoices</Link>
          <button className="btn-secondary" onClick={() => { setResult(null); setPreview(null); setCsv(""); setFileName(null); }}>Import another file</button>
        </div>
        <p className="text-sm text-slate-500">Last step: cancel your {IMPORT_SOURCES.find((s) => s.key === source)?.label ?? "old"} subscription. 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6">
        <div>
          <p className="label">Coming from</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Coming from">
            {IMPORT_SOURCES.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={source === s.key} onClick={() => setSource(s.key)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${source === s.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">{HOW_TO[source]}</p>
        </div>

        <div>
          <label htmlFor="csv-file" className="label">Your export (.csv)</label>
          <label htmlFor="csv-file" className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-brand-500">
            <span className="font-medium text-slate-700">{fileName ?? "Choose a CSV file"}</span>
            <span className="text-xs text-slate-500">Invoices or clients, up to 1,000 rows</span>
          </label>
          <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" data-testid="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="btn-secondary" onClick={useSample} data-testid="import-sample">Try a sample FreshBooks export</button>
            <a href="/sample-freshbooks-export.csv" download className="text-brand-700 underline">Download the sample</a>
          </div>
        </div>
        {busy === "preview" && <p className="text-sm text-slate-500">Reading your file…</p>}
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </div>

      {preview && (
        <div className="card" data-testid="import-preview">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="font-semibold">
                {preview.kind === "invoices"
                  ? `${preview.rows.length} invoice${preview.rows.length === 1 ? "" : "s"} for ${preview.clients.length} client${preview.clients.length === 1 ? "" : "s"}`
                  : `${preview.clients.length} client${preview.clients.length === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-slate-500">
                Matched columns: {Object.entries(preview.columns).map(([k, v]) => `${k} → “${v}”`).join(", ")}
              </p>
            </div>
            <button className="btn-primary" onClick={() => call(true)} disabled={busy !== null || (preview.rows.length === 0 && preview.clients.length === 0)} data-testid="import-confirm">
              {busy === "import" ? "Importing…" : preview.kind === "invoices" ? `Import ${preview.rows.length} invoice${preview.rows.length === 1 ? "" : "s"}` : `Import ${preview.clients.length} client${preview.clients.length === 1 ? "" : "s"}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            {preview.kind === "invoices" ? (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2 font-semibold">#</th><th className="px-5 py-2 font-semibold">Client</th><th className="px-5 py-2 font-semibold">Issued</th>
                    <th className="px-5 py-2 font-semibold">Due</th><th className="px-5 py-2 font-semibold">Status</th><th className="px-5 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr key={r.line}>
                      <td className="px-5 py-2 text-slate-500">{r.number ?? "–"}</td>
                      <td className="px-5 py-2">{r.client_name}{r.client_email && <span className="block text-xs text-slate-400">{r.client_email}</span>}</td>
                      <td className="px-5 py-2">{formatDate(r.issue_date) || "Today"}</td>
                      <td className="px-5 py-2">{formatDate(r.due_date) || "Default terms"}</td>
                      <td className="px-5 py-2">{STATUS_LABEL[r.status]}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{formatMoney(Math.round(r.amount * 100), r.currency ?? currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {preview.clients.slice(0, 50).map((c) => <li key={c.name} className="px-5 py-2">{c.name} <span className="text-slate-400">{c.email ?? ""}</span></li>)}
              </ul>
            )}
          </div>
          {(preview.rows.length > 50 || preview.clients.length > 50) && <p className="px-5 py-2 text-xs text-slate-400">Showing the first 50.</p>}
          {preview.skipped.length > 0 && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Skipping {preview.skipped.length} row{preview.skipped.length === 1 ? "" : "s"}: {preview.skipped.slice(0, 5).map((s) => `row ${s.line} (${s.reason.toLowerCase()})`).join(", ")}
              {preview.skipped.length > 5 ? "…" : ""}
            </p>
          )}
          {preview.kind === "invoices" && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              For partly paid invoices only the unpaid balance comes over. Invoices keep their original numbers.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
