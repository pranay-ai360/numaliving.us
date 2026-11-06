/**
 * The `test` every browser spec on the site uses. It fails a test when a page throws, logs a console
 * error, or makes a request to any host other than the site itself.
 *
 * Every build carries the real Form alias, so this guard is what stops a test from emailing Numa:
 * FormSubmit is off-machine, and a spec that presses Send must mock it with page.route, which wins over
 * the guard's route. The Reference Site's dev server prints its own console noise, so only the request
 * guard applies there.
 */
import { test as base, expect } from "@playwright/test";
import { IS_REFERENCE_SITE, SITE_HOST } from "./env";

type GuardOptions = {
  /** Console errors a test expects, such as the browser's own line about a 500 response. */
  allowedConsoleErrors: readonly RegExp[];
};

type GuardFixtures = {
  pageGuard: void;
};

/** True for http(s) requests to any host but the site. data: and blob: URLs never leave the page. */
function isOffMachine(url: URL): boolean {
  return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== SITE_HOST;
}

export const test = base.extend<GuardOptions & GuardFixtures>({
  allowedConsoleErrors: [[], { option: true }],

  pageGuard: [
    async ({ context, page, allowedConsoleErrors }, use) => {
      let problems: readonly string[] = [];
      const report = (problem: string): void => {
        problems = [...problems, problem];
      };

      await context.route(isOffMachine, async (route) => {
        report(`request that would leave the machine: ${route.request().method()} ${route.request().url()}`);
        await route.abort("blockedbyclient");
      });
      if (!IS_REFERENCE_SITE) {
        page.on("pageerror", (error) => report(`uncaught error: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() !== "error" || allowedConsoleErrors.some((pattern) => pattern.test(message.text()))) return;
          // For "Failed to load resource" the location is the resource itself, which the text leaves out.
          const source = message.location().url;
          report(`console error: ${message.text()}${source ? ` (${source})` : ""}`);
        });
      }

      await use();

      expect(problems, "page errors, console errors or off-machine requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
