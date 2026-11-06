/**
 * With option A (GitHub builds on push), nothing checks these at deploy time, so the pull request has to.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function configValue(file: string, key: string): string {
  const match = new RegExp(`^\\s*${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m").exec(readFileSync(file, "utf8"));
  return match?.[1]?.trim() ?? "";
}

describe("_config.yml", () => {
  it("names a Tally form, because the Quote Request form cannot open without one", () => {
    expect(configValue("_config.yml", "tally_form_id")).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("keeps baseurl empty, because the site lives at the domain root", () => {
    expect(configValue("_config.yml", "baseurl")).toBe("");
  });
});

describe("the Tally API key", () => {
  it("stays out of git and out of every build, because it opens the whole Tally account", () => {
    expect(readFileSync(".gitignore", "utf8")).toMatch(/^\/tally-api-key\.json$/m);
    expect(readFileSync("_config.yml", "utf8")).toMatch(/^\s+- tally-api-key\.json$/m);
  });
});
