"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PayPalButtons { render(el: HTMLElement): Promise<void>; close?: () => void }
interface PayPalNamespace {
  Buttons(opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError: (err: unknown) => void;
    onCancel?: () => void;
  }): PayPalButtons;
}

function loadPayPal(clientId: string, currency: string): Promise<PayPalNamespace> {
  const w = window as unknown as { paypal?: PayPalNamespace };
  if (w.paypal) return Promise.resolve(w.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons`;
    s.async = true;
    s.onload = () => (w.paypal ? resolve(w.paypal) : reject(new Error("PayPal failed to load")));
    s.onerror = () => reject(new Error("Couldn't reach PayPal. Check your connection or ad blocker."));
    document.head.appendChild(s);
  });
}

export function PayPanel({
  publicId,
  currency,
  amountLabel,
  paypalClientId,
  testPayments,
}: {
  publicId: string;
  currency: string;
  amountLabel: string;
  paypalClientId: string | null;
  testPayments: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ppReady, setPpReady] = useState(false);

  useEffect(() => {
    if (!paypalClientId || !ref.current) return;
    let buttons: PayPalButtons | null = null;
    let cancelled = false;
    loadPayPal(paypalClientId, currency)
      .then((paypal) => {
        if (cancelled || !ref.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay", height: 45 },
          createOrder: async () => {
            setErr(null);
            const res = await fetch(`/api/pay/${publicId}/paypal/order`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not start PayPal checkout");
            return data.orderId as string;
          },
          onApprove: async ({ orderID }) => {
            setProcessing(true);
            const res = await fetch(`/api/pay/${publicId}/paypal/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: orderID }),
            });
            const data = await res.json();
            setProcessing(false);
            if (!res.ok) return setErr(data.error || "Payment could not be completed");
            router.refresh();
          },
          onError: (e) => setErr(e instanceof Error ? e.message : "PayPal ran into a problem. Please try again."),
        });
        return buttons.render(ref.current).then(() => setPpReady(true));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "PayPal failed to load"));
    return () => {
      cancelled = true;
      buttons?.close?.();
    };
  }, [paypalClientId, currency, publicId, router]);

  async function testPay() {
    setProcessing(true);
    setErr(null);
    const res = await fetch(`/api/pay/${publicId}/test`, { method: "POST" });
    const data = await res.json();
    setProcessing(false);
    if (!res.ok) return setErr(data.error || "Payment failed");
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6" data-testid="pay-panel">
      <div>
        <p className="text-sm text-slate-500">Amount due</p>
        <p className="text-3xl font-bold tabular-nums">{amountLabel}</p>
      </div>
      {paypalClientId && (
        <div>
          <div ref={ref} data-testid="paypal-buttons" />
          {!ppReady && !err && <p className="text-sm text-slate-400">Loading PayPal…</p>}
        </div>
      )}
      {testPayments && (
        <div className={paypalClientId ? "border-t border-dashed border-slate-200 pt-4" : ""}>
          <button className="btn-primary w-full py-3 text-base" onClick={testPay} disabled={processing} data-testid="test-pay">
            {processing ? "Processing…" : `Pay ${amountLabel}`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">Test mode: no real money moves.</p>
        </div>
      )}
      {!paypalClientId && !testPayments && <p className="text-sm text-slate-500">Online payment isn&apos;t set up yet. Please contact the sender.</p>}
      {processing && paypalClientId && <p className="text-sm text-slate-500">Confirming your payment…</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
