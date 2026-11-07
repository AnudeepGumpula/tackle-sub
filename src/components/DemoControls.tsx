"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoControls({ mode, confirmReplace = false }: { mode: "seed" | "reset"; confirmReplace?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (mode === "reset" && !confirm("Delete all invoices and clients? Settings are kept.")) return;
    if (mode === "seed" && confirmReplace && !confirm("Replace all invoices and clients with sample data? Settings are kept.")) return;
    setBusy(true);
    await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode }) });
    setBusy(false);
    router.refresh();
  }
  return mode === "seed" ? (
    <button className="btn-secondary" onClick={go} disabled={busy} data-testid="seed-demo">{busy ? "Loading…" : "Load sample data"}</button>
  ) : (
    <button className="btn-danger" onClick={go} disabled={busy} data-testid="reset-data">{busy ? "Resetting…" : "Delete all invoices & clients"}</button>
  );
}
