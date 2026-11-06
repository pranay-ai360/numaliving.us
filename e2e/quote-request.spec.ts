/**
 * The Quote Request form, which Tally hosts in an iframe (ADR 0004). Every test gets a stand-in for Tally from
 * ./fixtures, so nothing here can reach the real form or email Numa, even when run against the live site.
 */
import type { Locator, Page } from "@playwright/test";
import { IS_REFERENCE_SITE } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";
import { TALLY_SCRIPT_ROUTE } from "./tally-stub";

const CONTACT_EMAIL = "projects@numaliving.us";
const REFERENCE = /^NL-[A-HJ-NP-Z2-9]{6}$/;
const EMBED_SELECTOR = "iframe[data-tally-embed]";
// The real form's height at phone width and at desktop width, less a little, so the page does not jump as it loads.
const MIN_RESERVED_HEIGHT_PX = 1100;

const embed = (page: Page): Locator => page.locator(EMBED_SELECTOR);
const thankYou = (page: Page): Locator => page.getByText("Thank You");
const formAlert = (page: Page): Locator => page.locator("[data-quote-error]");

/** The address the script gave the iframe, once it has. */
async function embedAddress(page: Page): Promise<URL> {
  await expect(embed(page)).toHaveAttribute("src", /^https:\/\/tally\.so\/embed\//);
  return new URL((await embed(page).getAttribute("src")) ?? "");
}

async function openForm(page: Page): Promise<URL> {
  await page.goto(pageUrl("/contact/"));
  return embedAddress(page);
}

const pressSend = (page: Page): Promise<void> => page.frameLocator(EMBED_SELECTOR).getByRole("button", { name: "Send Request" }).click();

test.skip(IS_REFERENCE_SITE, "The Reference Site has a form of its own.");

for (const [label, viewport] of [["390 px", { width: 390, height: 844 }], ["1440 px", { width: 1440, height: 900 }]] as const) {
  test.describe(`at ${label}`, () => {
    test.use({ viewport });

    test("the embed opens the published form, fitted into the page, with a reference for the request", async ({ page }) => {
      // Act
      const address = await openForm(page);

      // Assert
      expect(address.pathname).toMatch(/^\/embed\/[A-Za-z0-9]+$/);
      expect(address.searchParams.get("hideTitle")).toBe("1");
      expect(address.searchParams.get("transparentBackground")).toBe("1");
      expect(address.searchParams.get("alignLeft")).toBe("1");
      expect(address.searchParams.get("dynamicHeight")).toBe("1");
      expect(address.searchParams.get("reference")).toMatch(REFERENCE);
      await expect(embed(page)).toHaveAttribute("title", /form/i);
      await expect(thankYou(page)).toBeHidden();
    });

    test("the form's space is reserved, so the page does not jump as it loads", async ({ page }) => {
      // Arrange: hold the script back, so this measures the page before the form arrives.
      await page.route(TALLY_SCRIPT_ROUTE, () => undefined);

      // Act
      await page.goto(pageUrl("/contact/"), { waitUntil: "domcontentloaded" });

      // Assert
      const box = await embed(page).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_RESERVED_HEIGHT_PX);
    });

    test("a sent request shows Thank You, in view, with the same reference that went to Tally", async ({ page }) => {
      // Arrange
      const address = await openForm(page);

      // Act
      await pressSend(page);

      // Assert
      await expect(thankYou(page)).toBeInViewport();
      // The form held the focus and has gone, so keyboard and screen reader users are taken to the confirmation.
      await expect(page.locator("[data-quote-success]")).toBeFocused();
      await expect(page.getByText("We have your request. Our team will reply within two working days.")).toBeVisible();
      await expect(page.locator("[data-quote-reference]")).toHaveText(address.searchParams.get("reference") ?? "no reference");
      await expect(embed(page)).toBeHidden();
    });

    test("Send another request brings the form back, with a new reference", async ({ page }) => {
      // Arrange
      const first = await openForm(page);
      await pressSend(page);
      await expect(thankYou(page)).toBeVisible();

      // Act
      await page.getByRole("button", { name: /Send another request/ }).click();

      // Assert
      await expect(thankYou(page)).toBeHidden();
      await expect(embed(page)).toBeVisible();
      const second = await embedAddress(page);
      expect(second.searchParams.get("reference")).toMatch(REFERENCE);
      expect(second.searchParams.get("reference")).not.toBe(first.searchParams.get("reference"));
    });

    test("a message that does not come from Tally is never shown as sent", async ({ page }) => {
      // Arrange
      const address = await openForm(page);
      const formId = address.pathname.split("/").pop() ?? "";

      // Act: this page posting to itself has the site's own origin, as any other page's would be its own.
      await page.evaluate((id) => {
        window.postMessage(JSON.stringify({ event: "Tally.FormSubmitted", payload: { id: "forged", formId: id } }), "*");
      }, formId);
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));

      // Assert
      await expect(thankYou(page)).toBeHidden();
      await expect(embed(page)).toBeVisible();
    });

    test("under the form, the Contact email is always there as another way", async ({ page }) => {
      // Act
      await openForm(page);

      // Assert
      const help = page.locator("[data-quote-help]");
      await expect(help).toBeVisible();
      await expect(help.getByRole("link", { name: CONTACT_EMAIL })).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);
      await expect(formAlert(page)).toBeHidden();
    });

    test.describe("when Tally cannot be reached", () => {
      test.use({ allowedConsoleErrors: [/Failed to load|ERR_FAILED/] });

      test("an alert names the Contact email and the empty form is gone", async ({ page }) => {
        // Arrange
        await page.route(TALLY_SCRIPT_ROUTE, (route) => route.abort());

        // Act
        await page.goto(pageUrl("/contact/"));

        // Assert
        await expect(formAlert(page)).toBeVisible();
        await expect(formAlert(page).getByRole("link", { name: CONTACT_EMAIL })).toBeVisible();
        await expect(embed(page)).toBeHidden();
        await expect(page.locator("[data-quote-help]")).toBeHidden();
      });
    });

    test("Tally's script loading without its widget counts as not reached", async ({ page }) => {
      // Arrange
      await page.route(TALLY_SCRIPT_ROUTE, (route) => route.fulfill({ contentType: "application/javascript", body: "" }));

      // Act
      await page.goto(pageUrl("/contact/"));

      // Assert
      await expect(formAlert(page)).toBeVisible();
      await expect(embed(page)).toBeHidden();
    });
  });
}

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("a link opens the form on Tally's own page, with no empty frame in the way", async ({ page }) => {
    // Act
    await page.goto(pageUrl("/contact/"));

    // Assert
    await expect(page.getByRole("link", { name: /open the form/i })).toHaveAttribute("href", /^https:\/\/tally\.so\/r\/[A-Za-z0-9]+$/);
    await expect(embed(page)).toBeHidden();
  });
});
