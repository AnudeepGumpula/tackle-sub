import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceSentence, type ParseContext } from "../../src/lib/ruleParser.ts";
import { computeTotals } from "../../src/lib/money.ts";

// Saturday, Nov 7 2026
const ctx: ParseContext = { today: "2026-11-07", currency: "USD", defaultTaxRate: 0, paymentTermsDays: 14 };

test("hours at rate, due weekday", () => {
  const d = parseInvoiceSentence("Bill Acme 10h design at $120, due Friday", ctx);
  assert.equal(d.client_name, "Acme");
  assert.deepEqual(d.line_items, [{ kind: "hourly", description: "Design", quantity: 10, unit_price: 120 }]);
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
  assert.deepEqual(d.line_items[0], { kind: "flat_fee", description: "Logo design", quantity: 1, unit_price: 500 });
  assert.deepEqual(d.line_items[1], { kind: "flat_fee", description: "3 social banners", quantity: 1, unit_price: 240 });
  assert.deepEqual(d.line_items[2], { kind: "hourly", description: "Consulting", quantity: 2.5, unit_price: 150 });
  assert.equal(d.due_date, "2026-12-07");
  assert.equal(d.tax_rate, 8);
});

test("currency symbol and k suffix; no due date stays blank (required)", () => {
  const d = parseInvoiceSentence("Charge Globex €1.5k for website redesign", ctx);
  assert.equal(d.client_name, "Globex");
  assert.equal(d.currency, "EUR");
  assert.deepEqual(d.line_items, [{ kind: "flat_fee", description: "Website redesign", quantity: 1, unit_price: 1500 }]);
  assert.equal(d.due_date, "");
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

test("no amount still returns an editable draft with the amount left for the user", () => {
  const d = parseInvoiceSentence("Bill Initech for the migration project", ctx);
  assert.equal(d.client_name, "Initech");
  assert.equal(d.line_items.length, 1);
  assert.equal(d.line_items[0].unit_price, 0);
});

test("missing client name stays blank (required), no email pill", () => {
  const d = parseInvoiceSentence("$300 for audit due Friday", ctx);
  assert.equal(d.client_name, "");
  assert.ok(!d.assumptions.some((a) => /email/i.test(a.message)));
});

test("day rate", () => {
  const d = parseInvoiceSentence("Bill Acme 3 days of on-site workshops at $800/day, due Friday", ctx);
  assert.deepEqual(d.line_items, [{ kind: "day_rate", description: "On-site workshops", quantity: 3, unit_price: 800 }]);
});

test("milestone, deposit and retainer wording", () => {
  assert.equal(parseInvoiceSentence("Bill Acme $2,000 for the wireframe milestone", ctx).line_items[0].kind, "milestone");
  assert.equal(parseInvoiceSentence("Bill Acme $1,500 deposit for the website project", ctx).line_items[0].kind, "deposit");
  assert.equal(parseInvoiceSentence("Bill Acme $1,500 for the November retainer", ctx).line_items[0].kind, "retainer");
});

test("default tax is flagged on the tax field", () => {
  const d = parseInvoiceSentence("Bill Acme $300 for audit due Friday", { ...ctx, defaultTaxRate: 8 });
  assert.deepEqual(d.assumptions, [{ field: "tax_rate", message: "We used your default tax of 8%. Check it." }]);
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

test("thousands separators don't split a line item", () => {
  const d = parseInvoiceSentence("Bill Acme 10 hours of design at $120/hr and $2,000 for the wireframe milestone", ctx);
  assert.deepEqual(d.line_items[1], { kind: "milestone", description: "Wireframe milestone", quantity: 1, unit_price: 2000 });
});
