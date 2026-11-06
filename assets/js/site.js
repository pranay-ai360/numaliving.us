// @ts-check
/** The phone menu, on every page. */

const button = document.querySelector("[data-menu-button]");
const menu = document.getElementById("mobile-nav");

/**
 * Moves one bar of the menu icon between its closed and open look.
 * @param {HTMLElement} bar
 * @param {boolean} isOpen
 */
function setBarLook(bar, isOpen) {
  const remove = (isOpen ? bar.dataset.closed : bar.dataset.open) ?? "";
  const add = (isOpen ? bar.dataset.open : bar.dataset.closed) ?? "";
  bar.classList.remove(...remove.split(" ").filter(Boolean));
  bar.classList.add(...add.split(" ").filter(Boolean));
}

/**
 * @param {Element} menuButton
 * @param {HTMLElement} mobileNav
 * @param {boolean} isOpen
 */
function setMenuOpen(menuButton, mobileNav, isOpen) {
  mobileNav.hidden = !isOpen;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  menuButton.querySelectorAll("[data-closed]").forEach((bar) => {
    if (bar instanceof HTMLElement) setBarLook(bar, isOpen);
  });
}

if (button !== null && menu !== null) {
  button.addEventListener("click", () => setMenuOpen(button, menu, menu.hidden));
  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a") !== null) setMenuOpen(button, menu, false);
  });
}
