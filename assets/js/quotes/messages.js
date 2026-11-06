// @ts-check
/**
 * What the visitor reads when a Quote Request could not be sent.
 * Every message offers the Contact email as the fallback and says nothing
 * about how the form service works.
 */
import { CONTACT_EMAIL } from "./contact.js";

/**
 * Why a Quote Request with fine details did not go out.
 * - not-configured: no Form alias is set for this build, so nothing was sent.
 * - not-activated: FormSubmit has not been activated for this form yet, so nothing was delivered.
 * - network: the form service could not be reached (offline, blocked by an extension, or refused by the browser).
 * - timeout: the form service did not answer in time.
 * - too-large: the form service refused the request as too large (HTTP 413).
 * - rejected: the form service answered with an error or refused the request.
 * - invalid-response: the form service answered with something unexpected, so delivery is unconfirmed.
 * @typedef {"not-configured" | "not-activated" | "network" | "timeout" | "too-large" | "rejected" | "invalid-response"} SendFailureReason
 */

/** @type {Readonly<Record<SendFailureReason, string>>} */
const SEND_FAILURE_MESSAGES = {
  "not-configured": `Online requests are not available right now. Please email your details and drawings to ${CONTACT_EMAIL}.`,
  "not-activated": `Online requests are still being set up. Please email your details and drawings to ${CONTACT_EMAIL} for now.`,
  network:
    "We could not reach our form service. Please check that you are online and that no ad blocker or privacy " +
    `extension is blocking the form, then try again, or email us at ${CONTACT_EMAIL}.`,
  timeout: `Sending took too long, which can happen with large drawings on a slow connection. Please try again, or email us at ${CONTACT_EMAIL}.`,
  "too-large": `Your drawings were too large to send through the form. Please remove some files, or email them to us at ${CONTACT_EMAIL}.`,
  rejected: `Our form service did not accept your request. Please try again in a few minutes, or email us at ${CONTACT_EMAIL}.`,
  "invalid-response": `We could not confirm that your request was received. Please email us at ${CONTACT_EMAIL} so we can check.`,
};

/**
 * @param {SendFailureReason} reason
 * @returns {string}
 */
export function sendFailureMessage(reason) {
  return SEND_FAILURE_MESSAGES[reason];
}

/** For the rare case where something other than a send failure goes wrong, so the visitor is never left waiting. */
export const UNEXPECTED_FAILURE_MESSAGE = `Something went wrong while sending your request. Please try again, or email us at ${CONTACT_EMAIL}.`;
