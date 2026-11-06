/**
 * The Quote Request form (D3, D4), with FormSubmit mocked so nothing is emailed: every build carries the
 * real Form alias, and the guard in ./fixtures fails a test on any request that is not mocked here.
 */
import type { Locator, Page, Request, Route } from "@playwright/test";
import { PROJECT_TYPE_OPTIONS, ROLE_OPTIONS, TIMELINE_OPTIONS } from "../assets/js/quotes/fields.js";
import { IS_EXTERNAL_SITE } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const CONTACT_EMAIL = "projects@numaliving.us";
const FORMSUBMIT_ROUTE = "https://formsubmit.co/**";
const FILL_TIME_MS = 2100;
const REFERENCE = /NL-[A-HJ-NP-Z2-9]{6}/;
const BYTES_PER_MB = 1024 * 1024;
const PDF_MIME = "application/pdf";
const PDF_SOURCE = "%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\ntrailer <</Root 1 0 R>>\n%%EOF\n";

const QUOTE = {
  name: "Ada Lovelace",
  company: "Analytical Engines",
  email: "ada@numaliving.test",
  phone: "+1 512 555 0100",
  role: "Main contractor",
  projectType: "Residences",
  location: "Austin, Texas",
  timeline: "Tendering now",
  message: "Walnut closets and vanities for twelve units.",
};

const ACCEPTED_JSON = { status: 200, contentType: "application/json", body: JSON.stringify({ success: "true", message: "The form was submitted successfully." }) };
const ACCEPTED_PAGE = {
  status: 200,
  contentType: "text/html; charset=utf-8",
  body: "<!DOCTYPE html><html lang='en'><body><h1>Thanks!</h1><p>The form was submitted successfully. Return to original site: <a href='https://numaliving.us/'>https://numaliving.us/</a></p></body></html>",
};
const SERVER_ERROR = { status: 500, contentType: "application/json", body: JSON.stringify({ success: "false", message: "Internal Server Error" }) };

function pdf(name: string, sizeBytes = 0) {
  const content = Buffer.from(PDF_SOURCE, "latin1");
  return { name, mimeType: PDF_MIME, buffer: Buffer.concat([content, Buffer.alloc(Math.max(0, sizeBytes - content.length))]) };
}

/** Answers every call to FormSubmit, and returns a function listing the calls so far. */
async function mockFormSubmit(page: Page, answer: Parameters<Route["fulfill"]>[0]): Promise<() => readonly Request[]> {
  let calls: readonly Request[] = [];
  await page.route(FORMSUBMIT_ROUTE, async (route) => {
    calls = [...calls, route.request()];
    // FormSubmit allows any origin; without this header the browser hides the answer.
    await route.fulfill({ ...answer, headers: { "access-control-allow-origin": "*" } });
  });
  return () => calls;
}

/** Opens the form with Playwright's clock installed, so a test can move past the 2 seconds without waiting. */
async function openForm(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto(pageUrl("/contact/"));
  await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
}

async function fillForm(page: Page): Promise<void> {
  await page.getByLabel("Full name").fill(QUOTE.name);
  await page.getByLabel("Company").fill(QUOTE.company);
  await page.getByLabel("Email").fill(QUOTE.email);
  await page.getByLabel("Phone / WhatsApp").fill(QUOTE.phone);
  await page.getByLabel("Your role").selectOption(QUOTE.role);
  await page.getByLabel("Project type").selectOption(QUOTE.projectType);
  await page.getByLabel("Site location").fill(QUOTE.location);
  await page.getByLabel("Timeline").selectOption(QUOTE.timeline);
  await page.getByLabel("Scope and notes").fill(QUOTE.message);
}

const passFillTime = (page: Page): Promise<void> => page.clock.fastForward(FILL_TIME_MS);
const send = (page: Page): Promise<void> => page.getByRole("button", { name: "Send Request" }).click();
const drawings = (page: Page): Locator => page.locator('input[type="file"]');
const formAlert = (page: Page): Locator => page.locator("[data-quote-error]");
const fileAlert = (page: Page): Locator => page.locator("[data-file-error]");
const formAlias = async (page: Page): Promise<string> => (await page.locator("[data-quote-form]").getAttribute("data-form-id")) ?? "";

/** The multipart body of a FormSubmit call, parsed the way a server would parse it. */
async function readSubmission(request: Request): Promise<FormData> {
  const body = request.postDataBuffer();
  if (body === null) throw new Error(`The request to ${request.url()} has no body.`);
  return new Response(new Uint8Array(body), { headers: { "content-type": request.headers()["content-type"] ?? "" } }).formData();
}

