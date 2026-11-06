// @ts-check
/**
 * The fields of a Quote Request, the choices its drop-downs offer and the
 * length limits of its text fields. `schema.js` validates against these, and
 * `_includes/quote-form.html` prints the same choices (a test checks they match).
 */

/** Every field of a Quote Request, in the order the form shows them. */
export const QUOTE_REQUEST_FIELDS = /** @type {const} */ ([
  "name",
  "company",
  "email",
  "phone",
  "role",
  "projectType",
  "location",
  "timeline",
  "message",
]);

/** @typedef {(typeof QUOTE_REQUEST_FIELDS)[number]} QuoteRequestField */

export const ROLE_OPTIONS = /** @type {const} */ (["Owner / developer", "Architect / designer", "Main contractor", "Other"]);

export const PROJECT_TYPE_OPTIONS = /** @type {const} */ (["Residences", "Office", "Multifamily", "Hospitality", "Other"]);

export const TIMELINE_OPTIONS = /** @type {const} */ ([
  "Tendering now",
  "Start within 3 months",
  "Start in 3 to 6 months",
  "Later / exploring",
]);

/** The most characters each free-text field accepts, counted after trimming. */
export const TEXT_LIMITS = /** @type {const} */ ({
  name: 120,
  company: 120,
  email: 254,
  phone: 40,
  location: 160,
  message: 5000,
});

/** @type {ReadonlySet<unknown>} */
const FIELD_NAMES = new Set(QUOTE_REQUEST_FIELDS);

/**
 * True when `value` names a Quote Request field, for example the field of a validation problem.
 * @param {unknown} value
 * @returns {value is QuoteRequestField}
 */
export function isQuoteRequestField(value) {
  return FIELD_NAMES.has(value);
}
