import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE,
  can,
  markDone,
  myTasks,
  personOf,
  portalNav,
  resetRights,
  restoreState,
  serialiseState,
  setClientAdmin,
  setRight,
  setRole,
  shouldStartOver,
  startingState,
  type PortalData,
} from "../../assets/js/portal/state.js";

const DATA: PortalData = {
  modules: [
    { key: "designDrawings", label: "Design drawings" },
    { key: "shopDrawings", label: "Shop drawings" },
    { key: "samples", label: "Samples" },
    { key: "rfis", label: "RFIs" },
    { key: "production", label: "Production" },
    { key: "updates", label: "Updates" },
    { key: "commercials", label: "Commercials" },
    { key: "installation", label: "Installation" },
  ],
  people: [{ name: "Owner" }, { name: "Architect" }, { name: "Designer" }, { name: "Contractor" }, { name: "Manager" }],
  start_rights: [
    [1, 1, 3, 1, 1, 1, 3, 1],
    [2, 3, 2, 2, 1, 1, 1, 1],
    [2, 2, 2, 2, 1, 1, 0, 1],
    [2, 1, 1, 2, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 2, 0],
  ],
  start_client_admin: 1,
  roles: [
    { key: "owner", label: "Owner", person: 0 },
    { key: "architect", label: "Architect", person: 1 },
    { key: "contractor", label: "Main contractor", person: 3 },
  ],
  tasks: [
    { id: "sd104", href: "/portal/approvals/", module: "shopDrawings", need: 3 },
    { id: "walnut", href: "/portal/approvals/", module: "samples", need: 3 },
    { id: "vo3", href: "/portal/", module: "commercials", need: 3 },
    { id: "rfi12", href: "/portal/rfis/", module: "rfis", to: 1 },
    { id: "rfi14", href: "/portal/rfis/", module: "rfis", to: 3 },
    { id: "s2", href: "/portal/tracking/", module: "production", to: 3 },
    { id: "plain", href: "/portal/approvals/", module: "samples" },
  ],
};

const SHOP_DRAWINGS = 1;
const RFIS = 3;

function ids(tasks: readonly { id: string }[]): string[] {
  return tasks.map((task) => task.id);
}

function labelsWithCounts(state: ReturnType<typeof startingState>): string[] {
  return portalNav(state, DATA).map((item) => (item.n > 0 ? `${item.label} ${item.n}` : item.label));
}

describe("startingState", () => {
  it("starts as the architect, with the starting rights, client admin and no decisions", () => {
    // Act
    const state = startingState(DATA, null);

    // Assert
    expect(state).toEqual({ role: DEFAULT_ROLE, rights: DATA.start_rights, clientAdmin: 1, done: {} });
  });

  it("uses a saved role when it is one of the demo's roles", () => {
    expect(startingState(DATA, "contractor").role).toBe("contractor");
  });

  it.each([["an unknown role", "admin"], ["an empty value", ""]])("ignores %s", (_label, saved) => {
    expect(startingState(DATA, saved).role).toBe(DEFAULT_ROLE);
  });

  it("copies the rights, so changing the state never touches the data", () => {
    expect(startingState(DATA, null).rights[0]).not.toBe(DATA.start_rights[0]);
  });
});

describe("restoreState", () => {
  it("brings back what was saved", () => {
    // Arrange
    const saved = setClientAdmin(markDone(setRight(startingState(DATA, "owner"), 0, RFIS, 2), "sd104", "Approved"), 4);

    // Act
    const restored = restoreState(DATA, "owner", serialiseState(saved));

    // Assert
    expect(restored).toEqual(saved);
  });

  it.each([
    ["nothing saved", null],
    ["text that is not JSON", "{nope"],
    ["a value that is not an object", "42"],
    ["rights of the wrong shape", JSON.stringify({ rights: [[1]], clientAdmin: 1, done: {} })],
    ["a level that does not exist", JSON.stringify({ rights: DATA.start_rights.map((row) => row.map(() => 9)), clientAdmin: 1, done: {} })],
    ["a client admin who does not exist", JSON.stringify({ rights: DATA.start_rights, clientAdmin: 99, done: {} })],
    ["decisions that are not text", JSON.stringify({ rights: DATA.start_rights, clientAdmin: 1, done: { sd104: 1 } })],
    ["decisions that are a list", JSON.stringify({ rights: DATA.start_rights, clientAdmin: 1, done: [] })],
  ])("starts over with %s", (_label, saved) => {
    expect(restoreState(DATA, "owner", saved)).toEqual(startingState(DATA, "owner"));
  });
});

describe("can", () => {
  it("checks the current person's level on a module", () => {
    // Arrange
    const state = startingState(DATA, "architect");

    // Act / Assert
    expect(can(state, DATA, "shopDrawings", 3)).toBe(true);
    expect(can(state, DATA, "samples", 3)).toBe(false);
    expect(can(state, DATA, "samples", 2)).toBe(true);
  });

  it("says no for a module that does not exist", () => {
    expect(can(startingState(DATA, null), DATA, "nothing", 1)).toBe(false);
  });
});