test.skip(IS_EXTERNAL_SITE, "Only against the local build: a real address must never see a test request.");

for (const [label, viewport] of [["390 px", { width: 390, height: 844 }], ["1440 px", { width: 1440, height: 900 }]] as const) {
  test.describe(`at ${label}`, () => {
    test.use({ viewport });

    test("a request with no PDF goes to the AJAX endpoint, with its fields, and shows Thank You", async ({ page }) => {
      // Arrange
      const calls = await mockFormSubmit(page, ACCEPTED_JSON);
      await openForm(page);
      await fillForm(page);
      await passFillTime(page);

      // Act
      await send(page);

      // Assert: what the visitor sees
      await expect(page.getByText("Thank You")).toBeVisible();
      await expect(page.getByRole("status").getByText(REFERENCE)).toBeVisible();
      await expect(page.getByText("Preview mode")).toHaveCount(0);

      // Assert: what was sent
      expect(calls()).toHaveLength(1);
      const [call] = calls();
      expect(call.method()).toBe("POST");
      expect(call.url()).toBe(`https://formsubmit.co/ajax/${await formAlias(page)}`);
      expect(call.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
      const form = await readSubmission(call);
      expect(Object.fromEntries(form.entries())).toMatchObject({
        "Full name": QUOTE.name,
        Company: QUOTE.company,
        Email: QUOTE.email,
        Phone: QUOTE.phone,
        Role: QUOTE.role,
        "Project type": QUOTE.projectType,
        "Site location": QUOTE.location,
        Timeline: QUOTE.timeline,
        "Scope and notes": QUOTE.message,
        "Attached drawings": "None",
        _template: "table",
        _captcha: "false",
        _replyto: QUOTE.email,
      });
      expect(String(form.get("_subject"))).toMatch(new RegExp(`^Quote Request ${REFERENCE.source}: Residences, Austin, Texas$`));
      expect(form.has("_honey")).toBe(false);
    });

    test("a request with a PDF goes to the ordinary endpoint, with the file attached", async ({ page }) => {
      // Arrange
      const calls = await mockFormSubmit(page, ACCEPTED_PAGE);
      await openForm(page);
      await fillForm(page);
      await drawings(page).setInputFiles([pdf("ground-floor.pdf")]);
      await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
      await passFillTime(page);

      // Act
      await send(page);

      // Assert
      await expect(page.getByText("Thank You")).toBeVisible();
      expect(calls()).toHaveLength(1);
      const [call] = calls();
      expect(call.url()).toBe(`https://formsubmit.co/${await formAlias(page)}`);
      const form = await readSubmission(call);
      const attachment = form.get("attachment");
      if (!(attachment instanceof File)) throw new Error("The request has no attachment field holding a file.");
      expect(attachment.name).toBe("ground-floor.pdf");
      expect(await attachment.text()).toContain("%PDF-1.4");
      expect(String(form.get("Attached drawings"))).toMatch(/^Expect 1 PDF attached: ground-floor\.pdf/);
      expect(String(form.get("_subject"))).toMatch(/\[1 PDF\]$/);
    });

    test.describe("when FormSubmit answers with an error", () => {
      test.use({ allowedConsoleErrors: [/500/] });

      test("an alert names the Contact email and what was typed stays", async ({ page }) => {
        // Arrange
        await mockFormSubmit(page, SERVER_ERROR);
        await openForm(page);
        await fillForm(page);
        await passFillTime(page);

        // Act
        await send(page);

        // Assert
        await expect(formAlert(page)).toBeVisible();
        await expect(formAlert(page)).toContainText(CONTACT_EMAIL);
        await expect(page.getByLabel("Full name")).toHaveValue(QUOTE.name);
        await expect(page.getByLabel("Your role")).toHaveValue(QUOTE.role);
        await expect(page.getByText("Thank You")).toBeHidden();
        await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
      });
    });

    test("an answer that says nothing clear is never shown as sent", async ({ page }) => {
      // Arrange
      await mockFormSubmit(page, { status: 200, contentType: "text/html", body: "<h1>Check email address</h1><p>Email address is not formatted correctly</p>" });
      await openForm(page);
      await fillForm(page);
      await drawings(page).setInputFiles([pdf("plan.pdf")]);
      await passFillTime(page);

      // Act
      await send(page);

      // Assert
      await expect(formAlert(page)).toContainText("We could not confirm that your request was received.");
      await expect(page.getByText("Thank You")).toBeHidden();
    });

    test("Drawings over 9 MB in total are refused, naming the Contact email", async ({ page }) => {
      // Arrange
      await openForm(page);
      const half = 4.5 * BYTES_PER_MB + 1;

      // Act
      await drawings(page).setInputFiles([pdf("sheet-1.pdf", half), pdf("sheet-2.pdf", half)]);

      // Assert
      await expect(fileAlert(page)).toContainText("over the 9 MB limit");
      await expect(fileAlert(page)).toContainText(CONTACT_EMAIL);
      await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
    });

    test("a file that is not a PDF is refused", async ({ page }) => {
      // Arrange
      await openForm(page);

      // Act
      await drawings(page).setInputFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Not a drawing.") }]);

      // Assert
      await expect(fileAlert(page)).toHaveText("notes.txt is not a PDF. Drawings must be PDF files.");
    });

    test("a chosen Drawing is listed with its size and can be removed", async ({ page }) => {
      // Arrange
      await openForm(page);

      // Act
      await drawings(page).setInputFiles([pdf("plan.pdf", 2 * BYTES_PER_MB)]);

      // Assert
      await expect(page.getByText("plan.pdf")).toBeVisible();
      await expect(page.getByText("2.0 MB")).toBeVisible();

      // Act
      await page.getByRole("button", { name: "Remove" }).click();

      // Assert
      await expect(page.getByText("plan.pdf")).toBeHidden();
    });

    test("a filled honeypot looks successful and sends nothing", async ({ page }) => {
      // Arrange
      const calls = await mockFormSubmit(page, ACCEPTED_JSON);
      await openForm(page);
      await fillForm(page);
      await page.locator('input[name="_honey"]').evaluate((input: HTMLInputElement) => {
        input.value = "bot";
      });
      await passFillTime(page);

      // Act
      await send(page);

      // Assert
      await expect(page.getByText("Thank You")).toBeVisible();
      await expect(page.getByRole("status").getByText(REFERENCE)).toBeVisible();
      expect(calls()).toHaveLength(0);
    });

    test("Send within 2 seconds asks for a review and sends nothing, then sends once the time has passed", async ({ page }) => {
      // Arrange
      const calls = await mockFormSubmit(page, ACCEPTED_JSON);
      await openForm(page);
      await fillForm(page);

      // Act
      await send(page);

      // Assert
      await expect(formAlert(page)).toHaveText("Please take a moment to review your details, then send again.");
      expect(calls()).toHaveLength(0);
      await expect(page.getByLabel("Full name")).toHaveValue(QUOTE.name);

      // Act
      await passFillTime(page);
      await send(page);

      // Assert
      await expect(page.getByText("Thank You")).toBeVisible();
      expect(calls()).toHaveLength(1);
    });

    test("Send another request brings back an empty form", async ({ page }) => {
      // Arrange
      await mockFormSubmit(page, ACCEPTED_JSON);
      await openForm(page);
      await fillForm(page);
      await passFillTime(page);
      await send(page);
      await expect(page.getByText("Thank You")).toBeVisible();

      // Act
      await page.getByRole("button", { name: /Send another request/ }).click();

      // Assert
      await expect(page.getByLabel("Full name")).toHaveValue("");
      await expect(page.getByText("Thank You")).toBeHidden();
      await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
    });
  });
}

test("the form offers the choices the sending code accepts", async ({ page }) => {
  // Act
  await page.goto(pageUrl("/contact/"));
  const choices = (label: string) => page.getByLabel(label).locator("option:not([disabled])").allTextContents();

  // Assert
  expect(await choices("Your role")).toEqual([...ROLE_OPTIONS]);
  expect(await choices("Project type")).toEqual([...PROJECT_TYPE_OPTIONS]);
  expect(await choices("Timeline")).toEqual([...TIMELINE_OPTIONS]);
});

test("the form states the new limit, and has a real Form alias", async ({ page }) => {
  // Act
  await page.goto(pageUrl("/contact/"));

  // Assert
  await expect(page.getByText("Up to 10 files, 9 MB in total")).toBeVisible();
  const alias = await formAlias(page);
  expect(alias).not.toBe("");
  expect(alias).not.toContain("@");
});

test.describe("when the form's script cannot load", () => {
  test.use({ allowedConsoleErrors: [/quote-form\.js|Failed to load/] });

  test("Send stays disabled, so details cannot end up in the address bar", async ({ page }) => {
    // Arrange
    await page.route("**/assets/js/quote-form.js", (route) => route.abort());

    // Act
    await page.goto(pageUrl("/contact/"));

    // Assert
    await expect(page.getByRole("button", { name: "Send Request" })).toBeDisabled();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: CONTACT_EMAIL })).toBeVisible();
  });
});
