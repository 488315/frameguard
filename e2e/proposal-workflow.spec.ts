import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const screenshotDir = "artifacts/proposal-workflow";
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

async function openComposer(page: Page) {
  await page.getByRole("button", { name: "Create proposal" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Create proposal" }),
  ).toBeVisible();
}

async function fillBaseProposal(page: Page, title = "E2E mobile review") {
  await page.getByLabel("Proposal title").fill(title);
  await page
    .getByLabel("Proposal objective")
    .fill(
      "Improve the mobile composition without changing protected branding.",
    );
  await page
    .getByLabel("Proposed value for change 1")
    .fill("A deliberate\nmobile headline");
  await page
    .getByLabel("Rationale for change 1")
    .fill("Improve narrow-screen line balance.");
}

async function addImageChange(page: Page) {
  await page.getByRole("button", { name: "Add change" }).click();
  await page.getByLabel("Layer for change 2").selectOption("image");
  await page.getByLabel("Proposed value for change 2").fill("72% center");
  await page
    .getByLabel("Rationale for change 2")
    .fill("Keep the subject visible in the narrow crop.");
}

test("manual proposal creates, previews, approves, and applies atomically", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Start your first review")).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/01-empty.png` });

  await openComposer(page);
  await page.screenshot({ path: `${screenshotDir}/02-create-proposal.png` });
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(page.getByText("Title is required")).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/04-validation-error.png` });

  await fillBaseProposal(page);
  await addImageChange(page);
  await page.screenshot({ path: `${screenshotDir}/03-draft-with-changes.png` });
  await page.getByRole("button", { name: "Submit proposal" }).click();

  await expect(
    page.getByRole("heading", { name: "E2E mobile review" }),
  ).toBeVisible();
  await expect(page.getByText("REVISION 01")).toBeVisible();
  await expect(
    page.getByRole("option", {
      name: "Headline, selected, 1 proposed change",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Selected Headline layer")).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/05-active-proposal.png` });
  await page.getByRole("button", { name: "Inspect Image change" }).click();
  await expect(page.getByLabel("proposed crop boundary")).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/06-selected-change-preview.png`,
  });

  await page.getByRole("button", { name: "Approve Headline change" }).click();
  await expect(
    page.getByRole("option", {
      name: "Headline, no proposed changes",
    }),
  ).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/08-partially-approved.png` });
  await page.getByRole("button", { name: "Approve Image change" }).click();
  await expect(
    page.getByRole("button", { name: "Apply 2 changes" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Apply 2 changes" }).click();
  await expect(page.getByText("REVISION 02")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/09-applied.png` });
});

test("mixed proposal visibly blocks a protected logo attempt", async ({
  page,
}) => {
  await page.goto("./");
  await openComposer(page);
  await fillBaseProposal(page, "Mixed policy review");
  await page.getByRole("button", { name: "Add change" }).click();
  await page.getByLabel("Layer for change 2").selectOption("logo");
  await expect(
    page.getByText(/this attempt will be blocked by policy/),
  ).toBeVisible();
  await page.getByLabel("Proposed value for change 2").fill("Move logo");
  await page
    .getByLabel("Rationale for change 2")
    .fill("Verify the protected brand boundary.");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(page.getByText(/Logo is protected/)).toBeVisible();
  await page.getByRole("button", { name: "Inspect Logo change" }).click();
  await expect(
    page.getByRole("option", {
      name: "Logo, selected, protected, 1 proposed change",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("blocked logo move")).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/07-protected-change-blocked.png`,
  });
  await page.getByRole("button", { name: "Approve Headline change" }).click();
  await page.getByRole("button", { name: "Apply 1 change" }).click();
  await expect(page.getByText("REVISION 02")).toBeVisible();
});

test("reject discards the proposal without advancing revision", async ({
  page,
}) => {
  await page.goto("./");
  await openComposer(page);
  await fillBaseProposal(page, "Rejected review");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await page.getByRole("button", { name: "Reject all" }).click();
  await expect(
    page.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
  await expect(page.getByText("REVISION 01")).toBeVisible();
  await page.screenshot({ path: `${screenshotDir}/10-rejected.png` });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("proposal review controls remain immediately usable", async ({
    page,
  }) => {
    await page.goto("./");
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    await openComposer(page);
    await fillBaseProposal(page, "Reduced-motion review");
    await addImageChange(page);
    await page.getByRole("button", { name: "Submit proposal" }).click();

    await expect(
      page.getByRole("heading", { name: "Reduced-motion review" }),
    ).toBeVisible();
    const imageChange = page.getByRole("button", {
      name: "Inspect Image change",
    });
    await imageChange.click();
    await expect(imageChange).toHaveAttribute("aria-current", "true");
    await expect(
      page.getByRole("option", {
        name: "Image, selected, 1 proposed change",
      }),
    ).toBeVisible();

    const approveImage = page.getByRole("button", {
      name: "Approve Image change",
    });
    await expect(approveImage).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Reject all" }),
    ).toBeEnabled();
    await approveImage.click();

    await expect(approveImage).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply 1 change" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Reject all" }),
    ).toBeEnabled();
  });
});

test("proposal composer remains usable at required desktop resolutions", async ({
  page,
}) => {
  const resolutions = [
    [1920, 1080],
    [1600, 900],
    [1440, 900],
    [1366, 768],
    [1280, 800],
  ] as const;
  await page.goto("./");
  await openComposer(page);
  await fillBaseProposal(page, "A deliberately long production proposal title");
  await addImageChange(page);
  for (const [width, height] of resolutions) {
    await page.setViewportSize({ width, height });
    await expect(page.getByLabel("Proposal title")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
    await page.screenshot({
      path: `${screenshotDir}/responsive-${width}x${height}.png`,
    });
  }
});

test("layers remain available in a 200-percent-zoom equivalent layout", async ({
  page,
}) => {
  await page.goto("./");
  await openComposer(page);
  await fillBaseProposal(page, "Narrow Layers review");
  await addImageChange(page);
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await page.setViewportSize({ width: 640, height: 900 });

  const layers = page.getByRole("listbox", { name: "Document layers" });
  await expect(layers).toBeVisible();
  await page
    .getByRole("option", { name: "Body Copy, no proposed changes" })
    .click();
  await expect(
    page.getByRole("option", {
      name: "Body Copy, selected, no proposed changes",
    }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
  await page.screenshot({
    path: `${screenshotDir}/layers-narrow-640x900.png`,
    fullPage: true,
  });
});

test("active Layers review has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("./");
  await openComposer(page);
  await fillBaseProposal(page, "Accessible Layers review");
  await addImageChange(page);
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(
    page.getByRole("listbox", { name: "Document layers" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
});

test.describe("high-density visual evidence", () => {
  test.use({ deviceScaleFactor: 2 });

  test("renders selected Layers state at high DPI", async ({ page }) => {
    await page.goto("./");
    await openComposer(page);
    await fillBaseProposal(page, "High-density Layers review");
    await addImageChange(page);
    await page.getByRole("button", { name: "Submit proposal" }).click();
    await page.getByRole("button", { name: "Inspect Image change" }).click();
    await expect(
      page.getByRole("option", {
        name: "Image, selected, 1 proposed change",
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `${screenshotDir}/layers-high-dpi-1440x900.png`,
    });
  });
});
