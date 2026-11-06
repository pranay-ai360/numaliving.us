/**
 * No sideways scrolling and no broken photos at any phone, tablet or laptop width, on any of the 22 pages.
 */
import { expect, test } from "./fixtures";
import { IS_REFERENCE_SITE } from "./env";
import { ALL_PAGES, pageUrl } from "./site";

const WIDTHS = [320, 390, 768, 1440];
const VIEWPORT_HEIGHT = 900;
const SCROLL_PAUSE_MS = 40;
const TEST_TIMEOUT_MS = 60_000;

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    for (const path of ALL_PAGES) {
      test(`${path} fits and has no broken photos`, async ({ page }) => {
        test.setTimeout(TEST_TIMEOUT_MS);

        // Act
        await page.goto(pageUrl(path));
        const problems = await page.evaluate(async (pauseMs) => {
          for (let top = 0; top < document.documentElement.scrollHeight; top += window.innerHeight) {
            window.scrollTo({ top, behavior: "instant" });
            await new Promise((resolve) => setTimeout(resolve, pauseMs));
          }
          // A lazy photo inside a hidden block, such as the laptop preview on a phone, is never asked for.
          const shown = Array.from(document.images).filter((image) => image.checkVisibility());
          await Promise.all(
            shown.map((image) =>
              image.complete
                ? null
                : new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                  }),
            ),
          );
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            broken: shown.filter((image) => image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
          };
        }, SCROLL_PAUSE_MS);

        // Assert
        expect(problems.overflow, "how far the page scrolls sideways").toBeLessThanOrEqual(0);
        expect(problems.broken).toEqual([]);
      });
    }
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the viewport tag is there", async ({ page }) => {
    // Act
    await page.goto(pageUrl("/"));

    // Assert
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1");
  });

  test("a project page loads its hero at once and its gallery as you scroll", async ({ page }) => {
    test.skip(IS_REFERENCE_SITE, "Lazy-loading is new on the Jekyll site.");

    // Act
    await page.goto(pageUrl("/projects/poppy-16/"));

    // Assert
    const images = page.getByRole("main").getByRole("img");
    await expect(images.first()).toHaveAttribute("loading", "eager");
    await expect(images.first()).toHaveAttribute("fetchpriority", "high");
    const rest = await images.all();
    expect(rest.length).toBeGreaterThan(1);
    for (const image of rest.slice(1)) await expect(image).toHaveAttribute("loading", "lazy");
  });

  test("the first project on the Projects page loads at once and the others as you scroll", async ({ page }) => {
    test.skip(IS_REFERENCE_SITE, "Lazy-loading is new on the Jekyll site.");

    // Act
    await page.goto(pageUrl("/projects/"));

    // Assert
    const images = page.getByRole("main").getByRole("img");
    await expect(images.first()).toHaveAttribute("loading", "eager");
    await expect(images.nth(1)).toHaveAttribute("loading", "lazy");
  });
});
