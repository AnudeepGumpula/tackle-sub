"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "oneline-guide-dismissed";

/** First-visit guide for people opening the live demo without a walkthrough. Dismissal is per browser. */
export function WelcomeGuide() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "1") setHidden(true);
    } catch {
      /* storage blocked: keep showing the guide */
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const steps = [
    { title: "Invoice in one sentence", body: <>Type one above, or tap a <b>Try</b> example. Click <b>Create</b>, then <b>Get pay link</b>.</> },
    { title: "Get paid", body: <>Click <b>Open client view</b> and press <b>Pay</b>. Test mode: no real money moves.</> },
    { title: "Switch from FreshBooks", body: <><Link href="/import" className="font-semibold text-brand-700 underline">Import a sample export</Link> and your unpaid invoices come over in seconds.</> },
    { title: "Chase late payments", body: <>Open an <Link href="/?filter=overdue" className="font-semibold text-brand-700 underline">overdue invoice</Link> and click <b>Draft reminder email</b>. Claude writes it.</> },
  ];

  return (
    <section className="card border-brand-100 p-5" aria-labelledby="guide-title" data-testid="welcome-guide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="guide-title" className="font-semibold text-slate-900">New here? Try OneLine in 60 seconds</h2>
          <p className="text-sm text-slate-500">This is a demo studio with sample clients and invoices, so feel free to click anything.</p>
        </div>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={dismiss}>Got it</button>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden>{i + 1}</span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{s.title}</p>
              <p className="text-slate-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
