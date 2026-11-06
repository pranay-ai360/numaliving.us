// @ts-check
/** The sector buttons and country list on the Projects page. With no script, every project stays visible. */

const ALL = "All";

const grid = document.querySelector("[data-project-grid]");
const count = document.querySelector("[data-project-count]");
const noProjects = document.querySelector("[data-no-projects]");
const countrySelect = document.querySelector("[data-country-filter]");
const sectorButtons = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll("[data-sector-filter]")));
const cards = /** @type {HTMLElement[]} */ (grid === null ? [] : Array.from(grid.children));

let sector = ALL;

/** @param {HTMLElement} card @param {string} country */
function isShown(card, country) {
  return (sector === ALL || card.dataset.sector === sector) && (country === ALL || card.dataset.country === country);
}

/** @param {HTMLElement} button */
function showPressedState(button) {
  const isPressed = button.dataset.sectorFilter === sector;
  button.setAttribute("aria-pressed", String(isPressed));
  button.classList.remove(...(button.dataset.on ?? "").split(" "), ...(button.dataset.off ?? "").split(" "));
  button.classList.add(...((isPressed ? button.dataset.on : button.dataset.off) ?? "").split(" "));
}

function update() {
  const country = countrySelect instanceof HTMLSelectElement ? countrySelect.value : ALL;
  let shown = 0;
  for (const card of cards) {
    const isVisible = isShown(card, country);
    card.hidden = !isVisible;
    if (isVisible) shown += 1;
  }
  sectorButtons.forEach(showPressedState);
  if (count !== null) count.textContent = `${shown} ${shown === 1 ? "project" : "projects"}`;
  if (noProjects instanceof HTMLElement) noProjects.hidden = shown !== 0;
}

for (const button of sectorButtons) {
  button.addEventListener("click", () => {
    sector = button.dataset.sectorFilter ?? ALL;
    update();
  });
}
countrySelect?.addEventListener("change", update);
