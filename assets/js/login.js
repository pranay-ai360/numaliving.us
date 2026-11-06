// @ts-check
/**
 * The Client Login page. Nobody can sign in with a real account yet: pressing Sign In explains that and
 * offers the Demo Portal, and "View as ..." opens it as that person.
 */
import { DEMO_ROLE_KEY } from "./portal/state.js";

const SIGN_IN_MODE = "signin";
const RESET_MODE = "reset";
const NOT_OPEN_MESSAGE = "Client accounts are being set up. In the meantime, you can try the demo below.";

const form = document.querySelector("[data-login-form]");
const passwordField = /** @type {HTMLElement | null} */ (document.querySelector("[data-password-field]"));
const passwordInput = passwordField?.querySelector("input") ?? null;
const message = /** @type {HTMLElement | null} */ (document.querySelector("[data-login-message]"));
const submit = document.querySelector("[data-login-submit]");
const modeButton = document.querySelector("[data-login-mode]");
const reveal = /** @type {HTMLElement | null} */ (document.querySelector("[data-demo-reveal]"));
const roles = /** @type {HTMLElement | null} */ (document.querySelector("[data-demo-roles]"));

let mode = SIGN_IN_MODE;

function showDemoRoles() {
  if (reveal !== null) reveal.hidden = true;
  if (roles !== null) roles.hidden = false;
}

/** @param {string} nextMode */
function setMode(nextMode) {
  mode = nextMode;
  const isSignIn = mode === SIGN_IN_MODE;
  if (passwordField !== null) passwordField.hidden = !isSignIn;
  // A disabled field is left out of the browser's own check of the form.
  if (passwordInput !== null) passwordInput.disabled = !isSignIn;
  if (submit !== null) submit.textContent = isSignIn ? "Sign In" : "Send Reset Link";
  if (modeButton !== null) modeButton.textContent = isSignIn ? "Forgot password?" : "Back to sign in";
}

/** @param {string} role @param {string} portalUrl */
function openDemoAs(role, portalUrl) {
  try {
    sessionStorage.setItem(DEMO_ROLE_KEY, role);
  } catch {
    // Storage unavailable: the Demo Portal opens as its default person.
  }
  window.location.assign(portalUrl);
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (message !== null) {
    message.textContent = NOT_OPEN_MESSAGE;
    message.hidden = false;
  }
  showDemoRoles();
});

modeButton?.addEventListener("click", () => setMode(mode === SIGN_IN_MODE ? RESET_MODE : SIGN_IN_MODE));
reveal?.addEventListener("click", showDemoRoles);

roles?.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-demo-role]") : null;
  const portalUrl = roles.parentElement?.dataset.portalUrl;
  if (button instanceof HTMLElement && button.dataset.demoRole !== undefined && portalUrl !== undefined) {
    openDemoAs(button.dataset.demoRole, portalUrl);
  }
});
