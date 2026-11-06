// @ts-check
/**
 * Sends a Quote Request to Numa by email through FormSubmit.co.
 *
 * The site is static (GitHub Pages), so the browser posts straight to
 * FormSubmit. A request without Drawings goes to FormSubmit's AJAX endpoint,
 * which answers in JSON. FormSubmit documents attachments only for its
 * ordinary endpoint and its AJAX endpoint drops them (seen live on 18 October
 * 2026), so a request with Drawings goes to the ordinary endpoint, which
 * answers with a web page that the browser may read (it allows any origin).
 * `submitQuoteRequest` never throws for the outcomes it expects: every result
 * is a typed `SubmissionResult`, and it only reports success when FormSubmit
 * says so (a missing configuration or an unclear answer is never shown to the
 * visitor as "sent").
 */
import { validateDrawings } from "./drawings.js";
import { createReference } from "./reference.js";
import { judgePageReply, judgeReply, sendFailure } from "./reply.js";
import { parseQuoteRequest } from "./schema.js";
import { buildSubmission } from "./submission.js";

/** @import { Reply, Sent, SendFailure } from "./reply.js" */
/** @import { QuoteRequestField } from "./fields.js" */

/**
 * The details or the Drawings did not pass validation. `error` is safe to show to the visitor.
 * @typedef {object} ValidationFailure
 * @property {false} ok
 * @property {"invalid"} reason
 * @property {string} error
 * @property {QuoteRequestField | "drawings"} [field] The field the problem is about, when it is about one field.
 */

/** @typedef {Sent | ValidationFailure | SendFailure} SubmissionResult */

/**
 * @typedef {object} SubmitOptions
 * @property {string} [formId] The Form alias.
 * @property {typeof fetch} [fetchImpl] Defaults to the global `fetch`.
 * @property {number} [timeoutMs] How long to wait for FormSubmit before giving up. Defaults to 60 seconds.
 */

/**
 * Where a request goes, how its answer is read, and how that answer is judged.
 * @typedef {object} Endpoint
 * @property {string} url
 * @property {HeadersInit | undefined} headers
 * @property {(response: Response) => Promise<unknown>} readBody
 * @property {(reply: Reply, reference: string) => Sent | SendFailure} judge
 */

/** @typedef {{ kind: "replied", reply: Reply } | { kind: "failed", reason: "timeout" | "network" }} Outcome */

const FORMSUBMIT_URL = "https://formsubmit.co/";
const FORMSUBMIT_AJAX_URL = `${FORMSUBMIT_URL}ajax/`;
const DEFAULT_TIMEOUT_MS = 60_000;

// Only characters that are safe inside one URL path segment are allowed, so a bad value cannot change the address.
const FORM_ID_PATTERN = /^[A-Za-z0-9._+@-]{1,254}$/;
// "." and ".." are path steps, not names: they would change which address is called.
const ONLY_DOTS_PATTERN = /^\.+$/;

/** @type {typeof fetch} */
const globalFetch = (input, init) => globalThis.fetch(input, init);

/**
 * @param {string} error
 * @param {QuoteRequestField | "drawings" | undefined} field
 * @returns {ValidationFailure}
 */
function invalid(error, field) {
  return field === undefined ? { ok: false, reason: "invalid", error } : { ok: false, reason: "invalid", error, field };
}

/**
 * The usable form id, or null when it is missing, blank or not safe to put in the address.
 * @param {string | undefined} formId
 * @returns {string | null}
 */
function resolveFormId(formId) {
  const candidate = (formId ?? "").trim();
  if (ONLY_DOTS_PATTERN.test(candidate)) return null;
  return FORM_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * What `read` gives, or undefined when it fails: the body is not in the expected form, or the time ran out
 * mid-answer (the caller tells these apart by the abort signal).
 * @template T
 * @param {() => Promise<T>} read
 * @returns {Promise<T | undefined>}
 */
async function readOrUndefined(read) {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/**
 * The parsed JSON body, or undefined when it is not JSON or could not be read in time.
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
function readJson(response) {
  return readOrUndefined(() => response.json());
}

/**
 * The body as text, or undefined when it could not be read in time.
 * @param {Response} response
 * @returns {Promise<string | undefined>}
 */
function readText(response) {
  return readOrUndefined(() => response.text());
}

/**
 * @param {string} formId
 * @param {boolean} hasDrawings
 * @returns {Endpoint}
 */
function endpointFor(formId, hasDrawings) {
  if (hasDrawings) {
    // No Accept header: it is the ordinary endpoint's page that proves delivery, not JSON.
    return { url: `${FORMSUBMIT_URL}${formId}`, headers: undefined, readBody: readText, judge: judgePageReply };
  }
  return {
    url: `${FORMSUBMIT_AJAX_URL}${formId}`,
    headers: { Accept: "application/json" },
    readBody: readJson,
    judge: judgeReply,
  };
}

/**
 * @param {Endpoint} endpoint
 * @param {FormData} body
 * @param {typeof fetch} fetchImpl
 * @param {number} timeoutMs
 * @returns {Promise<Outcome>}
 */
async function post(endpoint, body, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // No Content-Type header: the browser must add it, with the multipart boundary.
    const response = await fetchImpl(endpoint.url, {
      method: "POST",
      headers: endpoint.headers,
      body,
      signal: controller.signal,
    });
    // `await` keeps the timer running while the body is read; error answers are read too, for their message.
    const answer = await endpoint.readBody(response);
    // Out of time while reading a good answer: whether it arrived is unknown, so say it timed out.
    if (answer === undefined && controller.signal.aborted && response.ok) return { kind: "failed", reason: "timeout" };
    /** @type {Reply} */
    const reply = { status: response.status, isOk: response.ok, isRedirected: response.redirected === true, body: answer };
    return { kind: "replied", reply };
  } catch {
    return { kind: "failed", reason: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validates a Quote Request and its Drawings, then emails it to Numa.
 *
 * `request` is `unknown` on purpose: it comes straight from form inputs, so
 * it is checked here rather than trusted. A validation failure names the
 * field it is about.
 *
 * Attachments are sent as extra multipart fields (`attachment`, `attachment2`,
 * ...), and a request with any goes to FormSubmit's ordinary endpoint, the one
 * that carries them.
 * @param {unknown} request
 * @param {readonly File[]} files
 * @param {SubmitOptions} [options]
 * @returns {Promise<SubmissionResult>}
 */
export async function submitQuoteRequest(request, files, options = {}) {
  const parsed = parseQuoteRequest(request);
  if (!parsed.success) return invalid(parsed.issue.message, parsed.issue.field);

  const drawingsProblem = validateDrawings(files);
  if (drawingsProblem !== null) return invalid(drawingsProblem, "drawings");

  const formId = resolveFormId(options.formId);
  if (formId === null) return sendFailure("not-configured");

  const reference = createReference();
  const endpoint = endpointFor(formId, files.length > 0);
  const outcome = await post(
    endpoint,
    buildSubmission(parsed.data, files, reference),
    options.fetchImpl ?? globalFetch,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  return outcome.kind === "failed" ? sendFailure(outcome.reason) : endpoint.judge(outcome.reply, reference);
}
