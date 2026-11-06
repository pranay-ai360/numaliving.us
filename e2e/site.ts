/**
 * The site's pages, in one list for the specs that loop over them.
 *
 * The Reference Site on localhost:3000 still has five old project addresses, so a spec that runs on
 * both sites asks `pageUrl` for the address and gets the right one for whichever site it is on.
 */
import { IS_REFERENCE_SITE } from "./env";

export const STATIC_PAGES: readonly string[] = [
  "/",
  "/about/",
  "/projects/",
  "/capabilities/",
  "/process/",
  "/contact/",
  "/login/",
  "/portal/",
  "/portal/approvals/",
  "/portal/installation/",
  "/portal/rfis/",
  "/portal/team/",
  "/portal/tracking/",
];

export const PROJECT_SLUGS: readonly string[] = [
  "marina-villa",
  "amherst",
  "sonate",
  "poppy-16",
  "penthouse25",
  "sandy",
  "golf-links",
  "poppy-11",
  "estacada",
];

export const PROJECT_PAGES: readonly string[] = PROJECT_SLUGS.map((slug) => `/projects/${slug}/`);

export const ALL_PAGES: readonly string[] = [...STATIC_PAGES, ...PROJECT_PAGES];

const REFERENCE_SLUGS: Readonly<Record<string, string>> = {
  amherst: "Amherst",
  "poppy-16": "Poppy_16",
  sandy: "Sandy",
  "poppy-11": "Poppy_11",
  estacada: "Estacada",
};

/** A site path as this site writes it: "/projects/amherst/" becomes "/projects/Amherst/" on the Reference Site. */
export function sitePath(path: string): string {
  if (!IS_REFERENCE_SITE) return path;
  return path.replace(/^\/projects\/([^/]+)\/$/, (whole, slug: string) => {
    const old = REFERENCE_SLUGS[slug];
    return old === undefined ? whole : `/projects/${old}/`;
  });
}

/**
 * A site path as a URL relative to the base URL ("about/"; "./" for the home page). Never pass a path
 * with a leading "/" to page.goto: it would drop any path the base URL has.
 */
export function pageUrl(path: string): string {
  const trimmed = sitePath(path).replace(/^\/+/, "");
  return trimmed === "" ? "./" : trimmed;
}

/** A page's name for screenshot and text files: "/projects/amherst/" becomes "projects-amherst". */
export function pageName(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  return trimmed === "" ? "home" : trimmed;
}
