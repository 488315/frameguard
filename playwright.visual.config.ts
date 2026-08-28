import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { platform } from "node:os";

function assertCanonicalSnapshotUpdateHost() {
  const updatesSnapshots = process.argv.some(
    (argument) =>
      argument === "--update-snapshots" ||
      argument.startsWith("--update-snapshots="),
  );
  if (!updatesSnapshots) return;

  let release = "";
  try {
    release = readFileSync("/etc/os-release", "utf8");
  } catch {
    // The platform check below provides the actionable error.
  }
  const isCanonicalHost =
    platform() === "linux" &&
    /^ID=ubuntu$/m.test(release) &&
    /^VERSION_ID="?24\.04"?$/m.test(release);
  if (!isCanonicalHost) {
    throw new Error(
      "Visual baselines may only be updated on Ubuntu 24.04. Run the comparison without --update-snapshots on this host.",
    );
  }
}

assertCanonicalSnapshotUpdateHost();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "visual-regression.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:4176/frameguard/",
        viewport: { width: 1440, height: 900 },
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: "light",
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4176",
    url: "http://127.0.0.1:4176/frameguard/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
