import "server-only";
import { centsToDecimalString } from "./money.ts";
import type { Invoice } from "./types.ts";

// PayPal Orders v2 (https://developer.paypal.com/docs/api/orders/v2/)
// Flow: browser loads PayPal JS SDK -> createOrder hits our API -> buyer approves
// in PayPal -> onApprove hits our capture API -> we verify and mark the invoice paid.

export function paypalEnabled(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalClientId(): string | null {
  return paypalEnabled() ? process.env.PAYPAL_CLIENT_ID! : null;
}

/** Test payments let Wren/demo finish the payment flow without a PayPal login. */
export function testPaymentsEnabled(): boolean {
  const flag = process.env.ENABLE_TEST_PAYMENTS?.toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return !paypalEnabled();
}

function baseUrl(): string {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function paypalFetch<T>(path: string, init: RequestInit & { requestId?: string }): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.details?.[0]?.description || json?.message || text;
    throw new Error(`PayPal ${path} failed (${res.status}): ${detail}`);
  }
  return json as T;
}

export async function createOrder(invoice: Invoice): Promise<string> {
  const order = await paypalFetch<{ id: string }>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: invoice.id,
          custom_id: invoice.public_id,
          description: `Invoice ${invoice.number}`.slice(0, 127),
          amount: { currency_code: invoice.currency, value: centsToDecimalString(invoice.total_cents) },
        },
      ],
    }),
  });
  return order.id;
}

interface CaptureResult {
  id: string;
  status: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units?: {
    reference_id?: string;
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] };
  }[];
}

export async function captureOrder(orderId: string, invoice: Invoice) {
  const result = await paypalFetch<CaptureResult>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`, // idempotent retries
  });
  const unit = result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const expected = centsToDecimalString(invoice.total_cents);
  const ok =
    result.status === "COMPLETED" &&
    unit?.reference_id === invoice.id &&
    capture?.status === "COMPLETED" &&
    capture.amount.currency_code === invoice.currency &&
    capture.amount.value === expected;
  if (!ok) {
    throw new Error(`PayPal capture did not match invoice (status ${result.status}, capture ${capture?.status ?? "none"})`);
  }
  const payerName = [result.payer?.name?.given_name, result.payer?.name?.surname].filter(Boolean).join(" ");
  return { captureId: capture!.id, payer: payerName || result.payer?.email_address || undefined };
}
