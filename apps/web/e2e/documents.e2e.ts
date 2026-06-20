import { type Page, expect, test } from "@playwright/test";

const CODE_RE = /^(WO|CT|ISS)-\d{4}-\d{4}$/;

async function extractCodeFromBanner(page: Page): Promise<string> {
  const span = page.locator('[class*="green-900"] span').first();
  const text = (await span.textContent()) ?? "";
  const code = text.match(/((?:WO|CT|ISS)-\d{4}-\d{4})/)?.[1];
  if (!code) throw new Error("Banner did not contain a valid document code");
  return code;
}

async function issueManual(
  page: Page,
  entityType: "work_order" | "contract" | "issue_note",
  description?: string,
) {
  await page.getByRole("button", { name: "+ New Document" }).click();
  const modal = page.locator(".z-50");
  if (description) {
    await modal.locator("textarea").fill(description);
  }
  await modal.locator("select").selectOption(entityType);
  await modal.getByRole("button", { name: "Issue" }).click();
  await expect(page.locator('[class*="green-900"]')).toBeVisible({ timeout: 10_000 });
}

test.describe("Document Registry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Document Registry" })).toBeVisible();
  });

  // ── Page load ────────────────────────────────────────────────

  test("table headers are visible on load", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Code" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Description" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Issued At" })).toBeVisible();
  });

  // ── Manual issue ─────────────────────────────────────────────

  test("issue Work Order — new row with WO- code appears in table", async ({ page }) => {
    await issueManual(page, "work_order");

    const code = await extractCodeFromBanner(page);
    expect(code).toMatch(/^WO-\d{4}-\d{4}$/);
    await expect(page.getByRole("cell", { name: code })).toBeVisible();
  });

  test("issue Contract — new row with CT- code appears in table", async ({ page }) => {
    await issueManual(page, "contract");

    const code = await extractCodeFromBanner(page);
    expect(code).toMatch(/^CT-\d{4}-\d{4}$/);
    await expect(page.getByRole("cell", { name: code })).toBeVisible();
  });

  test("issue Issue Note — new row with ISS- code appears in table", async ({ page }) => {
    await issueManual(page, "issue_note");

    const code = await extractCodeFromBanner(page);
    expect(code).toMatch(/^ISS-\d{4}-\d{4}$/);
    await expect(page.getByRole("cell", { name: code })).toBeVisible();
  });

  test("issue with description — description appears in table row", async ({ page }) => {
    const description = "Elevator motor repair zone B";
    await issueManual(page, "work_order", description);

    await expect(page.getByText(description)).toBeVisible();
  });

  // ── Success banner ───────────────────────────────────────────

  test("success banner shows issued code", async ({ page }) => {
    await issueManual(page, "work_order");

    const code = await extractCodeFromBanner(page);
    expect(code).toMatch(CODE_RE);
  });

  test("success banner dismisses on ✕", async ({ page }) => {
    await issueManual(page, "work_order");

    const banner = page.locator('[class*="green-900"]');
    await expect(banner).toBeVisible();
    await page.locator("button", { hasText: "✕" }).click();
    await expect(banner).not.toBeVisible();
  });

  // ── Modal interactions ───────────────────────────────────────

  test("Cancel button closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: "+ New Document" }).click();
    const modal = page.locator(".z-50");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();
  });

  test("clicking backdrop closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: "+ New Document" }).click();
    await expect(page.locator(".z-50")).toBeVisible();

    await page.locator(".fixed.inset-0.z-40").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".z-50")).not.toBeVisible();
  });

  // ── Search ───────────────────────────────────────────────────

  test("search input filters table to matching code", async ({ page }) => {
    await issueManual(page, "work_order");
    const code = await extractCodeFromBanner(page);

    await page.getByPlaceholder("Search by code, e.g. WO-2569").fill(code);
    await page.waitForTimeout(400); // 300ms debounce + buffer

    const codeCells = page.locator("td.font-mono");
    await expect(codeCells).toHaveCount(1);
    await expect(codeCells.first()).toHaveText(code);
  });

  test("clearing search shows all rows again", async ({ page }) => {
    await issueManual(page, "work_order");

    const searchInput = page.getByPlaceholder("Search by code, e.g. WO-2569");
    await searchInput.fill("NOMATCH-9999-9999");
    await page.waitForTimeout(400);
    await expect(page.getByText("No documents found")).toBeVisible();

    await searchInput.clear();
    await page.waitForTimeout(400);
    await expect(page.locator("td.font-mono").first()).toBeVisible();
  });

  // ── Type filter ──────────────────────────────────────────────

  test("type filter shows only Work Order rows", async ({ page }) => {
    await issueManual(page, "work_order");

    await page.locator("select").first().selectOption("work_order");
    await page.waitForTimeout(300);

    const codeCells = page.locator("td.font-mono");
    const count = await codeCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await codeCells.nth(i).textContent()) ?? "";
      if (text !== "Issuing...") {
        expect(text).toMatch(/^WO-/);
      }
    }
  });

  test("resetting type filter back to All types shows all rows", async ({ page }) => {
    await issueManual(page, "work_order");
    await issueManual(page, "contract");

    const filterSelect = page.locator("select").first();
    await filterSelect.selectOption("work_order");
    await page.waitForTimeout(300);
    const filteredCount = await page.locator("td.font-mono").count();

    await filterSelect.selectOption("");
    await page.waitForTimeout(300);
    const allCount = await page.locator("td.font-mono").count();

    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });

  // ── AI Auto-Issue ────────────────────────────────────────────

  test("AI Auto-Issue modal opens with correct UI", async ({ page }) => {
    await page.getByRole("button", { name: /AI Auto-Issue/ }).click();
    const modal = page.locator(".z-50");

    await expect(modal.getByRole("heading", { name: /AI Auto-Issue/ })).toBeVisible();
    await expect(modal.locator("textarea")).toBeVisible();
    await expect(modal.getByRole("button", { name: "Analyze & Issue" })).toBeVisible();
    await expect(modal.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("AI Auto-Issue Cancel closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: /AI Auto-Issue/ }).click();
    const modal = page.locator(".z-50");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();
  });

  test("AI Auto-Issue — issues a code from natural language text", async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole("button", { name: /AI Auto-Issue/ }).click();
    const modal = page.locator(".z-50");

    await modal
      .locator("textarea")
      .fill("The elevator in block B is broken and needs urgent repair");
    await modal.getByRole("button", { name: "Analyze & Issue" }).click();

    await expect(page.locator('[class*="green-900"]')).toBeVisible({ timeout: 30_000 });
    const code = await extractCodeFromBanner(page);
    expect(code).toMatch(CODE_RE);
    await expect(page.getByRole("cell", { name: code })).toBeVisible();
  });
});
