/**
 * Phones get the small copies of the photos, not the original JPEGs (`npm run images:build`), so the site stays
 * as quick as the one it replaced: about 450 KB on a project page.
 */
import { IS_REFERENCE_SITE } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const KB = 1024;
const MAX_FIRST_SCREEN_IMAGE_BYTES = 1500 * KB;
const COPY = /-\d+\.(avif|webp)$/;

test.skip(IS_REFERENCE_SITE, "The small copies are new on the Jekyll site.");

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  for (const path of ["/projects/poppy-16/", "/projects/golf-links/", "/projects/", "/capabilities/"]) {
    test(`${path} loads small copies and stays within its budget`, async ({ page }) => {
      // Act
      await page.goto(pageUrl(path));
      await page.waitForLoadState("networkidle");

      // Assert
      const images = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === "img")
          .map((entry) => ({ name: decodeURI(entry.name), bytes: (entry as PerformanceResourceTiming).encodedBodySize })),
      );
      expect(images.length).toBeGreaterThan(0);
      const projectPhotos = images.filter((image) => /\/assets\/(projects|craft)\//.test(image.name));
      expect(projectPhotos.filter((image) => !COPY.test(image.name)).map((image) => image.name)).toEqual([]);
      const total = images.reduce((sum, image) => sum + image.bytes, 0);
      expect(total, "image bytes before any scrolling").toBeLessThan(MAX_FIRST_SCREEN_IMAGE_BYTES);
    });
  }

  test("the browser picks a copy that fits the phone, not the largest", async ({ page }) => {
    // Act
    await page.goto(pageUrl("/projects/poppy-16/"));
    const hero = page.getByRole("main").getByRole("img").first();
    await expect(hero).toHaveJSProperty("complete", true);

    // Assert: 390 px wide at 2x needs about 780 px, so the 800 px copy
    expect(await hero.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/-800\.avif$/);
  });
});

test("a photo with spaces in its name reaches the browser through its copies", async ({ page }) => {
  // Act
  await page.goto(pageUrl("/projects/golf-links/"));
  const hero = page.getByRole("main").getByRole("img").first();
  await expect(hero).toHaveJSProperty("complete", true);

  // Assert
  expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  expect(await hero.evaluate((image: HTMLImageElement) => decodeURI(image.currentSrc))).toContain("Condor Golf Links18 _ Photo by Intelier1-");
});
