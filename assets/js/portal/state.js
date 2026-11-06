// @ts-check
/**
 * The state of the Demo Portal while someone clicks around: who they are "signed in" as, the
 * responsibility form, and what has been approved or answered.
 *
 * Every function here is pure: it returns a new state and never changes the one it was given. Each link
 * loads a whole page, so `assets/js/portal/app.js` keeps this in sessionStorage to survive the move between
 * portal pages. A refresh, or arriving from outside the portal, clears everything but the role, so
 * "refreshing the page starts over" stays true.
 */

export const DEMO_ROLE_KEY = "numa-demo-role";
export const DEMO_STATE_KEY = "numa-demo-state";
export const DEFAULT_ROLE = "architect";

const VIEW_LEVEL = 1;
const APPROVE_LEVEL = 3;
const LEVEL_COUNT = 4;

const OVERVIEW_PATH = "/portal/";
const APPROVALS_PATH = "/portal/approvals/";
const RFIS_PATH = "/portal/rfis/";
const TRACKING_PATH = "/portal/tracking/";
const INSTALLATION_PATH = "/portal/installation/";
const TEAM_PATH = "/portal/team/";

/**
 * The parts of `_data/portal.yml` that decide what someone sees.
 * @typedef {object} PortalData
 * @property {readonly { key: string, label: string }[]} modules
 * @property {readonly { name: string }[]} people
 * @property {readonly (readonly number[])[]} start_rights
 * @property {number} start_client_admin
 * @property {readonly { key: string, label: string, person: number }[]} roles
 * @property {readonly Task[]} tasks
 */

/**
 * Something that can land in someone's "Waiting for you" list. It shows for a person who has the `need`
 * level on its module, or if it is addressed to them (`to`). It disappears once decided.
 * @typedef {object} Task
 * @property {string} id
 * @property {string} href
 * @property {string} module
 * @property {number} [need]
 * @property {number} [to]
 */

/**
 * @typedef {object} DemoState
 * @property {string} role
 * @property {number[][]} rights One row per person, one column per module: 0 hidden, 1 view, 2 act, 3 approve.
 * @property {number} clientAdmin Index into `people`.
 * @property {Readonly<Record<string, string>>} done Decisions made in this session, by item id.
 */

/**
 * @param {PortalData} data
 * @param {string | null} savedRole
 * @returns {DemoState}
 */
export function startingState(data, savedRole) {
  const isKnownRole = data.roles.some((role) => role.key === savedRole);
  return {
    role: isKnownRole && savedRole !== null ? savedRole : DEFAULT_ROLE,
    rights: data.start_rights.map((row) => [...row]),
    clientAdmin: data.start_client_admin,
    done: {},
  };
}

/**
 * @param {PortalData} data
 * @param {unknown} rights
 * @returns {rights is number[][]}
 */
function isValidRights(data, rights) {
  return (
    Array.isArray(rights) &&
    rights.length === data.people.length &&
    rights.every(
      (row) =>
        Array.isArray(row) &&
        row.length === data.modules.length &&
        row.every((level) => Number.isInteger(level) && level >= 0 && level < LEVEL_COUNT),
    )
  );
}

/**
 * @param {unknown} done
 * @returns {done is Record<string, string>}
 */
function isValidDone(done) {
  return typeof done === "object" && done !== null && !Array.isArray(done) && Object.values(done).every((outcome) => typeof outcome === "string");
}

/**
 * The state saved by an earlier portal page, or the starting state. Storage is not to be trusted, so
 * anything that does not fit is ignored rather than shown.
 * @param {PortalData} data
 * @param {string | null} savedRole
 * @param {string | null} savedState
 * @returns {DemoState}
 */
export function restoreState(data, savedRole, savedState) {
  const start = startingState(data, savedRole);
  if (savedState === null) return start;
  try {
    const saved = JSON.parse(savedState);
    const isValid =
      isValidRights(data, saved?.rights) &&
      Number.isInteger(saved?.clientAdmin) &&
      saved.clientAdmin >= 0 &&
      saved.clientAdmin < data.people.length &&
      isValidDone(saved?.done);
    return isValid ? { ...start, rights: saved.rights, clientAdmin: saved.clientAdmin, done: saved.done } : start;
  } catch {
    return start;
  }
}

