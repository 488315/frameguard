import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function waitForStableRendering(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function openComposer(page: Page) {
  await page.getByRole("button", { name: "Create proposal" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Create proposal" }),
  ).toBeVisible();
}

async function fillCanonicalProposal(page: Page, title: string) {
  await page.getByLabel("Proposal title").fill(title);
  await page
    .getByLabel("Proposal objective")
    .fill("Review a fixed mobile composition under protected-brand policy.");
  await page
    .getByLabel("Proposed value for change 1")
    .fill("A deliberate\nmobile headline");
  await page
    .getByLabel("Rationale for change 1")
    .fill("Improve narrow-screen line balance.");
}

test("empty workspace", async ({ page }) => {
  await page.goto("./");

  await expect(
    page.getByRole("heading", { name: "Start your first review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
  await waitForStableRendering(page);

  await expect(page).toHaveScreenshot("empty-workspace.png");
});

test("active side-by-side proposal", async ({ page }) => {
  await page.goto("./");
  await openComposer(page);
  await fillCanonicalProposal(page, "Canonical mobile review");
  await page.getByRole("button", { name: "Submit proposal" }).click();

  await expect(
    page.getByRole("heading", { name: "Canonical mobile review" }),
  ).toBeVisible();
  await expect(page.getByLabel("current mobile canvas")).toBeVisible();
  await expect(page.getByLabel("proposed mobile canvas")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Proposed changes" }),
  ).toBeVisible();
  await waitForStableRendering(page);

  await expect(page).toHaveScreenshot("active-side-by-side-proposal.png");
});

test("blocked protected Logo selected", async ({ page }) => {
  await page.goto("./");
  await openComposer(page);
  await fillCanonicalProposal(page, "Canonical protected review");
  await page.getByRole("button", { name: "Add change" }).click();
  await page.getByLabel("Layer for change 2").selectOption("logo");
  await page.getByLabel("Proposed value for change 2").fill("Move logo");
  await page
    .getByLabel("Rationale for change 2")
    .fill("Verify the protected brand boundary.");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await page.getByRole("button", { name: "Inspect Logo change" }).click();

  await expect(
    page.getByRole("option", {
      name: "Logo, selected, protected, 1 proposed change",
    }),
  ).toBeVisible();
  await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(page.getByText(/Logo is protected/)).toBeVisible();
  await expect(page.getByLabel("blocked logo move")).toBeVisible();
  await waitForStableRendering(page);

  await expect(page).toHaveScreenshot("blocked-protected-logo-selected.png");
});
