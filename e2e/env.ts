/**
 * Where the end-to-end tests find the site. Shared by playwright.config.ts and the specs.
 *
 * - By default: the Jekyll output in _site/, served by scripts/serve-pages.mjs on 127.0.0.1.
 * - With E2E_BASE_URL set: that address, with no local server. It may have a path, as the preview does
 *   (https://pranay-ai360.github.io/numaliving.us/).
 */
const DEFAULT_PORT = 4173;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;
const REFERENCE_SITE_PORT = "3000";

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`E2E_PORT must be a whole number from ${MIN_PORT} to ${MAX_PORT}, but it is ${JSON.stringify(raw)}.`);
  }
  return port;
}

function readExternalUrl(raw: string | undefined): URL | null {
  if (raw === undefined || raw === "") return null;
  const url = new URL(raw);
  if (url.search !== "" || url.hash !== "") {
    throw new Error(`E2E_BASE_URL must be a plain address, with no query or fragment, but it is ${JSON.stringify(raw)}.`);
  }
  return url;
}

const EXTERNAL_URL = readExternalUrl(process.env.E2E_BASE_URL);

export const SERVER_HOST = "127.0.0.1";
export const SERVER_PORT = readPort(process.env.E2E_PORT);

/** True when the tests run against an already running site rather than the local Jekyll output. */
export const IS_EXTERNAL_SITE = EXTERNAL_URL !== null;

/** True when the tests run against the Reference Site, the owner's `npm run dev` on port 3000. */
export const IS_REFERENCE_SITE = EXTERNAL_URL?.hostname === "localhost" && EXTERNAL_URL.port === REFERENCE_SITE_PORT;

/** The site's address. It ends in "/", so a relative page URL such as "about/" stays below any path. */
export const BASE_URL = EXTERNAL_URL === null ? `http://${SERVER_HOST}:${SERVER_PORT}/` : `${EXTERNAL_URL.origin}${EXTERNAL_URL.pathname.replace(/\/*$/, "/")}`;

/** The host a page may talk to. Anything else is an off-machine request, which fails the test. */
export const SITE_HOST = new URL(BASE_URL).hostname;