/**
 * What goes into storage. The role has a key of its own, because it outlives a refresh.
 * @param {DemoState} state
 * @returns {string}
 */
export function serialiseState(state) {
  return JSON.stringify({ rights: state.rights, clientAdmin: state.clientAdmin, done: state.done });
}

/**
 * True on a refresh, or when arriving from outside the portal. `portalPath` has no trailing slash.
 * @param {string | undefined} navigationType
 * @param {string} referrerPath
 * @param {string} portalPath
 * @returns {boolean}
 */
export function shouldStartOver(navigationType, referrerPath, portalPath) {
  if (navigationType === "reload") return true;
  if (navigationType === "back_forward") return false;
  return referrerPath !== portalPath && !referrerPath.startsWith(`${portalPath}/`);
}

/**
 * The row of `people` for a role.
 * @param {PortalData} data
 * @param {string} role
 * @returns {number}
 */
export function personOf(data, role) {
  return data.roles.find((candidate) => candidate.key === role)?.person ?? 1;
}

/**
 * Does the current person have at least this level on a module?
 * @param {DemoState} state
 * @param {PortalData} data
 * @param {string} module
 * @param {number} level
 * @returns {boolean}
 */
export function can(state, data, module, level) {
  const column = data.modules.findIndex((candidate) => candidate.key === module);
  if (column === -1) return false;
  return state.rights[personOf(data, state.role)][column] >= level;
}

/**
 * What is waiting for the current person.
 * @param {DemoState} state
 * @param {PortalData} data
 * @returns {Task[]}
 */
export function myTasks(state, data) {
  const person = personOf(data, state.role);
  return data.tasks.filter((task) => {
    if (state.done[task.id] !== undefined) return false;
    if (task.to !== undefined) return task.to === person && can(state, data, task.module, VIEW_LEVEL);
    return can(state, data, task.module, task.need ?? APPROVE_LEVEL);
  });
}

/**
 * The side menu: the screens the current person can see, and how many tasks wait on each.
 * @param {DemoState} state
 * @param {PortalData} data
 * @returns {{ href: string, label: string, n: number }[]}
 */
export function portalNav(state, data) {
  const tasks = myTasks(state, data);
  /** @param {string} prefix */
  const count = (prefix) => tasks.filter((task) => task.href.startsWith(prefix)).length;
  /** @param {string} module */
  const sees = (module) => can(state, data, module, VIEW_LEVEL);
  return [
    { href: OVERVIEW_PATH, label: "Overview", show: true, n: 0 },
    { href: APPROVALS_PATH, label: "Approvals", show: sees("designDrawings") || sees("shopDrawings") || sees("samples"), n: count(APPROVALS_PATH) },
    { href: RFIS_PATH, label: "RFIs", show: sees("rfis"), n: count(RFIS_PATH) },
    { href: TRACKING_PATH, label: "Production & shipping", show: sees("production"), n: count(TRACKING_PATH) },
    { href: INSTALLATION_PATH, label: "Installation videos", show: sees("installation"), n: 0 },
    { href: TEAM_PATH, label: "Team & access", show: true, n: 0 },
  ]
    .filter((item) => item.show)
    .map(({ href, label, n }) => ({ href, label, n }));
}

/**
 * @param {DemoState} state
 * @param {string} role
 * @returns {DemoState}
 */
export function setRole(state, role) {
  return { ...state, role };
}

/**
 * @param {DemoState} state
 * @param {number} person
 * @param {number} column
 * @param {number} level
 * @returns {DemoState}
 */
export function setRight(state, person, column, level) {
  return {
    ...state,
    rights: state.rights.map((row, rowIndex) => (rowIndex === person ? row.map((value, index) => (index === column ? level : value)) : row)),
  };
}

/**
 * @param {DemoState} state
 * @param {PortalData} data
 * @returns {DemoState}
 */
export function resetRights(state, data) {
  return { ...state, rights: data.start_rights.map((row) => [...row]) };
}

/**
 * @param {DemoState} state
 * @param {number} person
 * @returns {DemoState}
 */
export function setClientAdmin(state, person) {
  return { ...state, clientAdmin: person };
}

/**
 * @param {DemoState} state
 * @param {string} id
 * @param {string} outcome
 * @returns {DemoState}
 */
export function markDone(state, id, outcome) {
  return { ...state, done: { ...state.done, [id]: outcome } };
}
