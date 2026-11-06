/**
 * The owner's rule: the navigation must work like the Reference Site on http://localhost:3000/.
 * This spec uses visible text and roles only, so it runs unchanged on both sites:
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/navigation.spec.ts
 */
import type { Page } from "@playwright/test";
import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const MENU_ITEMS: readonly (readonly [label: string, path: string])[] = [
  ["Home", "/"],
  ["About", "/about/"],
  ["Projects", "/projects/"],
  ["Capabilities", "/capabilities/"],
  ["Process", "/process/"],
  ["Contact", "/contact/"],
];

function urlOf(path: string): string {
  return new URL(pageUrl(path), BASE_URL).href;
}

async function expectAt(page: Page, path: string): Promise<void> {
  await expect(page).toHaveURL(urlOf(path));
}

test.describe("at 1440 px", () => {
  test.use({ viewport: DESKTOP });

  for (const [label, path] of MENU_ITEMS) {
    test(`the header's ${label} link opens ${path} and marks itself active`, async ({ page }) => {
      // Arrange
      await page.goto(pageUrl("/process/"));
      const menu = page.getByRole("navigation", { name: "Main" });

      // Act
      await menu.getByRole("link", { name: label, exact: true }).click();

      // Assert
      await expectAt(page, path);
      await expect(menu.getByRole("link", { name: label, exact: true })).toHaveClass(/text-gold/);
    });
  }

  test("the header marks only the current section as active", async ({ page }) => {
    // Arrange / Act
    await page.goto(pageUrl("/projects/amherst/"));
    const menu = page.getByRole("navigation", { name: "Main" });

    // Assert
    await expect(menu.getByRole("link", { name: "Projects", exact: true })).toHaveClass(/text-gold/);
    await expect(menu.getByRole("link", { name: "Home", exact: true })).toHaveClass(/text-ink/);
    await expect(menu.getByRole("link", { name: "About", exact: true })).toHaveClass(/text-ink/);
  });

  test("the logo leads home and the header's Client Login leads to the login page", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/about/"));

    // Act / Assert
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Client Login" }).click();
    await expectAt(page, "/login/");
    await page.getByRole("link", { name: "Numa Living home" }).click();
    await expectAt(page, "/");
  });

  for (const [label, path] of [...MENU_ITEMS, ["Client Login", "/login/"] as const]) {
    test(`the footer's ${label} link opens ${path}`, async ({ page }) => {
      // Arrange
      await page.goto(pageUrl("/capabilities/"));

      // Act
      await page.getByRole("contentinfo").getByRole("link", { name: label, exact: true }).click();

      // Assert
      await expectAt(page, path);
    });
  }

  test("the footer's address opens an email to the Contact email", async ({ page }) => {
    // Arrange / Act
    await page.goto(pageUrl("/"));

    // Assert
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /^projects@numaliving\./ })).toHaveAttribute("href", /^mailto:projects@numaliving\./);
  });

  test("the Enquire Now tab opens the Contact page, and is not there in the Demo Portal", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/about/"));

    // Act
    await page.getByRole("link", { name: "Enquire Now" }).click();

    // Assert
    await expectAt(page, "/contact/");
    await page.goto(pageUrl("/portal/"));
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByRole("link", { name: "Enquire Now" })).toHaveCount(0);
  });

  const HOME_LINKS: readonly (readonly [label: string, path: string])[] = [
    ["Request a Quote", "/contact/"],
    ["View Projects", "/projects/"],
    ["All projects →", "/projects/"],
    ["Our Story", "/about/"],
    ["Our Process", "/process/"],
    ["Client Login →", "/login/"],
  ];
  for (const [label, path] of HOME_LINKS) {
    test(`the home page's ${label} link opens ${path}`, async ({ page }) => {
      // Arrange
      await page.goto(pageUrl("/"));

      // Act
      await page.getByRole("main").getByRole("link", { name: label, exact: true }).first().click();

      // Assert
      await expectAt(page, path);
    });
  }

  test("a project card opens its page, which leads back and on to the Contact page", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));

    // Act / Assert
    await page.getByRole("main").getByRole("link", { name: /Signature Villa, Dubai Marina/ }).click();
    await expectAt(page, "/projects/marina-villa/");
    await page.getByRole("link", { name: "← All projects" }).click();
    await expectAt(page, "/projects/");
    await page.goBack();
    await expectAt(page, "/projects/marina-villa/");
    await page.getByRole("link", { name: "Discuss a Similar Project" }).click();
    await expectAt(page, "/contact/");
  });

  test("a renamed project is reached from its card", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));

    // Act
    await page.getByRole("main").getByRole("link", { name: /Amherst Ct/ }).click();

    // Assert
    await expectAt(page, "/projects/amherst/");
    await expect(page.getByRole("heading", { level: 1, name: "Amherst Ct" })).toBeVisible();
  });

  test("the sector buttons and country list filter the projects", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));
    const main = page.getByRole("main");
    const count = main.getByText(/^\d+ projects?$/);
    const cards = main.locator('a[href*="/projects/"]');
    const sectors = main.getByRole("group", { name: "Filter by sector" });
    await expect(count).toHaveText("9 projects");
    await expect(cards).toHaveCount(9);
    const visibleCards = cards.locator("visible=true");

    // Act / Assert: one sector
    await sectors.getByRole("button", { name: "Multifamily" }).click();
    await expect(sectors.getByRole("button", { name: "Multifamily" })).toHaveAttribute("aria-pressed", "true");
    await expect(sectors.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await expect(count).toHaveText(`${await visibleCards.count()} ${(await visibleCards.count()) === 1 ? "project" : "projects"}`);
    for (const card of await visibleCards.all()) await expect(card).toContainText("Multifamily");

    // Act / Assert: back to all, then one country
    await sectors.getByRole("button", { name: "All" }).click();
    await expect(count).toHaveText("9 projects");
    await main.getByLabel("Country").selectOption("USA");
    for (const card of await visibleCards.all()) await expect(card).toContainText("USA");
  });

  test("filters with no match say so", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/projects/"));
    const main = page.getByRole("main");
    const options = await main.getByLabel("Country").locator("option").allTextContents();
    const sectors = await main.getByRole("group", { name: "Filter by sector" }).getByRole("button").allTextContents();
    expect(options[0]).toBe("All");
    expect(sectors[0]).toBe("All");

    // Act: find a pair with nothing in it
    let found = false;
    for (const sector of sectors.slice(1)) {
      await main.getByRole("button", { name: sector, exact: true }).click();
      for (const country of options.slice(1)) {
        await main.getByLabel("Country").selectOption(country);
        if ((await main.getByText("0 projects").count()) > 0) {
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Assert
    expect(found, "some sector and country pair has no projects").toBe(true);
    await expect(main.getByText("No projects match these filters yet.")).toBeVisible();
  });
});