describe("personOf", () => {
  it.each([["owner", 0], ["architect", 1], ["contractor", 3]])("finds the row for %s", (role, person) => {
    expect(personOf(DATA, role)).toBe(person);
  });
});

describe("myTasks", () => {
  it("shows a task to those who can decide it, or to whom it is addressed", () => {
    expect(ids(myTasks(startingState(DATA, "architect"), DATA))).toEqual(["sd104", "rfi12"]);
    expect(ids(myTasks(startingState(DATA, "owner"), DATA))).toEqual(["walnut", "vo3", "plain"]);
    expect(ids(myTasks(startingState(DATA, "contractor"), DATA))).toEqual(["rfi14", "s2"]);
  });

  it("drops a task once it is decided", () => {
    // Arrange
    const state = markDone(startingState(DATA, "architect"), "sd104", "Approved");

    // Act / Assert
    expect(ids(myTasks(state, DATA))).toEqual(["rfi12"]);
  });

  it("drops an addressed task when its person loses sight of the module", () => {
    // Arrange
    const state = setRight(startingState(DATA, "architect"), 1, RFIS, 0);

    // Act / Assert
    expect(ids(myTasks(state, DATA))).toEqual(["sd104"]);
  });
});

describe("portalNav", () => {
  it("lists the screens the person can see, with what waits on each", () => {
    expect(labelsWithCounts(startingState(DATA, "architect"))).toEqual([
      "Overview",
      "Approvals 1",
      "RFIs 1",
      "Production & shipping",
      "Installation videos",
      "Team & access",
    ]);
    expect(labelsWithCounts(startingState(DATA, "contractor"))).toEqual([
      "Overview",
      "Approvals",
      "RFIs 1",
      "Production & shipping 1",
      "Installation videos",
      "Team & access",
    ]);
  });

  it("hides a screen when every right behind it is hidden", () => {
    // Arrange
    const noRfis = setRight(startingState(DATA, "architect"), 1, RFIS, 0);
    const noApprovals = [0, 1, 2].reduce((state, column) => setRight(state, 1, column, 0), startingState(DATA, "architect"));

    // Act / Assert
    expect(labelsWithCounts(noRfis)).not.toContain("RFIs");
    expect(portalNav(noApprovals, DATA).map((item) => item.label)).not.toContain("Approvals");
  });

  it("always offers Overview and Team & access", () => {
    // Arrange
    const nothing = DATA.modules.reduce((state, _module, column) => setRight(state, 1, column, 0), startingState(DATA, "architect"));

    // Act / Assert
    expect(portalNav(nothing, DATA).map((item) => item.label)).toEqual(["Overview", "Team & access"]);
  });
});

describe("the changes never touch the state they were given", () => {
  const frozen = (): ReturnType<typeof startingState> => {
    const state = startingState(DATA, "architect");
    state.rights.forEach((row) => Object.freeze(row));
    Object.freeze(state.rights);
    Object.freeze(state.done);
    return Object.freeze(state);
  };

  it("setRight changes one box", () => {
    // Act
    const next = setRight(frozen(), 1, SHOP_DRAWINGS, 0);

    // Assert
    expect(next.rights[1][SHOP_DRAWINGS]).toBe(0);
    expect(next.rights[0]).toEqual(DATA.start_rights[0]);
  });

  it("setRole changes the role", () => {
    expect(setRole(frozen(), "owner").role).toBe("owner");
  });

  it("markDone adds a decision", () => {
    expect(markDone(frozen(), "sd104", "Approved").done).toEqual({ sd104: "Approved" });
  });

  it("setClientAdmin hands over", () => {
    expect(setClientAdmin(frozen(), 4).clientAdmin).toBe(4);
  });

  it("resetRights brings back the starting rights and keeps the rest", () => {
    // Arrange
    const changed = markDone(setRight(startingState(DATA, "owner"), 0, RFIS, 2), "sd104", "Approved");

    // Act
    const next = resetRights(changed, DATA);

    // Assert
    expect(next.rights).toEqual(DATA.start_rights);
    expect(next.done).toEqual({ sd104: "Approved" });
    expect(next.role).toBe("owner");
  });
});

describe("shouldStartOver", () => {
  const PORTAL = "/portal";

  it.each([
    ["a refresh of a portal page", "reload", "/portal/"],
    ["a link from outside the portal", "navigate", "/login/"],
    ["arriving with no referrer", "navigate", ""],
    ["a page whose name merely starts the same", "navigate", "/portal-news/"],
  ])("starts over on %s", (_label, type, referrer) => {
    expect(shouldStartOver(type, referrer, PORTAL)).toBe(true);
  });

  it.each([
    ["a link from another portal page", "navigate", "/portal/rfis/"],
    ["a link from the portal's first page", "navigate", "/portal/"],
    ["the Back button", "back_forward", "/about/"],
  ])("keeps going on %s", (_label, type, referrer) => {
    expect(shouldStartOver(type, referrer, PORTAL)).toBe(false);
  });

  it("works below a base path", () => {
    expect(shouldStartOver("navigate", "/numaliving.us/portal/rfis/", "/numaliving.us/portal")).toBe(false);
  });
});
