import { describe, expect, it } from "vitest";
import { TALLY_ORIGIN, TALLY_SCRIPT_URL, embedUrl, isSubmission } from "../../assets/js/quotes/tally.js";

const FORM_ID = "PRDEkQ";
const REFERENCE = "NL-K7M2QX";

function message(event: string, formId: string = FORM_ID): string {
  return JSON.stringify({ event, payload: { id: "submission-1", formId } });
}

const SUBMITTED = message("Tally.FormSubmitted");

describe("the Tally addresses", () => {
  it("are on Tally's own site, over HTTPS", () => {
    expect(TALLY_ORIGIN).toBe("https://tally.so");
    expect(TALLY_SCRIPT_URL).toBe("https://tally.so/widgets/embed.js");
  });
});

describe("embedUrl", () => {
  it("points at the form, with the options that fit it into the page and the reference", () => {
    // Act
    const url = new URL(embedUrl(FORM_ID, REFERENCE));

    // Assert
    expect(url.origin).toBe(TALLY_ORIGIN);
    expect(url.pathname).toBe(`/embed/${FORM_ID}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      alignLeft: "1",
      hideTitle: "1",
      transparentBackground: "1",
      dynamicHeight: "1",
      reference: REFERENCE,
    });
  });

  it("keeps odd characters inside their own parts of the address", () => {
    // Act
    const url = new URL(embedUrl("a/b", "x&y=z w"));

    // Assert
    expect(url.pathname).toBe("/embed/a%2Fb");
    expect(url.searchParams.get("reference")).toBe("x&y=z w");
  });
});

describe("isSubmission", () => {
  it("says yes to Tally's message that this form was submitted", () => {
    expect(isSubmission(TALLY_ORIGIN, SUBMITTED, FORM_ID)).toBe(true);
  });

  it.each([
    ["another site", "https://elsewhere.test"],
    ["this site itself", "https://numaliving.us"],
    ["Tally without HTTPS", "http://tally.so"],
    ["a look-alike address", "https://tally.so.elsewhere.test"],
    ["a sandboxed frame", "null"],
  ])("ignores the same message from %s, because any page can post to this one", (_label, origin) => {
    expect(isSubmission(origin, SUBMITTED, FORM_ID)).toBe(false);
  });

  it.each([
    ["another form", message("Tally.FormSubmitted", "other")],
    ["the form loading", message("Tally.FormLoaded")],
    ["a page view", message("Tally.FormPageView")],
    ["a message with no payload", JSON.stringify({ event: "Tally.FormSubmitted" })],
    ["a payload with no form", JSON.stringify({ event: "Tally.FormSubmitted", payload: {} })],
    ["text that is not JSON", "Tally.FormSubmitted"],
    ["JSON that is a number", "42"],
    ["JSON that is null", "null"],
    ["empty text", ""],
  ])("says no to %s", (_label, data) => {
    expect(isSubmission(TALLY_ORIGIN, data, FORM_ID)).toBe(false);
  });

  it.each([
    ["an object", { event: "Tally.FormSubmitted", payload: { formId: FORM_ID } }],
    ["nothing", undefined],
    ["null", null],
    ["a number", 7],
  ])("says no to a message that is %s rather than text", (_label, data) => {
    expect(isSubmission(TALLY_ORIGIN, data, FORM_ID)).toBe(false);
  });
});
