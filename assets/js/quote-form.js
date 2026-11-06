// @ts-check
/**
 * The "Request a Quote" form on the Contact page: lists the Drawings, runs the two anti-spam guards,
 * sends the Quote Request and shows how it went. The markup is in `_includes/quote-form.html`.
 */
import { validateDrawings } from "./quotes/drawings.js";
import { UNEXPECTED_FAILURE_MESSAGE } from "./quotes/messages.js";
import { createReference } from "./quotes/reference.js";
import { submitQuoteRequest } from "./quotes/submit.js";

/** @import { SubmissionResult } from "./quotes/submit.js" */

/** Name of the hidden honeypot input. FormSubmit uses the same name for its own honeypot. */
const HONEYPOT_FIELD_NAME = "_honey";
/** A Send pressed sooner than this after the form appears is too quick to be a person who has read it. */
const MIN_FILL_TIME_MS = 2000;
const REVIEW_MESSAGE = "Please take a moment to review your details, then send again.";
const BYTES_PER_MB = 1024 * 1024;

const SEND_TEXT = "Send Request";
const SENDING_TEXT = "Sending…";

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

const form = required("[data-quote-form]", HTMLFormElement);
const success = required("[data-quote-success]", HTMLElement);
const reference = required("[data-quote-reference]", HTMLElement);
const again = required("[data-quote-again]", HTMLButtonElement);
const send = required("[data-quote-send]", HTMLButtonElement);
const quoteError = required("[data-quote-error]", HTMLElement);
const drawingsInput = required("[data-drawings-input]", HTMLInputElement);
const fileError = required("[data-file-error]", HTMLElement);
const fileList = required("[data-file-list]", HTMLUListElement);

const shownAt = Date.now();

/** @type {readonly File[]} */
let files = [];

/**
 * @param {HTMLElement} element
 * @param {string | null} text
 */
function showMessage(element, text) {
  element.textContent = text ?? "";
  element.hidden = text === null;
}

/**
 * One row of the list of chosen Drawings.
 * @param {File} file
 * @param {number} index
 */
function drawingRow(file, index) {
  const row = document.createElement("li");
  row.className = "flex items-center justify-between gap-3 px-4 py-2.5 text-sm";

  const name = document.createElement("span");
  name.className = "truncate";
  name.textContent = file.name;

  const details = document.createElement("span");
  details.className = "flex shrink-0 items-center gap-4 text-ink-muted";
  details.textContent = `${(file.size / BYTES_PER_MB).toFixed(1)} MB`;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-gold hover:text-gold-dark";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    setFiles(files.filter((_, position) => position !== index));
  });

  details.append(remove);
  row.append(name, details);
  return row;
}

/** @param {readonly File[]} nextFiles */
function setFiles(nextFiles) {
  files = nextFiles;
  fileList.replaceChildren(...files.map(drawingRow));
  fileList.hidden = files.length === 0;
}

/** @param {FileList | null} chosen */
function addFiles(chosen) {
  if (chosen === null) return;
  const next = [...files, ...Array.from(chosen)];
  const problem = validateDrawings(next);
  showMessage(fileError, problem);
  if (problem === null) setFiles(next);
}

/** @param {string} sentReference */
function showSent(sentReference) {
  form.reset();
  setFiles([]);
  showMessage(quoteError, null);
  reference.textContent = sentReference;
  form.hidden = true;
  success.hidden = false;
}

/** @param {boolean} isSending */
function setSending(isSending) {
  send.disabled = isSending;
  send.textContent = isSending ? SENDING_TEXT : SEND_TEXT;
}

/**
 * The fields exactly as the visitor typed them: `submitQuoteRequest` validates them.
 * @param {FormData} data
 * @returns {Record<string, FormDataEntryValue | null>}
 */
function readRequest(data) {
  return Object.fromEntries(
    ["name", "company", "email", "phone", "role", "projectType", "location", "timeline", "message"].map((field) => [field, data.get(field)]),
  );
}

/**
 * `submitQuoteRequest` reports every expected failure as a result. The catch is for the unexpected, so Send is never stuck.
 * @param {FormData} data
 * @returns {Promise<SubmissionResult | { ok: false, error: string }>}
 */
async function sendRequest(data) {
  try {
    return await submitQuoteRequest(readRequest(data), files, { formId: form.dataset.formId });
  } catch {
    return { ok: false, error: UNEXPECTED_FAILURE_MESSAGE };
  }
}

/** @param {SubmitEvent} event */
async function onSubmit(event) {
  event.preventDefault();
  const data = new FormData(form);

  // A filled honeypot means a bot: look successful and send nothing.
  if (String(data.get(HONEYPOT_FIELD_NAME) ?? "").trim() !== "") {
    showSent(createReference());
    return;
  }
  if (Date.now() - shownAt < MIN_FILL_TIME_MS) {
    showMessage(quoteError, REVIEW_MESSAGE);
    return;
  }

  showMessage(quoteError, null);
  setSending(true);
  const result = await sendRequest(data);
  setSending(false);
  if (result.ok) showSent(result.reference);
  else showMessage(quoteError, result.error);
}

drawingsInput.addEventListener("change", () => {
  addFiles(drawingsInput.files);
  drawingsInput.value = "";
});
form.addEventListener("submit", onSubmit);
again.addEventListener("click", () => {
  success.hidden = true;
  form.hidden = false;
});

// Only now can the form work: before this, a press of Send would put the visitor's details in the address bar.
send.disabled = false;
