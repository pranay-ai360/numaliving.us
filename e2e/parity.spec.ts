/**
 * The owner's rule: the design and the content must match the Reference Site on http://localhost:3000/.
 *
 * A run with E2E_BASE_URL=http://localhost:3000 saves each page's visible text and a full-page screenshot
 * to .parity/. A run on the Jekyll build compares against them. Only the listed "Visible changes" may differ.
 *
 * Local only: the Reference Site is not in the repository, so CI skips this. Removed with reference-site/.
 */
import { expect, test, type Page } from "@playwright/test";
import { IS_REFERENCE_SITE } from "./env";
import { ALL_PAGES, pageName, pageUrl } from "./site";
import { standInForTally } from "./tally-stub";

const WIDTHS = [390, 1440];
const VIEWPORT_HEIGHT = 900;
const SCROLL_PAUSE_MS = 60;
const TEST_TIMEOUT_MS = 180_000;
const SCREENSHOT_TIMEOUT_MS = 60_000;

/** "Visible change" 1 in the plan. The Reference Site's text is corrected before it is saved. */
const ALLOWED_TEXT_CHANGES: readonly (readonly [string, string])[] = [["projects@numaliving.com", "projects@numaliving.us"]];

/**
 * "Visible change" 8: Tally hosts the form now, so the rest of the Contact page is what can be compared. An empty
 * block stays in its place, so the column beside it does not move.
 */
function setTheFormAside(page: Page): Promise<void> {
  return page.evaluate(() => {
    document.querySelectorAll("form, [data-quote-form]").forEach((form) => form.replaceWith(document.createElement("div")));
  });
}

function comparableText(raw: string): string {
  const corrected = IS_REFERENCE_SITE
    ? ALLOWED_TEXT_CHANGES.reduce((text, [from, to]) => text.replaceAll(from, to), raw)
    : raw;
  return corrected
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

/** Gets the page ready to compare: no dev overlay, every lazy photo and font loaded, scrolled back to the top. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async (pauseMs) => {
    // Not part of the design: Next's dev overlay, and the visually hidden <h1> the plan adds to /projects/.
    document.querySelectorAll("nextjs-portal, next-route-announcer, h1.sr-only").forEach((node) => node.remove());
    const pause = () => new Promise((resolve) => setTimeout(resolve, pauseMs));
    for (let top = 0; top < document.documentElement.scrollHeight; top += window.innerHeight) {
      window.scrollTo({ top, behavior: "instant" });
      await pause();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await document.fonts.ready;
    await Promise.all(
      // A lazy image inside a hidden block, such as the laptop preview on a phone, never loads.
      Array.from(document.images).map((image) =>
        image.complete || !image.checkVisibility()
          ? null
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
  }, SCROLL_PAUSE_MS);
}

/**
 * Screenshots run with animations off, so motion gets its own list: each rendered element's transition and
 * animation, plus its hover, focus and disabled classes, which no screenshot of a resting page can show.
 */
function motionList(page: Page): Promise<string> {
  return page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      if (!element.checkVisibility()) continue;
      const style = getComputedStyle(element);
      const hasTransition = style.transitionDuration.split(",").some((duration) => Number.parseFloat(duration) > 0);
      const hasAnimation = style.animationName !== "none";
      const states = (element.getAttribute("class") ?? "")
        .split(/\s+/)
        .filter((name) => /^(hover|focus|active|disabled|group-hover):/.test(name))
        .sort();
      if (!hasTransition && !hasAnimation && states.length === 0) continue;
      const line = [
        element.tagName.toLowerCase(),
        hasTransition ? `transition ${style.transitionProperty} ${style.transitionDuration} ${style.transitionTimingFunction}` : "",
        hasAnimation ? `animation ${style.animationName} ${style.animationDuration} ${style.animationIterationCount}` : "",
        states.join(" "),
      ]
        .filter((part) => part !== "")
        .join(" | ");
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    return [...counts].map(([line, count]) => `${count} x ${line}`).sort().join("\n");
  });
}

test.skip(Boolean(process.env.CI), "The Reference Site only exists on the owner's machine.");

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    for (const path of ALL_PAGES) {
      test(`${path} matches the Reference Site`, async ({ page }) => {
        test.setTimeout(TEST_TIMEOUT_MS);

        // Arrange
        await standInForTally(page.context());
        await page.goto(pageUrl(path));
        if (path === "/contact/") await setTheFormAside(page);
        await settle(page);
        const name = `${pageName(path)}-${width}`;

        // Act
        const text = comparableText(await page.locator("body").innerText());

        // Assert
        expect(`${text}\n`).toMatchSnapshot(`${name}.txt`);
        expect(`${await motionList(page)}\n`).toMatchSnapshot(`${name}.motion.txt`);
        await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, timeout: SCREENSHOT_TIMEOUT_MS });
      });
    }
  });
}
