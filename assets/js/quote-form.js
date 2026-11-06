// @ts-check
/**
 * The "Request a Quote" form on the Contact page. Tally hosts the form in an iframe, because it cannot take a
 * submission from a form of our own (ADR 0004). This opens it with a reference for the request, and shows the site's
 * own confirmation when Tally says the request was sent. The markup is in `_includes/quote-form.html`.
 */
import { createReference } from "./quotes/reference.js";
import { TALLY_SCRIPT_URL, embedUrl, isSubmission } from "./quotes/tally.js";

/**
 * @template {Element} T
 * @param {string} selector
 * @param {new () => T} type
 * @returns {T}
 */
function required(selector, type) {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`The Quote Request form is missing ${selector}.`);
  return element;
}

const formArea = required("[data-quote-form]", HTMLElement);
const embed = required("[data-tally-embed]", HTMLIFrameElement);
const help = required("[data-quote-help]", HTMLElement);
const notReached = required("[data-quote-error]", HTMLElement);
const success = required("[data-quote-success]", HTMLElement);
const referenceText = required("[data-quote-reference]", HTMLElement);
const again = required("[data-quote-again]", HTMLButtonElement);

const formId = embed.dataset.formId ?? "";
const reference = createReference();

function showSent() {
  referenceText.textContent = reference;
  formArea.hidden = true;
  success.hidden = false;
  // The form was long and held the focus, and it has gone, so take the visitor to the confirmation.
  success.scrollIntoView({ block: "center" });
  success.focus({ preventScroll: true });
}

function showNotReached() {
  embed.hidden = true;
  help.hidden = true;
  notReached.hidden = false;
}

function openEmbed() {
  const widget = /** @type {Window & { Tally?: { loadEmbeds: () => void } }} */ (window).Tally;
  if (widget === undefined) {
    showNotReached();
    return;
  }
  widget.loadEmbeds();
}

function loadTally() {
  embed.dataset.tallySrc = embedUrl(formId, reference);
  const script = document.createElement("script");
  script.src = TALLY_SCRIPT_URL;
  script.async = true;
  script.addEventListener("load", openEmbed);
  script.addEventListener("error", showNotReached);
  document.head.append(script);
}

window.addEventListener("message", (event) => {
  if (isSubmission(event.origin, event.data, formId)) showSent();
});
// A reload is the fresh start: Tally's script will not open the same iframe twice, and this gives a new reference.
again.addEventListener("click", () => window.location.reload());

loadTally();
