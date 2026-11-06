// @ts-check
/**
 * Turns a Quote Request into the FormData that FormSubmit emails to Numa.
 *
 * With `_template=table`, FormSubmit shows each field name as a row label,
 * so the keys below are written for a person reading the email. Fields
 * that start with "_" are FormSubmit options and are not shown in the table.
 */
import { formatFileSize, sanitiseFileName } from "./drawings.js";
import { toSingleLine, truncate } from "./text.js";

/** @import { QuoteRequest } from "./schema.js" */

/** @typedef {readonly [label: string, value: string | undefined]} TextEntry */

const SUBJECT_MAX_LENGTH = 150;
const NO_ATTACHMENTS_TEXT = "None";
const ATTACHMENT_FIELD = "attachment";

/** @param {number} index */
function attachmentFieldName(index) {
  return index === 0 ? ATTACHMENT_FIELD : `${ATTACHMENT_FIELD}${index + 1}`;
}

/** @param {number} count */
function countOfPdfs(count) {
  return count === 1 ? "1 PDF" : `${count} PDFs`;
}

/**
 * Says how many PDFs the email should carry before listing them, so an
 * attachment lost on the way (FormSubmit's AJAX endpoint did drop them once)
 * is noticed and can be asked for.
 * @param {readonly File[]} files
 */
function describeAttachments(files) {
  if (files.length === 0) return NO_ATTACHMENTS_TEXT;
  const list = files.map((file) => `${sanitiseFileName(file.name)} (${formatFileSize(file.size)})`).join("; ");
  return `Expect ${countOfPdfs(files.length)} attached: ${list}`;
}

/**
 * The PDF count goes at the end and is never cut off, so it shows in the inbox list too.
 * @param {QuoteRequest} request
 * @param {string} reference
 * @param {number} fileCount
 */
function buildSubject(request, reference, fileCount) {
  const countSuffix = fileCount === 0 ? "" : ` [${countOfPdfs(fileCount)}]`;
  const subject = toSingleLine(`Quote Request ${reference}: ${request.projectType}, ${request.location}`);
  return `${truncate(subject, SUBJECT_MAX_LENGTH - countSuffix.length)}${countSuffix}`;
}

/**
 * The rows of the email table, in reading order. Optional rows come out as undefined when empty.
 * @param {QuoteRequest} request
 * @param {readonly File[]} files
 * @param {string} reference
 * @returns {TextEntry[]}
 */
function tableEntries(request, files, reference) {
  return [
    ["Full name", request.name],
    ["Company", request.company],
    ["Email", request.email],
    ["Phone", request.phone],
    ["Role", request.role],
    ["Project type", request.projectType],
    ["Site location", request.location],
    ["Timeline", request.timeline],
    ["Scope and notes", request.message],
    ["Attached drawings", describeAttachments(files)],
    ["Reference", reference],
  ];
}

/**
 * @param {QuoteRequest} request
 * @param {readonly File[]} files
 * @param {string} reference
 * @returns {TextEntry[]}
 */
function optionEntries(request, files, reference) {
  return [
    ["_subject", buildSubject(request, reference, files.length)],
    ["_template", "table"],
    ["_captcha", "false"],
    ["_replyto", request.email],
  ];
}

/**
 * Builds the multipart body for FormSubmit.
 *
 * Attachments go in as `attachment`, `attachment2`, ... (one file per
 * field). FormSubmit carries them only on its ordinary endpoint, which is
 * where `submitQuoteRequest` sends a request that has any.
 * @param {QuoteRequest} request
 * @param {readonly File[]} files
 * @param {string} reference
 * @returns {FormData}
 */
export function buildSubmission(request, files, reference) {
  const formData = new FormData();

  for (const [label, value] of [...tableEntries(request, files, reference), ...optionEntries(request, files, reference)]) {
    if (value !== undefined && value.trim() !== "") formData.append(label, value);
  }

  files.forEach((file, index) => {
    formData.append(attachmentFieldName(index), file, sanitiseFileName(file.name));
  });

  return formData;
}
