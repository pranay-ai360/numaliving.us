// @ts-check
/**
 * The two things the site needs to know about Tally: where its form lives, and how to recognise its message
 * that a request was sent. Tally's API is not used here: its key opens the whole account, so it never goes in the site.
 */

export const TALLY_ORIGIN = "https://tally.so";
export const TALLY_SCRIPT_URL = `${TALLY_ORIGIN}/widgets/embed.js`;

const SUBMITTED_EVENT = "Tally.FormSubmitted";
const EMBED_OPTIONS = "alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";

/**
 * The address of the form inside the page. The form has a hidden field named `reference`, which takes its value
 * from here, so the reference the visitor sees is also on Numa's copy of the request.
 * @param {string} formId
 * @param {string} reference
 * @returns {string}
 */
export function embedUrl(formId, reference) {
  return `${TALLY_ORIGIN}/embed/${encodeURIComponent(formId)}?${EMBED_OPTIONS}&reference=${encodeURIComponent(reference)}`;
}

/**
 * The message as an object, or null when it is not text holding JSON. Tally's messages are JSON text.
 * @param {unknown} data
 * @returns {{ event?: unknown, payload?: { formId?: unknown } } | null}
 */
function readMessage(data) {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * True when a window message says this form was sent. Any page can post a message to this one, so the sender and
 * the form are both checked.
 * @param {string} origin
 * @param {unknown} data
 * @param {string} formId
 * @returns {boolean}
 */
export function isSubmission(origin, data, formId) {
  if (origin !== TALLY_ORIGIN) return false;
  const message = readMessage(data);
  return message?.event === SUBMITTED_EVENT && message.payload?.formId === formId;
}
