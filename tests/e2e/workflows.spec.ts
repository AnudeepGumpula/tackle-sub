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
  await expect(page.getByTestId("pay-link")).toHaveValue(/\/pay\/[\w-]+$/);

  await page.goto("/");
  const row = page.getByTestId("invoice-row").filter({ hasText: "Wren Test Co" }).first();
  await expect(row).toContainText("$1,200.00");
  await expect(row.getByTestId("invoice-status")).toHaveText("Awaiting payment");
});

test("workflow 2: client pays the invoice from the pay link", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("magic-input").fill("Invoice Pay Flow LLC $450 for logo refresh");
  await page.getByTestId("magic-submit").click();
  await page.getByTestId("save-and-send").click();
  await expect(page.getByTestId("pay-link")).toBeVisible();
  const payUrl = await page.getByTestId("pay-link").inputValue();
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
