/**
 * The Client Login and the Demo Portal must behave as they do on the Reference Site (D2). This spec uses
 * visible text and roles only, so it runs unchanged on both sites:
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/portal.spec.ts
 */
import type { Locator, Page } from "@playwright/test";
import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const ARCHITECT = "Daniel Ortiz";
const OWNER = "Sara Al Mansoori";
const CONTRACTOR = "Ravi Menon";

const portalMenu = (page: Page): Locator => page.getByRole("navigation", { name: "Portal" });
const signedIn = (page: Page): Locator => page.getByText("Signed in as");
const waitingFor = (page: Page): Locator => page.getByRole("region", { name: "Waiting for you" });

function urlOf(path: string): string {
  return new URL(pageUrl(path), BASE_URL).href;
}

async function openPortal(page: Page, path = "/portal/"): Promise<void> {
  await page.goto(pageUrl(path));
  await page.waitForLoadState("networkidle");
  await expect(signedIn(page)).toBeVisible();
}

async function viewAs(page: Page, label: string, person: string): Promise<void> {
  await page.getByRole("group", { name: "Demo: view the portal as" }).getByRole("button", { name: label, exact: true }).click();
  await expect(signedIn(page)).toContainText(person);
}

async function goTo(page: Page, label: RegExp, path: string): Promise<void> {
  await portalMenu(page).getByRole("link", { name: label }).click();
  await expect(page).toHaveURL(urlOf(path));
  await expect(signedIn(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("Client Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pageUrl("/login/"));
    await page.waitForLoadState("networkidle");
  });

  test("Sign In explains that accounts are not open and offers the demo", async ({ page }) => {
    // Arrange
    await page.getByLabel("Email").fill("someone@numaliving.us");
    await page.getByLabel("Password").fill("not-a-real-password");

    // Act
    await page.getByRole("button", { name: "Sign In" }).click();

    // Assert
    await expect(page.getByRole("status")).toHaveText("Client accounts are being set up. In the meantime, you can try the demo below.");
    await expect(page.getByRole("button", { name: "View as Owner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "See a demo of the client portal →" })).toHaveCount(0);
  });

  test("Forgot password swaps the form to a reset, and back", async ({ page }) => {
    // Act
    await page.getByRole("button", { name: "Forgot password?" }).click();

    // Assert
    await expect(page.getByLabel("Password")).toBeHidden();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();

    // Act
    await page.getByRole("button", { name: "Back to sign in" }).click();

    // Assert
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("New project? Get in touch leads to the Contact page", async ({ page }) => {
    // Act
    await page.getByRole("link", { name: "New project? Get in touch" }).click();

    // Assert
    await expect(page).toHaveURL(urlOf("/contact/"));
  });

  for (const [label, person] of [["Owner", OWNER], ["Architect", ARCHITECT], ["Main contractor", CONTRACTOR]] as const) {
    test(`See a demo, then View as ${label}, opens the Demo Portal as ${person}`, async ({ page }) => {
      // Act
      await page.getByRole("button", { name: "See a demo of the client portal →" }).click();
      await expect(page.getByText("Demo only. Nothing you do is saved.")).toBeVisible();
      await page.getByRole("button", { name: `View as ${label}` }).click();

      // Assert
      await expect(page).toHaveURL(urlOf("/portal/"));
      await expect(signedIn(page)).toContainText(person);
    });
  }
});

test.describe("Demo Portal", () => {
  test("starts as the architect, who is the client admin", async ({ page }) => {
    // Act
    await openPortal(page);

    // Assert
    await expect(signedIn(page)).toContainText(ARCHITECT);
    await expect(signedIn(page)).toContainText(/client admin/i);
    await expect(page.getByRole("heading", { level: 1, name: "Marina Villa" })).toBeVisible();
  });

  test("the side menu and what is waiting follow the role", async ({ page }) => {
    // Arrange
    await openPortal(page);
    const menu = portalMenu(page).getByRole("link");

    // Assert: architect
    await expect(menu).toHaveText(["Overview", /^Approvals\s*2$/, /^RFIs\s*1$/, "Production & shipping", "Installation videos", "Team & access"]);
    await expect(waitingFor(page).getByRole("link")).toHaveCount(3);
    await expect(waitingFor(page)).toContainText("SD-104 Rev B · Kitchen island");
    await expect(page.getByText("Commercials are hidden for you.")).toHaveCount(0);

    // Act / Assert: owner
    await viewAs(page, "Owner", OWNER);
    await expect(menu).toHaveText(["Overview", /^Approvals\s*2$/, "RFIs", "Production & shipping", "Installation videos", "Team & access"]);
    await expect(waitingFor(page).getByRole("link")).toHaveCount(3);
    await expect(waitingFor(page)).toContainText("Variation VO-03");

    // Act / Assert: main contractor
    await viewAs(page, "Main contractor", CONTRACTOR);
    await expect(menu).toHaveText(["Overview", "Approvals", /^RFIs\s*1$/, /^Production & shipping\s*1$/, "Installation videos", "Team & access"]);
    await expect(waitingFor(page).getByRole("link")).toHaveCount(2);
    await expect(page.getByText("Commercials are hidden for you.")).toBeVisible();
  });

  test("a waiting item leads to its screen", async ({ page }) => {
    // Arrange
    await openPortal(page);

    // Act
    await waitingFor(page).getByRole("link", { name: /RFI-012/ }).click();

    // Assert
    await expect(page).toHaveURL(urlOf("/portal/rfis/"));
  });

  test("the current screen is marked in the side menu", async ({ page }) => {
    // Act
    await openPortal(page, "/portal/team/");

    // Assert
    await expect(portalMenu(page).getByRole("link", { name: "Team & access" })).toHaveAttribute("aria-current", "page");
    await expect(portalMenu(page).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
  });

  test.describe("Approvals", () => {
    test("approving a shop drawing shows the outcome and clears it from the list", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      const review = page.getByRole("region", { name: "Review" });
      await expect(review.getByRole("heading")).toHaveText("SD-104 Rev B · Kitchen island");

      // Act
      await review.getByRole("button", { name: "Approve" }).click();

      // Assert
      await expect(review.getByRole("status")).toHaveText("Approved. Numa has been notified.");
      await expect(page.getByRole("list", { name: "Items" }).getByRole("button", { name: /SD-104/ })).toContainText("Approved");
      await expect(review.getByRole("button", { name: "Approve" })).toHaveCount(0);
    });

    test("a comment makes it Approved with comments, and the box empties", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      const review = page.getByRole("region", { name: "Review" });
      await page.getByRole("list", { name: "Items" }).getByRole("button", { name: /SD-110/ }).click();
      await expect(review.getByRole("heading")).toHaveText("SD-110 Rev A · Library wall");

      // Act
      await review.getByLabel("Comments (optional)").fill("Increase the overhang.");
      await review.getByRole("button", { name: "Approve" }).click();

      // Assert
      await expect(review.getByRole("status")).toHaveText("Approved with comments. Numa has been notified.");
    });

    test("Revise & resubmit sends a sample back", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      await viewAs(page, "Owner", OWNER);
      await page.getByRole("tab", { name: "Samples" }).click();
      const review = page.getByRole("region", { name: "Review" });
      await expect(review.getByRole("heading")).toHaveText("Walnut veneer · Master bedroom panelling");
      await expect(review.getByText("Delivered to site office")).toBeVisible();

      // Act
      await review.getByRole("button", { name: "Revise & resubmit" }).click();

      // Assert
      await expect(review.getByRole("status")).toHaveText("Revise & resubmit. Numa has been notified and will issue the next revision.");
      await expect(page.getByRole("list", { name: "Items" }).getByRole("button", { name: /Walnut veneer/ })).toContainText("Sent back");
    });

    test("someone who cannot approve is told who can, and an item already decided needs nothing", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      await viewAs(page, "Main contractor", CONTRACTOR);
      const review = page.getByRole("region", { name: "Review" });

      // Assert
      await expect(review).toContainText("You can view this. Approval sits with Daniel Ortiz.");
      await expect(review.getByRole("button", { name: "Approve" })).toHaveCount(0);

      // Act
      await page.getByRole("list", { name: "Items" }).getByRole("button", { name: /SD-109/ }).click();

      // Assert
      await expect(review).toContainText("No action needed.");
    });

    test("a chosen design drawing is listed first as a new row, and only for people who may upload", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      await page.getByRole("tab", { name: "Design drawings" }).click();
      const rows = page.getByRole("table").getByRole("row");
      await expect(rows).toHaveCount(5);

      // Act
      await page.locator('input[type="file"]').setInputFiles({ name: "A-999 Test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });

      // Assert
      await expect(rows).toHaveCount(6);
      await expect(rows.nth(1)).toContainText("A-999 Test.pdf");
      await expect(rows.nth(1)).toContainText("v1");
      await expect(rows.nth(1)).toContainText(ARCHITECT);
      await expect(rows.nth(1)).toContainText("Just now");

      // Act: the owner may only view
      await viewAs(page, "Owner", OWNER);

      // Assert
      await expect(page.getByText("You can view design drawings. Uploading is set on Team & access.")).toBeVisible();
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
    });

    test("tabs a person has no right to are not offered", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");
      // The architect (client admin) hides samples from the main contractor: View to Act to Approve to Hidden.
      const samples = page.getByRole("button", { name: "Ravi Menon, Samples: View. Click to change." });
      await samples.click();
      await page.getByRole("button", { name: "Ravi Menon, Samples: Act. Click to change." }).click();
      await page.getByRole("button", { name: "Ravi Menon, Samples: Approve. Click to change." }).click();
      await expect(page.getByRole("button", { name: "Ravi Menon, Samples: Hidden. Click to change." })).toBeVisible();

      // Act
      await goTo(page, /^Approvals/, "/portal/approvals/");
      await viewAs(page, "Main contractor", CONTRACTOR);

      // Assert
      await expect(page.getByRole("tab")).toHaveText(["Shop drawings", "Design drawings"]);
    });
  });

  test.describe("what is kept while moving around", () => {
    test("a decision survives moving between portal pages", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");

      // Act
      await page.getByRole("region", { name: "Review" }).getByRole("button", { name: "Approve" }).click();
      await expect(portalMenu(page).getByRole("link", { name: /^Approvals/ })).toHaveText(/^Approvals\s*1$/);
      await goTo(page, /^Overview/, "/portal/");

      // Assert
      await expect(waitingFor(page).getByRole("link")).toHaveCount(2);
      await expect(waitingFor(page)).not.toContainText("SD-104");

      // Act
      await goTo(page, /^Approvals/, "/portal/approvals/");

      // Assert
      await expect(page.getByRole("region", { name: "Review" }).getByRole("status")).toHaveText("Approved. Numa has been notified.");
    });

    test("a refresh starts over but keeps the role", async ({ page }) => {
      // Arrange
      await openPortal(page);
      await viewAs(page, "Main contractor", CONTRACTOR);
      await goTo(page, /^Production/, "/portal/tracking/");
      await page.getByRole("button", { name: "Confirm site is ready" }).click();
      await expect(page.getByRole("status")).toHaveText("Site confirmed ready. Numa will book delivery.");

      // Act
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Assert
      await expect(signedIn(page)).toContainText(CONTRACTOR);
      await expect(page.getByRole("button", { name: "Confirm site is ready" })).toBeVisible();
    });

    test("leaving the Demo Portal and coming back starts over", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/approvals/");
      await page.getByRole("region", { name: "Review" }).getByRole("button", { name: "Approve" }).click();
      await expect(portalMenu(page).getByRole("link", { name: /^Approvals/ })).toHaveText(/^Approvals\s*1$/);

      // Act
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Client Login" }).click();
      await expect(page).toHaveURL(urlOf("/login/"));
      await page.getByRole("button", { name: "See a demo of the client portal →" }).click();
      await page.getByRole("button", { name: "View as Architect" }).click();
      await expect(page).toHaveURL(urlOf("/portal/"));

      // Assert
      await expect(portalMenu(page).getByRole("link", { name: /^Approvals/ })).toHaveText(/^Approvals\s*2$/);
    });
  });

  test.describe("RFIs", () => {
    test("the person it is addressed to can answer, and the answer joins the conversation", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");
      const conversation = page.getByRole("region", { name: "Conversation" });
      const list = page.getByRole("list", { name: "RFI list" });
      await expect(conversation.getByRole("heading")).toHaveText("Handle height on wardrobe doors");
      await expect(list.getByRole("button", { name: /RFI-012/ })).toContainText("Waiting for you");

      // Act
      await conversation.getByLabel("Your answer").fill("Centre them at 1200 mm.");
      await conversation.getByRole("button", { name: "Send answer" }).click();

      // Assert
      await expect(conversation).toContainText("Centre them at 1200 mm.");
      await expect(conversation).toContainText("Just now");
      await expect(list.getByRole("button", { name: /RFI-012/ })).toContainText("Answered");
      await expect(conversation.getByLabel("Your answer")).toHaveCount(0);
    });

    test("an empty answer is not sent", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");
      const conversation = page.getByRole("region", { name: "Conversation" });

      // Act
      await conversation.getByRole("button", { name: "Send answer" }).click();

      // Assert
      await expect(conversation.getByLabel("Your answer")).toBeVisible();
      await expect(conversation).not.toContainText("Just now");
    });

    test("raising an RFI adds it first, selected, with Numa", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");
      const list = page.getByRole("list", { name: "RFI list" });

      // Act
      await page.getByRole("button", { name: "+ Raise an RFI" }).click();
      await page.getByLabel("Question").fill("What is the door height?");
      await page.getByLabel("Details (optional)").fill("Ground floor.");
      await page.getByRole("button", { name: "Send to Numa" }).click();

      // Assert
      await expect(list.getByRole("button").first()).toContainText("RFI-015");
      await expect(list.getByRole("button").first()).toContainText("With Numa");
      await expect(list.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      const conversation = page.getByRole("region", { name: "Conversation" });
      await expect(conversation.getByRole("heading")).toHaveText("What is the door height?");
      await expect(conversation).toContainText("Ground floor.");
      await expect(page.getByLabel("Question")).toHaveCount(0);
    });

    test("Cancel closes the raise form", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");
      await page.getByRole("button", { name: "+ Raise an RFI" }).click();
      await expect(page.getByLabel("Question")).toBeVisible();

      // Act
      await page.getByRole("button", { name: "Cancel" }).click();

      // Assert
      await expect(page.getByLabel("Question")).toHaveCount(0);
    });

    test("someone it is not addressed to sees who it waits for, and a viewer cannot raise one", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");

      // Act
      await viewAs(page, "Owner", OWNER);

      // Assert
      const conversation = page.getByRole("region", { name: "Conversation" });
      await expect(conversation).toContainText("Waiting for Daniel Ortiz to answer.");
      await expect(page.getByRole("button", { name: "+ Raise an RFI" })).toHaveCount(0);
    });

    test("selecting a closed RFI shows its whole conversation with its file", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/rfis/");

      // Act
      await page.getByRole("list", { name: "RFI list" }).getByRole("button", { name: /RFI-011/ }).click();

      // Assert
      const conversation = page.getByRole("region", { name: "Conversation" });
      await expect(conversation.getByRole("heading")).toHaveText("Veneer grain direction on island");
      await expect(conversation).toContainText("PDF · Island grain markup");
    });
  });

  test.describe("Production & Shipping", () => {
    test("only the main contractor can confirm the site is ready, and it clears their task", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/tracking/");
      await expect(page.getByText("Waiting for the main contractor to confirm the site is ready.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm site is ready" })).toHaveCount(0);

      // Act
      await viewAs(page, "Main contractor", CONTRACTOR);
      await page.getByRole("button", { name: "Confirm site is ready" }).click();

      // Assert
      await expect(page.getByRole("status")).toHaveText("Site confirmed ready. Numa will book delivery.");
      await expect(portalMenu(page).getByRole("link", { name: /^Production/ })).toHaveText("Production & shipping");
    });
  });

  test.describe("Installation Videos", () => {
    test("items with a video link to it in a new tab, and the rest say when it comes", async ({ page }) => {
      // Act
      await openPortal(page, "/portal/installation/");

      // Assert
      const videos = page.getByRole("link", { name: "Watch video ↗" });
      await expect(videos).toHaveCount(3);
      await expect(videos.first()).toHaveAttribute("target", "_blank");
      await expect(videos.first()).toHaveAttribute("rel", "noopener noreferrer");
      await expect(page.getByText("Coming before delivery")).toHaveCount(3);
    });
  });

  test.describe("Team & Access", () => {
    test("the client admin can change a right, which takes effect when switching role", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");
      await expect(page.getByText("You are the client admin")).toBeVisible();

      // Act: View to Act to Approve to Hidden for the owner's RFIs
      await page.getByRole("button", { name: "Sara Al Mansoori, RFIs: View. Click to change." }).click();
      await page.getByRole("button", { name: "Sara Al Mansoori, RFIs: Act. Click to change." }).click();
      await page.getByRole("button", { name: "Sara Al Mansoori, RFIs: Approve. Click to change." }).click();
      await expect(page.getByRole("button", { name: "Sara Al Mansoori, RFIs: Hidden. Click to change." })).toBeVisible();
      await viewAs(page, "Owner", OWNER);

      // Assert
      await expect(portalMenu(page).getByRole("link", { name: /^RFIs/ })).toHaveCount(0);
    });

    test("Reset form puts the rights back", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");
      await page.getByRole("button", { name: "Sara Al Mansoori, RFIs: View. Click to change." }).click();
      await expect(page.getByRole("button", { name: "Sara Al Mansoori, RFIs: Act. Click to change." })).toBeVisible();

      // Act
      await page.getByRole("button", { name: "Reset form" }).click();

      // Assert
      await expect(page.getByRole("button", { name: "Sara Al Mansoori, RFIs: View. Click to change." })).toBeVisible();
    });

    test("handing over the client admin takes the controls away", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");
      await expect(page.getByRole("button", { name: "+ Invite a person" })).toBeVisible();

      // Act
      await page.getByLabel("Hand over client admin to").selectOption({ label: "Anita Rao" });

      // Assert
      await expect(page.getByText("Only the client admin (Anita Rao) can change it.")).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Invite a person" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reset form" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sara Al Mansoori, RFIs: View", exact: true })).toBeDisabled();
    });

    test("Invite explains itself in the demo", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");

      // Act
      await page.getByRole("button", { name: "+ Invite a person" }).click();

      // Assert
      await expect(page.getByRole("status")).toHaveText("Demo: in the live portal this sends an invite email.");
    });

    test("someone else sees the form but cannot change it", async ({ page }) => {
      // Arrange
      await openPortal(page, "/portal/team/");

      // Act
      await viewAs(page, "Owner", OWNER);

      // Assert
      await expect(page.getByText("Only the client admin (Daniel Ortiz) can change it.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Ravi Menon, RFIs: Act", exact: true })).toBeDisabled();
    });
  });
});