test.describe("at 390 px", () => {
  test.use({ viewport: PHONE });

  test("the menu opens and closes, and shows all six links plus Client Login", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/"));
    const menu = page.getByRole("navigation", { name: "Mobile" });
    await expect(menu).toHaveCount(0);

    // Act: open
    await page.getByRole("button", { name: "Open menu" }).click();

    // Assert
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    for (const [label] of MENU_ITEMS) await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Client Login" })).toBeVisible();

    // Act: close
    await page.getByRole("button", { name: "Close menu" }).click();

    // Assert
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  for (const [label, path] of [...MENU_ITEMS, ["Client Login", "/login/"] as const]) {
    test(`the menu's ${label} link opens ${path} and the menu is closed there`, async ({ page }) => {
      // Arrange
      await page.goto(pageUrl("/process/"));
      await page.getByRole("button", { name: "Open menu" }).click();

      // Act
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: label, exact: true }).click();

      // Assert
      await expectAt(page, path);
      await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
    });
  }

  test("the menu marks the current section", async ({ page }) => {
    // Arrange
    await page.goto(pageUrl("/capabilities/"));

    // Act
    await page.getByRole("button", { name: "Open menu" }).click();

    // Assert
    const menu = page.getByRole("navigation", { name: "Mobile" });
    await expect(menu.getByRole("link", { name: "Capabilities", exact: true })).toHaveClass(/text-gold/);
    await expect(menu.getByRole("link", { name: "About", exact: true })).toHaveClass(/text-ink/);
  });
});
