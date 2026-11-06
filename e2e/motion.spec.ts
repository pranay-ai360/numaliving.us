/**
 * The owner's rule: animations and transitions must carry over from the Reference Site. Screenshots run
 * with animations off, so this hovers, focuses and clicks, and checks what happens. It runs unchanged on both sites:
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/motion.spec.ts
 */
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const GOLD = "rgb(172, 143, 80)";
const GOLD_DARK = "rgb(138, 113, 59)";
const INK = "rgb(38, 30, 15)";
const WHITE = "rgb(255, 255, 255)";

test.describe("at 1440 px", () => {
  test.use({ viewport: DESKTOP });

  test("a project card's photo zooms slowly and its title turns gold on hover", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));
    const card = page.getByRole("main").getByRole("link", { name: /Signature Villa, Dubai Marina/ });
    const photo = card.getByRole("img");
    const title = card.getByRole("heading");
    await expect(photo).toHaveCSS("transition-duration", "0.5s");
    await expect(photo).toHaveCSS("scale", "none");

    // Act
    await card.hover();

    // Assert
    await expect(photo).toHaveCSS("scale", "1.03");
    await expect(title).toHaveCSS("color", GOLD);
  });

  test("a photo tile zooms more slowly still on hover", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/capabilities/"));
    const tile = page.getByRole("figure").filter({ hasText: "Bookmatched veneer" });
    const photo = tile.getByRole("img");
    await expect(photo).toHaveCSS("transition-duration", "0.7s");

    // Act
    await tile.hover();

    // Assert
    await expect(photo).toHaveCSS("scale", "1.04");
  });

  test("a header link fades to gold on hover", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About", exact: true });
    await expect(link).toHaveCSS("color", INK);
    await expect(link).toHaveCSS("transition-property", /color/);
    await expect(link).toHaveCSS("transition-duration", "0.15s");

    // Act
    await link.hover();

    // Assert
    await expect(link).toHaveCSS("color", GOLD);
  });

  test("the solid and outlined buttons fade on hover", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));
    const solid = page.getByRole("main").getByRole("link", { name: "Request a Quote" }).first();
    const outlined = page.getByRole("main").getByRole("link", { name: "View Projects" });
    await expect(solid).toHaveCSS("background-color", GOLD);

    // Act / Assert
    await solid.hover();
    await expect(solid).toHaveCSS("background-color", GOLD_DARK);
    await outlined.hover();
    await expect(outlined).toHaveCSS("background-color", GOLD);
    await expect(outlined).toHaveCSS("color", WHITE);
  });

  test("a filter button fades to its pressed look", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));
    const sector = page.getByRole("group", { name: "Filter by sector" }).getByRole("button", { name: "Multifamily" });
    await expect(sector).toHaveCSS("transition-property", /color/);

    // Act
    await sector.click();
    await page.mouse.move(0, 0);

    // Assert
    await expect(sector).toHaveCSS("background-color", GOLD);
    await expect(sector).toHaveCSS("color", WHITE);
  });

  test("the factory marker pulses, and stops for people who prefer less motion", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/about/"));
    const pulse = page.locator(".map-pulse");

    // Assert
    await expect(pulse).toHaveCSS("animation-name", "map-pulse");
    await expect(pulse).toHaveCSS("animation-duration", "3s");
    await expect(pulse).toHaveCSS("animation-iteration-count", "infinite");

    // Act
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Assert
    await expect(pulse).toHaveCSS("animation-name", "none");
  });

  test("the page scrolls smoothly, and the skip link glides to the content", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/about/"));
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "smooth");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const mainTop = await page.locator("main").evaluate((main) => main.getBoundingClientRect().top + window.scrollY);
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

    // Act: the link sits at the very top, so focusing it scrolls there first
    await page.locator('a[href="#main"]').focus();
    await expect.poll(scrollY).toBe(0);
    await page.keyboard.press("Enter");

    // Assert
    await expect(page).toHaveURL(/#main$/);
    await expect.poll(scrollY).toBe(Math.round(mainTop));
  });

  test("the skip link appears when it gets focus", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toHaveCSS("position", "absolute");
    await expect(skip).toHaveCSS("width", "1px");

    // Act
    await skip.focus();

    // Assert
    await expect(skip).not.toHaveCSS("width", "1px");
  });

  test("keyboard focus draws the gold outline", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));

    // Act: the first Tab lands on the skip link
    await page.keyboard.press("Tab");

    // Assert
    const focused = page.locator(":focus");
    await expect(focused).toHaveCSS("outline-color", GOLD);
    await expect(focused).toHaveCSS("outline-width", "2px");
  });
});

test.describe("at 390 px", () => {
  test.use({ viewport: PHONE });

  test("the menu's bars turn into a cross and back", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));
    const bars = page.getByRole("button", { name: "Open menu" }).locator("span > span");
    await expect(bars).toHaveCount(3);
    await expect(bars.nth(0)).toHaveCSS("transition-property", /rotate|transform/);
    await expect(bars.nth(1)).toHaveCSS("transition-property", "opacity");
    await expect(bars.nth(1)).toHaveCSS("opacity", "1");

    // Act: open
    await page.getByRole("button", { name: "Open menu" }).click();

    // Assert
    const openBars = page.getByRole("button", { name: "Close menu" }).locator("span > span");
    await expect(openBars.nth(0)).toHaveCSS("rotate", "45deg");
    await expect(openBars.nth(1)).toHaveCSS("opacity", "0");
    await expect(openBars.nth(2)).toHaveCSS("rotate", "-45deg");

    // Act: close
    await page.getByRole("button", { name: "Close menu" }).click();

    // Assert
    await expect(bars.nth(0)).toHaveCSS("rotate", "none");
    await expect(bars.nth(1)).toHaveCSS("opacity", "1");
  });
});
