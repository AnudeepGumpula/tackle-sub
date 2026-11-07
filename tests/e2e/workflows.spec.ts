import { expect, test } from "@playwright/test";

// Workflow 1: freelancer types one sentence -> reviews draft -> creates invoice -> sees it awaiting payment.
// Workflow 2: client opens the pay link -> pays -> invoice shows Paid for the client and the freelancer.

test("workflow 1: create an invoice from one sentence", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("magic-input").fill("Bill Wren Test Co 10 hours of design at $120/hr, due in 14 days");
  await page.getByTestId("magic-submit").click();

  const editor = page.getByTestId("invoice-editor");
  await expect(editor).toBeVisible();
  await expect(page.getByLabel("Client name")).toHaveValue(/Wren Test Co/);
  await expect(page.getByTestId("editor-total")).toHaveText("$1,200.00");

  await page.getByTestId("save-and-send").click();
  await expect(page).toHaveURL(/\/invoices\/[\w-]+\?created=1/);
  await expect(page.getByTestId("created-banner")).toBeVisible();
  await expect(page.getByTestId("invoice-status").first()).toHaveText("Awaiting payment");
  await expect(page.getByTestId("invoice-total")).toHaveText("$1,200.00");
  await expect(page.getByTestId("open-pay-page")).toHaveAttribute("href", /\/pay\/[\w-]+$/);

  await page.goto("/");
  const row = page.getByTestId("invoice-row").filter({ hasText: "Wren Test Co" }).first();
  await expect(row).toContainText("$1,200.00");
  await expect(row.getByTestId("invoice-status")).toHaveText("Awaiting payment");
});

test("workflow 2: client pays the invoice from the pay link", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("magic-input").fill("Invoice Pay Flow LLC $450 for logo refresh, due in 14 days");
  await page.getByTestId("magic-submit").click();
  await page.getByTestId("save-and-send").click();
  await expect(page.getByTestId("open-pay-page")).toBeVisible();
  const payUrl = (await page.getByTestId("open-pay-page").getAttribute("href"))!;
  const invoiceUrl = page.url().split("?")[0];

  await page.goto(payUrl);
  await expect(page.getByTestId("invoice-client")).toHaveText("Pay Flow LLC");
  await expect(page.getByTestId("pay-panel")).toContainText("$450.00");
  await page.getByTestId("test-pay").click();
  await expect(page.getByTestId("paid-banner")).toBeVisible();
  await expect(page.getByTestId("invoice-status")).toHaveText("Paid");

  await page.goto(invoiceUrl);
  await expect(page.getByTestId("invoice-status").first()).toHaveText("Paid");
  await expect(page.getByTestId("activity")).toContainText("Client opened the invoice");
  await expect(page.getByTestId("activity")).toContainText("Paid");
});

test("required fields are highlighted when the sentence leaves them out", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("magic-input").fill("Bill Required Check Co $300 for audit");
  await page.getByTestId("magic-submit").click();

  await expect(page.getByTestId("invoice-editor")).toBeVisible();
  await expect(page.locator("#due_date")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#due_date-note")).toContainText("Required");
  await expect(page.getByTestId("assumptions")).toHaveCount(0);

  await page.getByTestId("save-and-send").click();
  await expect(page.getByText("Fill in the fields marked Required.")).toBeVisible();
  await expect(page).not.toHaveURL(/\/invoices\//);

  await page.locator("#due_date").fill("2030-01-15");
  await page.getByTestId("save-and-send").click();
  await expect(page.getByTestId("invoice-total")).toHaveText("$300.00");
});

test("day-rate lines show days and rate", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("magic-input").fill("Bill Day Rate Co 3 days of on-site workshops at $800/day, due in 7 days");
  await page.getByTestId("magic-submit").click();
  await expect(page.getByTestId("line-kind")).toHaveValue("day_rate");
  await expect(page.getByTestId("editor-total")).toHaveText("$2,400.00");
  await page.getByTestId("save-and-send").click();
  await expect(page.getByTestId("invoice-total")).toHaveText("$2,400.00");
});
