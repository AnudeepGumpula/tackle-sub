"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Invoice } from "@/lib/types";
import { CopyIcon } from "./CopyIcon";

type Tone = "friendly" | "firm" | "final";

/** only="buttons": the toolbar inside the invoice card. only="reminder": the reminder panel in the sidebar. */
export function InvoiceActions({ invoice, only }: { invoice: Invoice; only: "buttons" | "reminder" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ subject: string; body: string; source: string } | null>(null);
  const [tone, setTone] = useState<Tone>(invoice.display_status === "overdue" ? "firm" : "friendly");

  async function setStatus(status: string) {
    setBusy(status);
    setErr(null);
    const res = await fetch(`/api/invoices/${invoice.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await res.json();
    if (!res.ok) setErr(data.error);
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete invoice ${invoice.number}? This can't be undone.`)) return;
    setBusy("delete");
    await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function draftReminder(t: Tone = tone) {
    setBusy("reminder");
    setErr(null);
    const res = await fetch(`/api/invoices/${invoice.id}/reminder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tone: t }) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(data.error);
    setReminder(data.reminder);
    router.refresh();
  }

  const mailto = (subject: string, body: string) =>
    `mailto:${encodeURIComponent(invoice.client.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const isOpen = invoice.status === "sent" || invoice.status === "draft";

  return (
    <div className="no-print space-y-4">
      {only === "buttons" && (
      <div className="flex flex-wrap justify-end gap-2">
        {invoice.status === "draft" && <button className="btn-secondary" onClick={() => setStatus("sent")} disabled={!!busy} data-testid="mark-sent">Mark as sent</button>}
        {isOpen && <button className="btn-secondary" onClick={() => setStatus("paid")} disabled={!!busy} data-testid="mark-paid">Mark as paid</button>}
        {invoice.status !== "paid" && <a className="btn-secondary" href={`/invoices/${invoice.id}/edit`}>Edit</a>}
        <button className="btn-secondary" onClick={() => window.print()}>Download PDF</button>
        {invoice.status === "sent" && <button className="btn-ghost" onClick={() => setStatus("void")} disabled={!!busy}>Void</button>}
        {invoice.status === "void" && <button className="btn-ghost" onClick={() => setStatus("draft")} disabled={!!busy}>Restore as draft</button>}
        <button className="btn-ghost text-red-600" onClick={remove} disabled={!!busy}>Delete</button>
      </div>

      )}

      {only === "reminder" && invoice.status === "sent" && (
        <div className="card space-y-3 p-5" data-testid="reminder-panel">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Payment reminder</p>
            <span className="text-xs text-slate-400">written by Claude</span>
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Reminder tone">
            {(["friendly", "firm", "final"] as Tone[]).map((t) => (
              <button key={t} role="radio" aria-checked={tone === t} onClick={() => setTone(t)}
                className={`rounded-lg px-3 py-1 text-sm capitalize ${tone === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{t}</button>
            ))}
          </div>
          <button className="btn-secondary w-full" onClick={() => draftReminder()} disabled={busy === "reminder"} data-testid="draft-reminder">
            {busy === "reminder" ? "Writing…" : reminder ? "Rewrite reminder" : "Draft reminder email"}
          </button>
          {reminder && (
            <div className="space-y-2" data-testid="reminder-draft">
              <input className="input font-medium" value={reminder.subject} onChange={(e) => setReminder({ ...reminder, subject: e.target.value })} aria-label="Reminder subject" />
              <textarea className="input min-h-48 text-sm" value={reminder.body} onChange={(e) => setReminder({ ...reminder, body: e.target.value })} aria-label="Reminder body" />
              <div className="flex gap-2">
                <a className="btn-primary flex-1" href={mailto(reminder.subject, reminder.body)}>Open in email</a>
                <button className="btn-secondary gap-2" onClick={async () => { await navigator.clipboard.writeText(`${reminder.subject}\n\n${reminder.body}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  <CopyIcon />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
