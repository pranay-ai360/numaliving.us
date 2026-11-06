// @ts-check
/**
 * The Quote Request: what the "Request a Quote" form collects.
 *
 * `parseQuoteRequest` is the single place validation happens, before anything
 * leaves the browser. The option lists and length limits come from `./fields.js`.
 * Text is trimmed, every string has a length cap, blank optional fields come out
 * as `undefined`, and anything that is not a Quote Request field is dropped.
 * Problems are reported in the order the form shows the fields.
 */
import { PROJECT_TYPE_OPTIONS, ROLE_OPTIONS, TEXT_LIMITS, TIMELINE_OPTIONS } from "./fields.js";

/**
 * @typedef {object} QuoteRequest
 * @property {string} name
 * @property {string} [company]
 * @property {string} email
 * @property {string} [phone]
 * @property {(typeof ROLE_OPTIONS)[number]} role
 * @property {(typeof PROJECT_TYPE_OPTIONS)[number]} projectType
 * @property {string} location
 * @property {(typeof TIMELINE_OPTIONS)[number]} timeline
 * @property {string} message
 */

/** @typedef {{ message: string, field?: import("./fields.js").QuoteRequestField }} Issue */

/**
 * @typedef {{ success: true, data: QuoteRequest, issue?: undefined }
 *   | { success: false, data?: undefined, issue: Issue }} ParseResult
 */

const NOT_A_REQUEST_MESSAGE = "Please check your details and try again.";
const EMAIL_PROBLEM = "Please enter a valid email address.";
// One or more dot-separated labels and a top-level domain, with no leading or doubled dots in the local part.
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/**
 * Each check returns the problem with a value, or null.
 * @typedef {(value: unknown) => string | null} Check
 */

/**
 * @param {string} missing
 * @param {string} tooLong
 * @param {number} maxLength
 * @returns {Check}
 */
function requiredText(missing, tooLong, maxLength) {
  return (value) => {
    if (typeof value !== "string" || value.trim() === "") return missing;
    return value.trim().length > maxLength ? tooLong : null;
  };
}

/**
 * @param {number} maxLength
 * @param {string} tooLong
 * @returns {Check}
 */
function optionalText(maxLength, tooLong) {
  return (value) => {
    if (value === undefined) return null;
    if (typeof value !== "string") return tooLong;
    return value.trim().length > maxLength ? tooLong : null;
  };
}

/**
 * @param {readonly string[]} options
 * @param {string} problem
 * @returns {Check}
 */
function oneOf(options, problem) {
  return (value) => (typeof value === "string" && options.includes(value) ? null : problem);
}

/** @type {Check} */
function emailProblem(value) {
  if (typeof value !== "string") return EMAIL_PROBLEM;
  const email = value.trim();
  if (email.length > TEXT_LIMITS.email) return `Your email address must be ${TEXT_LIMITS.email} characters or fewer.`;
  return EMAIL_PATTERN.test(email) ? null : EMAIL_PROBLEM;
}

/** Every field and its check, in the order the form shows them. */
const CHECKS = /** @type {const} */ ([
  ["name", requiredText("Please enter your full name.", `Your name must be ${TEXT_LIMITS.name} characters or fewer.`, TEXT_LIMITS.name)],
  ["company", optionalText(TEXT_LIMITS.company, `Company must be ${TEXT_LIMITS.company} characters or fewer.`)],
  ["email", emailProblem],
  ["phone", optionalText(TEXT_LIMITS.phone, `Phone must be ${TEXT_LIMITS.phone} characters or fewer.`)],
  ["role", oneOf(ROLE_OPTIONS, "Please choose your role.")],
  ["projectType", oneOf(PROJECT_TYPE_OPTIONS, "Please choose a project type.")],
  ["location", requiredText("Please enter the site location.", `The site location must be ${TEXT_LIMITS.location} characters or fewer.`, TEXT_LIMITS.location)],
  ["timeline", oneOf(TIMELINE_OPTIONS, "Please choose a timeline.")],
  ["message", requiredText("Please describe the scope of the project.", `Your notes must be ${TEXT_LIMITS.message} characters or fewer.`, TEXT_LIMITS.message)],
]);

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function cleanOptional(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Validates a Quote Request. `input` is `unknown` on purpose: it comes straight from form inputs.
 * @param {unknown} input
 * @returns {ParseResult}
 */
export function parseQuoteRequest(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, issue: { message: NOT_A_REQUEST_MESSAGE } };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);

  for (const [field, check] of CHECKS) {
    const message = check(raw[field]);
    if (message !== null) return { success: false, issue: { message, field } };
  }

  return {
    success: true,
    data: {
      name: String(raw.name).trim(),
      company: cleanOptional(raw.company),
      email: String(raw.email).trim(),
      phone: cleanOptional(raw.phone),
      role: /** @type {QuoteRequest["role"]} */ (raw.role),
      projectType: /** @type {QuoteRequest["projectType"]} */ (raw.projectType),
      location: String(raw.location).trim(),
      timeline: /** @type {QuoteRequest["timeline"]} */ (raw.timeline),
      message: String(raw.message).trim(),
    },
  };
}
