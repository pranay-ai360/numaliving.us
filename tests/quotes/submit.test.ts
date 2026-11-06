import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENDPOINT,
  FORM_ID,
  fetchDelivering,
  fetchDeliveringPage,
  jsonResponse,
  sentRequest,
} from "./fetchFixtures";
import { makeNotPdf, makePdf, makeRequest } from "./fixtures";
import { sendFailureMessage } from "../../assets/js/quotes/messages.js";
import { submitQuoteRequest } from "../../assets/js/quotes/submit.js";

describe("submitQuoteRequest", () => {
  beforeEach(() => {
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checks before anything is sent", () => {
    it("rejects an invalid request with the first problem and its field, without calling the network", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const request = makeRequest({ name: "   " });

      // Act
      const result = await submitQuoteRequest(request, [], { formId: FORM_ID, fetchImpl });

      // Assert
      expect(result).toEqual({ ok: false, reason: "invalid", error: "Please enter your full name.", field: "name" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["email", { email: "ada@localhost" }, "Please enter a valid email address."],
      ["role", { role: "Plumber" }, "Please choose your role."],
      ["timeline", { timeline: "Someday" }, "Please choose a timeline."],
    ] as const)("names the %s field when that is the problem", async (field, overrides, error) => {
      const result = await submitQuoteRequest({ ...makeRequest(), ...overrides }, [], { formId: FORM_ID });

      expect(result).toEqual({ ok: false, reason: "invalid", error, field });
    });

    it("rejects input that is not even an object, without naming a field", async () => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(null, [], { formId: FORM_ID, fetchImpl });

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
      expect(result).not.toHaveProperty("field");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects Drawings that break the limits, naming the Drawings as the field, without calling the network", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const files = [makePdf("notes.txt", 1024, "text/plain")];

      // Act
      const result = await submitQuoteRequest(makeRequest(), files, { formId: FORM_ID, fetchImpl });

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "invalid",
        error: "notes.txt is not a PDF. Drawings must be PDF files.",
        field: "drawings",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("reports a problem with the request before a problem with the Drawings", async () => {
      const files = [makePdf("notes.txt", 1024, "text/plain")];

      const result = await submitQuoteRequest(makeRequest({ location: "" }), files, { formId: FORM_ID });

      expect(result).toEqual({ ok: false, reason: "invalid", error: "Please enter the site location.", field: "location" });
    });

    it("reports invalid details before saying the form is not configured", async () => {
      const result = await submitQuoteRequest(makeRequest({ email: "nope" }), [], { formId: "" });

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
    });

    it("reports a Drawings problem before saying the form is not configured", async () => {
      const files = [makePdf("blank.pdf", 0)];

      const result = await submitQuoteRequest(makeRequest(), files, { formId: "" });

      expect(result).toMatchObject({ ok: false, reason: "invalid", error: "blank.pdf is empty. Please attach a valid PDF." });
    });

    it("judges a file by its name, type and size, and does not read its contents", async () => {
      const fetchImpl = fetchDeliveringPage();

      const result = await submitQuoteRequest(makeRequest(), [makeNotPdf("renamed.pdf")], { formId: FORM_ID, fetchImpl });

      expect(result.ok).toBe(true);
    });
  });

  describe("when the form is not configured", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["only spaces", "   "],
    ])("reports not-configured, and never a fake success, when the id is %s", async (_label, formId) => {
      // Arrange
      const fetchImpl = fetchDelivering();

      // Act
      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      // Assert
      expect(result).toEqual({ ok: false, reason: "not-configured", error: sendFailureMessage("not-configured") });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["a path", "abc/def"],
      ["a path that climbs up", "../admin"],
      ["only a dot", "."],
      ["only two dots", ".."],
      ["only dots", "..."],
      ["two dots with spaces around them", " .. "],
      ["a query string", "abc?redirect=1"],
      ["a fragment", "abc#x"],
      ["a space", "abc def"],
      ["a percent escape", "abc%2Fdef"],
      ["a full web address", "https://evil.example/collect"],
    ])("refuses to build an address from an id containing %s", async (_label, formId) => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      expect(result).toMatchObject({ ok: false, reason: "not-configured" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["a random-string alias", FORM_ID],
      ["a mailbox address", "owner@example.com"],
      ["a mailbox address with a plus tag", "first.last+quotes@example.co.uk"],
      ["an alias with dots in it", "a.b.c"],
    ])("accepts %s as the id", async (_label, formId) => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      expect(result.ok).toBe(true);
      expect(sentRequest(fetchImpl).url).toBe(`https://formsubmit.co/ajax/${formId}`);
    });

  });

  describe("the request it sends", () => {
    it("posts to the FormSubmit AJAX endpoint and asks for JSON back", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();

      // Act
      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      // Assert
      const { url, init } = sentRequest(fetchImpl);
      expect(url).toBe(ENDPOINT);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ Accept: "application/json" });
    });

    it("leaves the Content-Type to the browser so the multipart boundary is set correctly", async () => {
      const fetchImpl = fetchDelivering();

      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      const headerNames = Object.keys(sentRequest(fetchImpl).init.headers ?? {}).map((name) => name.toLowerCase());
      expect(headerNames).not.toContain("content-type");
    });

    it("passes an abort signal so a stuck request can be cancelled", async () => {
      const fetchImpl = fetchDelivering();

      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      expect(sentRequest(fetchImpl).init.signal).toBeInstanceOf(AbortSignal);
    });

    it("sends the validated details, trimmed, in a table with the reference it returns", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const request = makeRequest({ name: "  Ada Lovelace  ", company: "  " });

      // Act
      const result = await submitQuoteRequest(request, [], { formId: FORM_ID, fetchImpl });

      // Assert: a failed send must fail here, before the reference is compared
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { body } = sentRequest(fetchImpl);
      expect(body.get("Full name")).toBe("Ada Lovelace");
      expect(body.has("Company")).toBe(false);
      expect(body.get("_template")).toBe("table");
      expect(body.get("_replyto")).toBe("ada@example.com");
      expect(body.get("Reference")).toBe(result.reference);
    });

    it("uses the global fetch when none is supplied", async () => {
      // Arrange
      const globalFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({ success: true }));

      // Act
      const result = await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID });

      // Assert
      expect(result.ok).toBe(true);
      expect(globalFetch).toHaveBeenCalledOnce();
      expect(globalFetch.mock.calls[0][0]).toBe(ENDPOINT);
    });

    it("does not modify the request or the files it was given", async () => {
      const request = Object.freeze(makeRequest({ name: "  Ada  " }));
      const files = Object.freeze([makePdf("plan.pdf")]);

      const result = await submitQuoteRequest(request, files, { formId: FORM_ID, fetchImpl: fetchDeliveringPage() });

      expect(result.ok).toBe(true);
      expect(request.name).toBe("  Ada  ");
    });
  });
});
