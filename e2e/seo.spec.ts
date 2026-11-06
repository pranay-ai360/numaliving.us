/**
 * What search engines and social networks are told, for every one of the 22 pages (D6, D7, D8).
 * Share images and canonical addresses always name https://numaliving.us, so "the image resolves" is
 * checked by its path on whichever site is under test.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { IS_EXTERNAL_SITE, IS_REFERENCE_SITE } from "./env";
import { expect, test } from "./fixtures";
import { ALL_PAGES, pageUrl } from "./site";

const SITE_URL = "https://numaliving.us";
const SUFFIX = " | Numa Living";
const MIN_DESCRIPTION = 50;
const MAX_DESCRIPTION = 160;
const OK = 200;
const NOT_FOUND = 404;

const TITLES: Readonly<Record<string, string>> = {
  "/": "Numa Living | Bespoke millwork, built for the world",
  "/about/": `From Dubai to the World${SUFFIX}`,
  "/projects/": `Projects${SUFFIX}`,
  "/capabilities/": `Capabilities & Factory${SUFFIX}`,
  "/process/": `Process${SUFFIX}`,
  "/contact/": `Request a Quote${SUFFIX}`,
  "/login/": `Client Login${SUFFIX}`,
  "/portal/": `Client Portal${SUFFIX}`,
  "/portal/approvals/": `Approvals${SUFFIX}`,
  "/portal/installation/": `Installation Videos${SUFFIX}`,
  "/portal/rfis/": `RFIs${SUFFIX}`,
  "/portal/team/": `Team & Access${SUFFIX}`,
  "/portal/tracking/": `Production & Shipping${SUFFIX}`,
  "/projects/marina-villa/": `Signature Villa, Dubai Marina${SUFFIX}`,
  "/projects/amherst/": `Amherst Ct${SUFFIX}`,
  "/projects/sonate/": `Luxury Apartments, Dubai Sports City${SUFFIX}`,
  "/projects/poppy-16/": `Poppy 16${SUFFIX}`,
  "/projects/penthouse25/": `Waterfront Residences${SUFFIX}`,
  "/projects/sandy/": `Sandy Ct${SUFFIX}`,
  "/projects/golf-links/": `High-end Multifamily Residences${SUFFIX}`,
  "/projects/poppy-11/": `Poppy 11${SUFFIX}`,
  "/projects/estacada/": `Estacada${SUFFIX}`,
};

/** Every index.html below a folder, as site paths. */
function exportedPages(root: string, folder = ""): string[] {
  return readdirSync(path.join(root, folder)).flatMap((name) => {
    const relative = path.join(folder, name);
    if (statSync(path.join(root, relative)).isDirectory()) return exportedPages(root, relative);
    return name === "index.html" ? [`/${folder === "" ? "" : `${folder}/`}`] : [];
  });
}

test.skip(IS_REFERENCE_SITE, "These rules are for the Jekyll site. The Reference Site has none of this metadata.");

for (const page of ALL_PAGES) {
  test(`${page} has its title, description, canonical and share tags`, async ({ page: browser, request }) => {
    // Act
    const response = await browser.goto(pageUrl(page));

    // Assert
    expect(response?.status()).toBe(OK);
    await expect(browser).toHaveTitle(TITLES[page]);
    const head = browser.locator("head");
    const description = (await head.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(description.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
    expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE_URL}${page}`);
    await expect(head.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(head.locator('meta[property="og:title"]')).toHaveAttribute("content", TITLES[page]);
    await expect(head.locator('meta[property="og:description"]')).toHaveAttribute("content", description);
    await expect(head.locator('meta[property="og:url"]')).toHaveAttribute("content", `${SITE_URL}${page}`);
    await expect(head.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const image = (await head.locator('meta[property="og:image"]').getAttribute("content")) ?? "";
    expect(image.startsWith(`${SITE_URL}/`)).toBe(true);
    expect((await request.get(new URL(image).pathname.slice(1))).status()).toBe(OK);
    await expect(browser.locator("h1")).toHaveCount(1);
  });
}

test("every description is different", async ({ request }) => {
  // Act
  const descriptions = await Promise.all(
    ALL_PAGES.map(async (page) => {
      const html = await (await request.get(pageUrl(page))).text();
      return /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
    }),
  );

  // Assert
  expect(new Set(descriptions).size).toBe(ALL_PAGES.length);
});

test("each Demo Portal description says it is a demo", async ({ request }) => {
  for (const page of ALL_PAGES.filter((candidate) => candidate.startsWith("/portal/"))) {
    // Act
    const html = await (await request.get(pageUrl(page))).text();

    // Assert
    expect(/<meta name="description" content="([^"]*)"/.exec(html)?.[1]).toMatch(/^Demo on sample data:/);
  }
});

test("the sitemap lists exactly the 22 pages", async ({ request }) => {
  // Act
  const xml = await (await request.get("sitemap.xml")).text();
  const listed = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);

  // Assert
  expect([...listed].sort()).toEqual(ALL_PAGES.map((page) => `${SITE_URL}${page}`).sort());
  expect(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)).toHaveLength(ALL_PAGES.length);
  expect(xml).not.toContain("<changefreq>");
  expect(xml).not.toContain("<priority>");
});

test("every page the build wrote is in the sitemap", () => {
  test.skip(IS_EXTERNAL_SITE || !existsSync("_site"), "Only the local build can be listed.");

  // Act
  const pages = exportedPages("_site");

  // Assert
  expect(pages.sort()).toEqual([...ALL_PAGES].sort());
});

test("robots.txt allows everything and names the sitemap", async ({ request }) => {
  // Act
  const text = await (await request.get("robots.txt")).text();

  // Assert
  expect(text).toMatch(/^User-Agent: \*$/m);
  expect(text).toMatch(/^Allow: \/$/m);
  expect(text).not.toContain("Disallow");
  expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("the home page's structured data parses, with no telephone or address", async ({ request }) => {
  // Act
  const html = await (await request.get("./")).text();
  const raw = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "";

  // Assert
  const data = JSON.parse(raw);
  expect(data["@graph"].map((item: { "@type": string }) => item["@type"])).toEqual(["Organization", "WebSite"]);
  expect(data["@graph"][0].url).toBe(SITE_URL);
  expect(raw).not.toContain("telephone");
  expect(raw).not.toContain("address");
});

test("no other page has structured data", async ({ request }) => {
  // Act
  const html = await (await request.get("about/")).text();

  // Assert
  expect(html).not.toContain("application/ld+json");
});

for (const gone of ["privacy/", "terms/"]) {
  test(`/${gone} is gone, as the owner decided`, async ({ request }) => {
    expect((await request.get(gone)).status()).toBe(NOT_FOUND);
  });
}

test("addresses are case-sensitive, so the old project address is gone", async ({ request }) => {
  expect((await request.get("projects/Amherst/")).status()).toBe(NOT_FOUND);
});

test("the not-found page answers 404 and asks not to be indexed", async ({ request }) => {
  // Act
  const response = await request.get("no-such-page/");

  // Assert
  expect(response.status()).toBe(NOT_FOUND);
  expect(await response.text()).toMatch(/<meta name="robots" content="noindex">/);
});
