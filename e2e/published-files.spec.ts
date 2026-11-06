/**
 * GitHub's build publishes every file `_config.yml` does not exclude, and turns Markdown with no front
 * matter into pages. This checks that only the site reaches the public, and nothing from the repo.
 */
import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { IS_EXTERNAL_SITE, IS_REFERENCE_SITE } from "./env";

const NOT_FOUND = 404;

const SITE_TOP_LEVEL = [
  "404.html",
  "about",
  "assets",
  "capabilities",
  "contact",
  "icon.png",
  "icon.svg",
  "index.html",
  "login",
  "portal",
  "process",
  "projects",
  "robots.txt",
  "sitemap.xml",
];

const NEVER_PUBLISHED = [
  "CONTEXT.md",
  "CONTEXT.html",
  "README.md",
  "README.html",
  "docs/adr/0001-publish-the-reference-site-in-place-of-the-legacy-site.html",
  "docs/adr/0001-publish-the-reference-site-in-place-of-the-legacy-site.md",
  "package.json",
  "tsconfig.json",
  "playwright.config.ts",
  "e2e/env.ts",
  "tests/config.test.ts",
  "scripts/build-site.sh",
  "assets/css/style.css",
  "_config.yml",
  "_tailwind/site.css",
  ".env.example",
  "reference-site/",
];

test.skip(IS_REFERENCE_SITE, "This checks the Jekyll build, not the Reference Site.");

test("the build's top level holds the site's own files and nothing else", () => {
  test.skip(IS_EXTERNAL_SITE, "Only the local build can be listed.");

  // Act
  const published = readdirSync("_site").filter((name) => name !== ".DS_Store").sort();

  // Assert
  expect(published).toEqual([...SITE_TOP_LEVEL].sort());
});

for (const path of NEVER_PUBLISHED) {
  test(`${path} is not published`, async ({ request }) => {
    // Act
    const response = await request.get(path);

    // Assert
    expect(response.status()).toBe(NOT_FOUND);
  });
}
