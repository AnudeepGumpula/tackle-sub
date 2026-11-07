"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Invoice } from "@/lib/types";

/** Centered "send it" card at the top of the invoice page: Text pay link, or Email / Copy link. */
export function ShareLink({ invoice, payUrl, justCreated }: { invoice: Invoice; payUrl: string; justCreated: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function markSent() {
    if (invoice.status !== "draft") return;
    await fetch(`/api/invoices/${invoice.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "sent" }) });
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(payUrl);
    } catch {
      window.prompt("Copy this link:", payUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    markSent();
  }

  const message = `Hi ${invoice.client.name}, here's invoice ${invoice.number}. You can view and pay it here: ${payUrl}`;
  // Opens the phone's Messages app with the pay link filled in (works on iOS and Android).
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;
  const mailHref = `mailto:${encodeURIComponent(invoice.client.email ?? "")}?subject=${encodeURIComponent(`Invoice ${invoice.number}`)}&body=${encodeURIComponent(`Hi ${invoice.client.name},\n\nHere's invoice ${invoice.number}. You can view and pay it here:\n${payUrl}\n\nThank you!`)}`;
  const canSend = invoice.status === "draft" || invoice.status === "sent";

  const copyButton = (
    <button type="button" className="btn-secondary w-full justify-center gap-2" onClick={copy} data-testid="copy-link">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      </svg>
      {copied ? "Copied!" : "Copy link"}
    </button>
  );

  return (
    <section
      className="no-print py-4 text-center"
      role={justCreated ? "status" : undefined}
      data-testid={justCreated ? "created-banner" : "share-card"}
    >
      {justCreated && <p className="font-semibold text-emerald-800">Invoice {invoice.number} created</p>}
      {canSend ? (
        <p className={justCreated ? "mt-1 text-sm text-slate-500" : "font-semibold text-slate-800"}>Send the pay link to {invoice.client.name}.</p>
      ) : (
        !justCreated && <p className="font-semibold text-slate-800">Client pay link</p>
      )}

      <div className="mx-auto mt-4 flex max-w-xs flex-col items-stretch gap-2">
        {canSend ? (
          <>
            <a className="btn-primary w-full justify-center" data-testid="text-invoice" href={smsHref} onClick={markSent}>
              Text pay link
            </a>
            <p className="text-xs text-slate-500">or</p>
            {invoice.client.email && (
              <a className="btn-secondary w-full justify-center" data-testid="email-invoice" href={mailHref} onClick={markSent}>
                Email invoice
              </a>
            )}
            {copyButton}
          </>
        ) : (
          copyButton
        )}
        <a className="mt-1 text-sm text-brand-700 hover:underline" href={payUrl} target="_blank" rel="noreferrer" data-testid="open-pay-page">
          Open client view ↗
        </a>
      </div>
    </section>
  );
}
