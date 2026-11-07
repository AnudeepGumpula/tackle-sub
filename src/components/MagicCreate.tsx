"use client";
import { useEffect, useRef, useState } from "react";
import type { InvoiceDraft } from "@/lib/types";
import { InvoiceEditor, type EditorInitial } from "./InvoiceEditor";

const EXAMPLES = [
  "Bill Acme Corp 10 hours of design at $120/hr, due Friday",
  "Invoice Sarah Lee sarah@lee.studio 3 days of on-site workshops at $800/day, net 30",
  "Charge Globex $2.4k for the wireframe milestone plus 8% tax, due end of month",
];

type SpeechRec = { start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; interimResults: boolean; lang: string };

export function MagicCreate({ aiEnabled, autoFocus = false, manualInitial }: { aiEnabled: boolean; autoFocus?: boolean; manualInitial?: EditorInitial }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [manual, setManual] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (e) => setText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function parse(input = text) {
    if (!input.trim()) {
      setErr("Describe the invoice in a sentence first.");
      return;
    }
    setErr(null);
    setWarning(null);
    setLoading(true);
    try {
      const res = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that sentence");
      setDraft(data.draft);
      setDraftKey((k) => k + 1);
      setWarning(data.warning ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that sentence");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 (review): the sentence collapses to a summary so the form gets the focus.
  const reviewing = Boolean(draft) || manual;
  function backToSentence() {
    setDraft(null);
    setManual(false);
  }

  return (
    <div className="space-y-4">
      {reviewing && (
        <div className="card flex items-start justify-between gap-4 px-5 py-4" data-testid="sentence-summary">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{manual ? "Filling it in by hand" : "Your sentence"}</p>
            {!manual && <p className="mt-0.5 truncate text-slate-900">{text}</p>}
          </div>
          <button type="button" className="btn-ghost shrink-0 px-2 text-sm text-brand-700" onClick={backToSentence}>
            {manual ? "Use a sentence instead" : "Edit"}
          </button>
        </div>
      )}

      {!reviewing && (
      <form
        className="card overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          parse();
        }}
      >
        <label htmlFor="magic-input" className="sr-only">Describe the invoice in one sentence</label>
        <textarea
          id="magic-input"
          name="sentence"
          data-testid="magic-input"
          className="block min-h-24 w-full resize-none border-0 bg-transparent p-5 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
          placeholder="e.g. Bill Acme 10 hours of design at $120/hr, due Friday"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              parse();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-block h-2 w-2 rounded-full ${aiEnabled ? "bg-emerald-500" : "bg-amber-400"}`} />
            {aiEnabled ? "Claude reads your sentence" : "Quick parser (add ANTHROPIC_API_KEY for Claude)"}
          </div>
          <div className="flex items-center gap-2">
            {canListen && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak it"}
                title={listening ? "Listening… tap to stop" : "Speak it"}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition focus:outline-none focus:ring-4 ${
                  listening ? "bg-red-500 ring-4 ring-red-200 hover:bg-red-600 focus:ring-red-200" : "bg-brand-600 hover:bg-brand-700 focus:ring-brand-100"
                }`}
                data-testid="mic"
              >
                {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" aria-hidden />}
                <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                  <path d="M8.5 21h7" />
                </svg>
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={loading} data-testid="magic-submit">
              {loading ? "Reading…" : "Create"}
            </button>
          </div>
        </div>
      </form>
      )}

      {!reviewing && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-slate-500">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-600 hover:border-brand-500 hover:text-brand-700" onClick={() => { setText(ex); parse(ex); }}>
              {ex}
            </button>
          ))}
          {manualInitial && (
            <button type="button" className="w-full pt-2 text-left text-sm text-brand-700 hover:underline" onClick={() => { setErr(null); setManual(true); }}>
              Fill in manually
            </button>
          )}
        </div>
      )}

      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {warning && <p className="text-sm text-amber-700">{warning}</p>}

      {draft && (
        <div data-testid="draft-review">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Review and edit</h2>
          </div>
          <InvoiceEditor key={draftKey} initial={{ ...draft, source_text: text }} assumptions={draft.assumptions} showMissing onCancel={backToSentence} />
        </div>
      )}

      {manual && !draft && manualInitial && (
        <div data-testid="manual-entry">
          <InvoiceEditor initial={manualInitial} onCancel={backToSentence} />
        </div>
      )}
    </div>
  );
}
