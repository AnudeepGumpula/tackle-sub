import { expect, test } from "@playwright/test";

test("switch from FreshBooks: preview and import a CSV export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("savings-banner")).toBeVisible();
  await page.getByTestId("import-link").click();
  await expect(page).toHaveURL(/\/import$/);

  await page.getByTestId("import-sample").click();
  const preview = page.getByTestId("import-preview");
  await expect(preview).toContainText("4 invoices for 4 clients");
  await expect(preview).toContainText("Lumen Labs");
  await expect(preview).toContainText("Skipping 1 row");

  await page.getByTestId("import-confirm").click();
  const result = page.getByTestId("import-result");
  await expect(result).toBeVisible();
  // First run imports 4; a rerun against the same database skips them as duplicates.
  await expect(result).toContainText(/4 invoices imported|already imported earlier/);

  await page.getByTestId("import-done").click();
  const row = page.getByTestId("invoice-row").filter({ hasText: "Harbor Yoga" }).first();
  await expect(row).toContainText("$480.00");
  await expect(row.getByTestId("invoice-status")).toHaveText("Overdue");
  await expect(page.getByTestId("savings-banner")).toContainText("vs FreshBooks");
});
