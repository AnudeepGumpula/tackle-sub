import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceSentence, type ParseContext } from "../../src/lib/ruleParser.ts";
import { computeTotals } from "../../src/lib/money.ts";

// Saturday, Nov 7 2026
const ctx: ParseContext = { today: "2026-11-07", currency: "USD", defaultTaxRate: 0, paymentTermsDays: 14 };

test("hours at rate, due weekday", () => {
  const d = parseInvoiceSentence("Bill Acme 10h design at $120, due Friday", ctx);
  assert.equal(d.client_name, "Acme");
  assert.deepEqual(d.line_items, [{ description: "Design", quantity: 10, unit_price: 120 }]);
  assert.equal(d.due_date, "2026-11-13");
  assert.equal(d.currency, "USD");
});

test("email, multiple items, net terms, tax", () => {
  const d = parseInvoiceSentence(
    "Invoice Sarah Lee sarah@lee.studio for logo design $500, 3 social banners at $80 each and 2.5 hours consulting at $150/hr, net 30, 8% tax",
    ctx,
  );
  assert.equal(d.client_name, "Sarah Lee");
  assert.equal(d.client_email, "sarah@lee.studio");
  assert.equal(d.line_items.length, 3);
  assert.deepEqual(d.line_items[0], { description: "Logo design", quantity: 1, unit_price: 500 });
  assert.deepEqual(d.line_items[1], { description: "Social banners", quantity: 3, unit_price: 80 });
  assert.deepEqual(d.line_items[2], { description: "Consulting", quantity: 2.5, unit_price: 150 });
  assert.equal(d.due_date, "2026-12-07");
  assert.equal(d.tax_rate, 8);
});

test("currency symbol and k suffix, default terms", () => {
  const d = parseInvoiceSentence("Charge Globex €1.5k for website redesign", ctx);
  assert.equal(d.client_name, "Globex");
  assert.equal(d.currency, "EUR");
  assert.deepEqual(d.line_items, [{ description: "Website redesign", quantity: 1, unit_price: 1500 }]);
  assert.equal(d.due_date, "2026-11-21");
  assert.ok(d.assumptions.some((a) => a.includes("14 days")));
});

test("known client fills email", () => {
  const d = parseInvoiceSentence("bill acme corp $200 for hosting due in 2 weeks", {
    ...ctx,
    knownClients: [{ name: "Acme Corp", email: "ap@acme.com" }],
  });
  assert.equal(d.client_name, "Acme Corp");
  assert.equal(d.client_email, "ap@acme.com");
  assert.equal(d.due_date, "2026-11-21");
});

test("no amount still returns an editable draft", () => {
  const d = parseInvoiceSentence("Bill Initech for the migration project", ctx);
  assert.equal(d.client_name, "Initech");
  assert.equal(d.line_items.length, 1);
  assert.equal(d.line_items[0].unit_price, 0);
  assert.ok(d.assumptions.some((a) => a.toLowerCase().includes("amount")));
});

test("month-day due date rolls into next year when past", () => {
  const d = parseInvoiceSentence("Bill Hooli $300 for audit due Jan 5", ctx);
  assert.equal(d.due_date, "2027-01-05");
});

test("totals with tax and fractional quantities", () => {
  const t = computeTotals([{ quantity: 2.5, unit_price_cents: 15000 }, { quantity: 1, unit_price_cents: 50000 }], 8);
  assert.equal(t.subtotal_cents, 87500);
  assert.equal(t.tax_cents, 7000);
  assert.equal(t.total_cents, 94500);
});
