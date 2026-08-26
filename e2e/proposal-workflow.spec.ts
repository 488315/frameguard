import { expect, test, type Page } from "@playwright/test";

const screenshotDir = "artifacts/proposal-workflow";

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
  await page.screenshot({ path: `${screenshotDir}/05-active-proposal.png` });
  await page.getByRole("button", { name: "Inspect Image change" }).click();
  await expect(page.getByLabel("proposed crop boundary")).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/06-selected-change-preview.png`,
  });

  await page.getByRole("button", { name: "Approve Headline change" }).click();
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
