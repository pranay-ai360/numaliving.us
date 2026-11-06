/**
 * A stand-in for Tally, so no spec can reach the real form: the real form's Send emails Numa. It behaves as far as the
 * site relies on: the script fills in the iframe's address, and the form posts Tally's message when it is sent.
 */
import type { BrowserContext } from "@playwright/test";

export const TALLY_SCRIPT_ROUTE = "https://tally.so/widgets/embed.js";
const TALLY_FORM_ROUTE = "https://tally.so/embed/**";

const STAND_IN_SCRIPT = `
window.Tally = {
  loadEmbeds() {
    document.querySelectorAll("iframe[data-tally-src]:not([src])").forEach((frame) => {
      frame.src = frame.dataset.tallySrc;
    });
  },
};
`;

const STAND_IN_FORM = `<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" id="send">Send Request</button>
    <script>
      const formId = location.pathname.split("/").pop();
      document.getElementById("send").addEventListener("click", () => {
        parent.postMessage(JSON.stringify({ event: "Tally.FormSubmitted", payload: { id: "stand-in", formId } }), "*");
      });
    </script>
  </body>
</html>`;

export async function standInForTally(context: BrowserContext): Promise<void> {
  await context.route(TALLY_SCRIPT_ROUTE, (route) => route.fulfill({ contentType: "application/javascript", body: STAND_IN_SCRIPT }));
  await context.route(TALLY_FORM_ROUTE, (route) => route.fulfill({ contentType: "text/html", body: STAND_IN_FORM }));
}
