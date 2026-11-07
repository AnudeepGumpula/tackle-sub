# Wren test plan

Prize rule: *Wren results for at least two core workflows, rerun against your final build.*

These two workflows are automated in [`seldon.yml`](seldon.yml). The Seldon GitHub App runs them on every PR (against the Vercel preview) and on every deployment (against the deployed URL).

**Before each run:** open `/settings` → **Delete all invoices & clients** (optional: **Load sample data**).
Make sure `ENABLE_TEST_PAYMENTS=true` is set on the deployed app so Wren can finish the payment without a PayPal login.

---

## Workflow 1: Create an invoice from one sentence

**Goal:** A freelancer creates and sends an invoice by typing one sentence.

1. Go to the home page (`/`).
2. In the box labelled "Describe the invoice in one sentence", type:
   `Bill Wren Test Co 10 hours of design at $120/hr, due in 14 days`
3. Click **Fill in invoice**.
4. **Expect:** a "Review and send" form appears with Client name **Wren Test Co**, one line item of type **Hourly** with description **Design**, Hours **10**, Rate / hr **120**, and Total **$1,200.00**.
5. Click **Create invoice**.
6. **Expect:** the invoice page shows the banner "Invoice INV-… created", status **Awaiting payment**, Amount due **$1,200.00**, and **Text pay link**, **Email invoice** and **Copy link** buttons with an **Open client view ↗** link under them.
7. Click **Dashboard** in the top nav.
8. **Expect:** a row for **Wren Test Co** with **$1,200.00** and status **Awaiting payment**. The **Outstanding** total includes $1,200.00.

## Workflow 2: Client pays the invoice

**Goal:** The client opens the pay link and pays, and the freelancer sees it as paid.

1. Create an invoice as in Workflow 1 with: `Invoice Pay Flow LLC $450 for logo refresh, due in 14 days`.
2. On the invoice page, click **Open client view ↗** (under the share buttons at the top).
3. **Expect:** the page says "… sent you an invoice", Billed to **Pay Flow LLC**, a **Flat fee** line, Amount due **$450.00**.
4. Click **Pay $450.00**.
5. **Expect:** a green banner "✓ Paid. Thank you!" and status **Paid**.
6. Go back to the dashboard (`/`).
7. **Expect:** the **Pay Flow LLC** row shows status **Paid**. **Paid this month** went up by $450.00. In the invoice's Activity there are "Client opened the invoice" and "Paid" entries.

---

### Optional extra workflows (for "it actually works" points)

- **Overdue + AI reminder:** Settings → Load sample data → open the **Globex** invoice (Overdue) → choose **Firm** → **Draft reminder email** → expect a subject and an email body that contains the pay link.
- **Edit an invoice:** open an unpaid invoice → **Edit** → change the hours → **Save changes** → expect the new total.
- **Required fields:** type `Bill Acme $300 for audit` (no due date) → **Fill in invoice** → expect the Due date field outlined in red with "Required", and **Create invoice** blocked until a date is entered.
- **Manual entry:** `/invoices/new` → click **Fill in manually** → fill in the form → **Create invoice**.

Stable selectors exist for automation: `data-testid="magic-input"`, `magic-submit`, `save-and-send`, `invoice-status`, `open-pay-page`, `copy-link`, `text-invoice`, `test-pay`, `paid-banner`, `invoice-row`.
