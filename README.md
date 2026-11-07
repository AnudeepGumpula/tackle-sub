# OneLine: invoice in one sentence

> **Kill the subscription:** FreshBooks (~$19–60/mo), QuickBooks Simple Start (~$35/mo), Bonsai and HoneyBook (~$25–40/mo).
> Freelancers mostly pay for those to do two things: **send an invoice** and **get paid**. OneLine does both, free.

Type (or say) one sentence:

> *"Bill Acme 10 hours of design at $120/hr, due Friday"*

Claude turns it into a complete invoice. You review it and click **Get pay link**. Your client opens the link and pays with **PayPal**, and the invoice flips to **Paid** on your dashboard.

## Features

- **One-sentence invoicing** with Claude (structured outputs). Handles hours × rate, flat fees, quantities, `$1.5k`, tax, currencies, and due dates like "Friday", "net 30" or "end of month". Matches existing clients and fills in their email. Shows a chip for anything it had to guess.
- **Voice input** (🎙 mic button) in Chrome and Edge.
- **Works with no API key.** A built-in rule parser takes over automatically, and also covers any Claude failure.
- **Client pay page** with PayPal Smart Buttons (Orders v2 with server-side capture and amount verification), a print/PDF receipt, and a "viewed" tracker.
- **Test payment mode** so demos and Wren runs can complete payment without a PayPal login.
- **Dashboard** with outstanding, overdue and paid-this-month totals, filters, and auto-detected overdue invoices.
- **AI payment reminders** in friendly, firm or final tones. Claude writes them using the invoice's history (how often it was viewed, earlier reminders).
- Invoice editing, mark sent/paid, void, delete, an activity timeline, clients with totals, business settings, and sample data.

## Quick start (laptop)

```bash
git clone https://github.com/anudeepgumpula/tackle-sub.git
cd tackle-sub
git checkout claude/dreamy-ptolemy-keguml   # or main, once merged
npm install
cp .env.example .env.local                  # add keys (all optional)
npm run dev                                 # http://localhost:3000
```

Node 20.9+ is required. The SQLite database is created automatically at `data/app.db`.

### Environment variables (`.env.local`)

| Variable | What it does | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude parsing and reminder emails | console.anthropic.com → API Keys (or hackathon credits) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real PayPal checkout | developer.paypal.com → Apps & Credentials → **Sandbox** → Create App |
| `PAYPAL_ENV` | `sandbox` (default) or `live` | |
| `ENABLE_TEST_PAYMENTS` | Shows the "Pay (test mode)" button. Defaults to on without PayPal, off with it. **Set `true` for Wren runs.** | |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Persistent database for hosting (Turso, free) | turso.tech |
| `APP_PASSWORD` | Optional password for the owner dashboard (pay links stay public) | |

`/settings` and `GET /api/health` show which integrations are switched on.

### Testing PayPal (sandbox)

1. Add the sandbox Client ID and Secret, then restart `npm run dev`.
2. Open an invoice → **Open client view** → click the PayPal button.
3. Log in with the **sandbox personal (buyer) account** from developer.paypal.com → Testing Tools → Sandbox Accounts, or use "Debit or Credit Card" with PayPal's test card generator.
4. After approval, the server captures the order, checks the amount and currency against the invoice, and marks it **Paid**.

## Deploy (Vercel + Turso, ~10 min)

1. **Database:** sign up at turso.tech → create a database → copy its URL (`libsql://…`) and create a token.
2. **Vercel:** vercel.com → Add New Project → import `anudeepgumpula/tackle-sub` (pick this branch, or merge to `main` first).
3. Add environment variables: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `ENABLE_TEST_PAYMENTS=true`.
4. Deploy, then open `https://<your-app>.vercel.app/api/health`. It should show `"ok": true, "persistent_db": true`.

Without Turso, Vercel stores data in `/tmp`, which works for a quick test but resets on cold starts.

## Tests

```bash
npm test               # parser + money unit tests (Node test runner)
npm run test:e2e       # both core workflows in a real browser, desktop + mobile
BASE_URL=https://<your-app>.vercel.app npm run test:e2e   # same, against the deployed app
```

The first time on a laptop, run `npx playwright install chromium` before the e2e tests.

See **[WREN.md](WREN.md)** for the two workflows to give Wren.

### QA with Seldon (Wren)

[`seldon.yml`](seldon.yml) defines the two core workflows as Seldon test cases: "Create an invoice from one sentence" and "Client pays the invoice". The Seldon GitHub App runs them on every PR (against the Vercel preview) and on every deployment (against production).

They need `ENABLE_TEST_PAYMENTS=true` in **both** the Production and Preview environments on Vercel. Without it the test-mode **Pay** button is hidden and the payment test can't finish.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · libSQL/SQLite (Turso-ready) · Anthropic SDK (`claude-opus-5-5`, structured outputs, low effort) · PayPal Orders v2 · Zod

```
src/lib/ai.ts           Claude parsing + reminders (falls back to rules)
src/lib/ruleParser.ts   No-key sentence parser
src/lib/paypal.ts       PayPal OAuth, create + capture order, verification
src/lib/store.ts        All database reads/writes
src/app/(owner)/        Dashboard, invoice pages, clients, settings
src/app/pay/[publicId]  Public client pay page
src/app/api/            JSON API used by the UI
```
