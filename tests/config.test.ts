/**
 * With option A (GitHub builds on push), nothing checks these at deploy time, so the pull request has to.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "../assets/js/quotes/contact.js";

const TEST_FORM_ID = "e2e-form-id";

function configValue(file: string, key: string): string {
  const match = new RegExp(`^\\s*${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m").exec(readFileSync(file, "utf8"));
  return match?.[1]?.trim() ?? "";
}

describe("_config.yml", () => {
  it("sets a real Form alias, because the Quote Request form cannot send without one", () => {
    // Arrange / Act
    const alias = configValue("_config.yml", "formsubmit_id");

    // Assert
    expect(alias).not.toBe("");
    expect(alias.toLowerCase()).not.toBe(TEST_FORM_ID);
    // An address here would publish the mailbox in every page's source for anyone to read.
    expect(alias).not.toContain("@");
  });

  it("keeps baseurl empty, because the site lives at the domain root", () => {
    expect(configValue("_config.yml", "baseurl")).toBe("");
  });
});

describe("the Contact email", () => {
  it("is the same on the pages and in the form's messages", () => {
    expect(configValue("_data/site.yml", "email")).toBe(CONTACT_EMAIL);
  });
});
