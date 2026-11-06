import { defineConfig } from "@playwright/test";
import { BASE_URL, IS_EXTERNAL_SITE, IS_REFERENCE_SITE, SERVER_HOST, SERVER_PORT } from "./e2e/env";

/**
 * End-to-end tests. By default they run against the Jekyll output (`npm run build:site` first), served
 * by scripts/serve-pages.mjs the way GitHub Pages serves it. With E2E_BASE_URL set they run against that
 * address instead and no server is started, so the same specs can check the Reference Site on
 * localhost:3000, the preview or the published site.
 *
 * Specs set their own viewport, because each one checks a different list of widths.
 */

const isCI = Boolean(process.env.CI);
// PARITY_DIFF_RATIO=0 shows the exact difference on every page, for a closer look.
const MAX_SCREENSHOT_DIFF_RATIO = Number(process.env.PARITY_DIFF_RATIO ?? 0.01);
// The Reference Site compiles each page on its first visit, so its first answer can be slow.
const EXPECT_TIMEOUT_MS = 15_000;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: isCI ? 2 : 4,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  // Screenshots and text from the Reference Site, kept out of git and compared by e2e/parity.spec.ts.
  // A run on the Reference Site saves them. Any other run only compares, so it can never replace them.
  snapshotPathTemplate: ".parity/{arg}{ext}",
  updateSnapshots: IS_REFERENCE_SITE ? "all" : "none",
  expect: {
    timeout: EXPECT_TIMEOUT_MS,
    toHaveScreenshot: { maxDiffPixelRatio: MAX_SCREENSHOT_DIFF_RATIO, animations: "disabled" },
  },
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },
  webServer: IS_EXTERNAL_SITE
    ? undefined
    : {
        command: `node scripts/serve-pages.mjs --root _site --host ${SERVER_HOST} --port ${SERVER_PORT}`,
        url: BASE_URL,
        reuseExistingServer: !isCI,
      },
});
