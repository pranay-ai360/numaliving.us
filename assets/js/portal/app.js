// @ts-check
/**
 * The Demo Portal's screens, as Alpine components. The markup is in `portal/**` and `_layouts/portal.html`,
 * the decisions in `./state.js`, and the sample data in `_data/portal.yml`. What a person types only ever
 * reaches the page through `x-text`, so it is shown as text.
 */
import * as demo from "./state.js";

/**
 * @typedef {object} ReviewItem
 * @property {string} id
 * @property {"shop" | "sample"} kind
 * @property {string} code
 * @property {string} title
 * @property {"waiting" | "approved" | "revising"} status
 * @property {string} sub
 * @property {string} [swatch]
 */

/** @typedef {{ who: string, when: string, text: string, file?: string, fromNuma: boolean }} Message */
/** @typedef {{ id: string, code: string, area: string, title: string, to: number, due: string, open: boolean, messages: Message[] }} Rfi */
/** @typedef {{ name: string, version: string, by: string, date: string }} DesignUpload */

/**
 * @typedef {demo.PortalData & {
 *   people: readonly { name: string, org: string }[],
 *   level_names: readonly string[],
 *   level_help: readonly string[],
 *   shop_drawings: readonly ReviewItem[],
 *   samples: readonly ReviewItem[],
 *   design_uploads: readonly DesignUpload[],
 *   rfis: readonly Rfi[],
 * }} Data
 */

/** @typedef {{ store: (name: string, value?: unknown) => any, data: (name: string, component: () => object) => void }} AlpineGlobal */

const VIEW_LEVEL = 1;
const ACT_LEVEL = 2;
const APPROVE_LEVEL = 3;
const LEVEL_COUNT = 4;
const MAIN_CONTRACTOR = 3;
const WITH_NUMA = -1;
const FIRST_NEW_RFI_NUMBER = 15;

const BADGE_BASE = "whitespace-nowrap px-2 py-1 text-[11px] font-semibold";
const BADGE_TONES = {
  waiting: "bg-gold-soft text-ink",
  ok: "bg-[#e3eadc] text-[#33502a]",
  warn: "bg-[#f6e3dc] text-[#8a3a22]",
  muted: "bg-[#ece8e1] text-ink-muted",
};

const LEVEL_LOOKS = [
  "bg-[#ece8e1] text-ink-muted",
  "bg-paper text-ink shadow-[inset_0_0_0_1px_#d9d3c8]",
  "bg-gold-soft text-ink font-medium",
  "bg-gold text-ink font-bold",
];

const STATUS_LABELS = { waiting: "Waiting", approved: "Approved", revising: "Numa revising" };
const STATUS_TONES = { waiting: "waiting", approved: "ok", revising: "warn" };

const APPROVAL_TABS = [
  { key: "shop", label: "Shop drawings", module: "shopDrawings" },
  { key: "samples", label: "Samples", module: "samples" },
  { key: "design", label: "Design drawings", module: "designDrawings" },
];

const dataElement = document.getElementById("portal-data");
if (dataElement === null) throw new Error("The Demo Portal's data is missing.");

const data = /** @type {Data} */ (JSON.parse(dataElement.textContent ?? "{}"));
const baseUrl = dataElement.dataset.baseUrl ?? "";

/** @param {keyof typeof BADGE_TONES} tone */
function badgeClass(tone) {
  return `${BADGE_BASE} ${BADGE_TONES[tone]}`;
}

/** @param {string} key */
function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Storage unavailable: the demo works from its starting state.
    return null;
  }
}

/** @param {string} key @param {string} value */
function writeStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: changes last until the next page.
  }
}

/** @param {string} key */
function removeFromStorage(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable: there is nothing saved to remove.
  }
}

/**
 * The state to start this page with: carried over from another portal page, or fresh. Starting over clears
 * what was saved, or the next portal page would bring it back.
 */
function loadState() {
  const navigation = /** @type {PerformanceNavigationTiming | undefined} */ (performance.getEntriesByType("navigation")[0]);
  const referrerPath = document.referrer === "" ? "" : new URL(document.referrer).pathname;
  if (demo.shouldStartOver(navigation?.type, referrerPath, `${baseUrl}/portal`)) removeFromStorage(demo.DEMO_STATE_KEY);
  return demo.restoreState(data, readStorage(demo.DEMO_ROLE_KEY), readStorage(demo.DEMO_STATE_KEY));
}

/** The state every screen shares, and the changes it allows. */
function createStore() {
  return {
    state: loadState(),
    badgeClass,
    /** @param {string} path */
    url(path) {
      return `${baseUrl}${path}`;
    },
    /** @param {demo.DemoState} next */
    update(next) {
      this.state = next;
      writeStorage(demo.DEMO_ROLE_KEY, next.role);
      writeStorage(demo.DEMO_STATE_KEY, demo.serialiseState(next));
    },
    get person() {
      return demo.personOf(data, this.state.role);
    },
    get personDetails() {
      return data.people[this.person];
    },
    get isClientAdmin() {
      return this.state.clientAdmin === this.person;
    },
    get nav() {
      return demo.portalNav(this.state, data);
    },
    get tasks() {
      return demo.myTasks(this.state, data);
    },
    /** @param {string} module @param {number} level */
    can(module, level) {
      return demo.can(this.state, data, module, level);
    },
    /** @param {string} role */
    setRole(role) {
      this.update(demo.setRole(this.state, role));
    },
    /** @param {string} id @param {string} outcome */
    markDone(id, outcome) {
      this.update(demo.markDone(this.state, id, outcome));
    },
    /** @param {number} person @param {number} column @param {number} level */
    setRight(person, column, level) {
      this.update(demo.setRight(this.state, person, column, level));
    },
    resetRights() {
      this.update(demo.resetRights(this.state, data));
    },
    /** @param {number} person */
    setClientAdmin(person) {
      this.update(demo.setClientAdmin(this.state, person));
    },
  };
}

/** @typedef {ReturnType<typeof createStore>} DemoStore */

/** @param {AlpineGlobal} alpine @returns {DemoStore} */
function shared(alpine) {
  return alpine.store("demo");
}

/**
 * Drawings & Samples. A tab's own state (selected item, comment, listed uploads) starts afresh whenever the
 * tab on show changes.
 * @param {AlpineGlobal} alpine
 */
function approvalsView(alpine) {
  /** @type {string | undefined} */
  let shownTab;
  return () => {
    const store = shared(alpine);
    return {
      tab: APPROVAL_TABS.find((tab) => store.can(tab.module, VIEW_LEVEL))?.key ?? "shop",
      selectedId: "",
      note: "",
      files: [...data.design_uploads],
      get visible() {
        return APPROVAL_TABS.filter((tab) => store.can(tab.module, VIEW_LEVEL));
      },
      get current() {
        return this.visible.find((tab) => tab.key === this.tab) ?? this.visible[0];
      },
      /** @param {string | undefined} key */
      startAfresh(key) {
        if (key === shownTab) return;
        shownTab = key;
        this.selectedId = "";
        this.note = "";
        this.files = [...data.design_uploads];
      },
      get items() {
        return this.current?.key === "samples" ? data.samples : data.shop_drawings;
      },
      get selected() {
        return this.items.find((item) => item.id === this.selectedId) ?? this.items[0];
      },
      get decided() {
        return store.state.done[this.selected.id];
      },
      get canApprove() {
        return store.can(this.current?.module ?? "", APPROVE_LEVEL);
      },
      get isWaiting() {
        return this.decided === undefined && this.selected.status === "waiting";
      },
      get approvers() {
        const column = data.modules.findIndex((module) => module.key === this.current?.module);
        const names = data.people.filter((_, person) => store.state.rights[person][column] === APPROVE_LEVEL).map((person) => person.name);
        return names.length > 0 ? names.join(" and ") : "nobody yet (set it on Team & access)";
      },
      /** @param {ReviewItem} item */
      badge(item) {
        const outcome = store.state.done[item.id];
        if (outcome !== undefined) {
          const isSentBack = outcome.startsWith("Revise");
          return { label: isSentBack ? "Sent back" : "Approved", className: badgeClass(isSentBack ? "warn" : "ok") };
        }
        return { label: STATUS_LABELS[item.status], className: badgeClass(/** @type {keyof typeof BADGE_TONES} */ (STATUS_TONES[item.status])) };
      },
      /** @param {string} outcome */
      decide(outcome) {
        store.markDone(this.selected.id, outcome);
        this.note = "";
      },
      get canUpload() {
        return store.can("designDrawings", ACT_LEVEL);
      },
      /** @param {Event} event */
      onPick(event) {
        const input = /** @type {HTMLInputElement} */ (event.target);
        const picked = Array.from(input.files ?? []);
        if (picked.length > 0) {
          const by = store.personDetails.name;
          this.files = [...picked.map((file) => ({ name: file.name, version: "v1", by, date: "Just now" })), ...this.files];
        }
        input.value = "";
      },
    };
  };
}

/**
 * Requests for information. The list, with anything raised or answered on this screen, lasts as long as the
 * screen does.
 * @param {AlpineGlobal} alpine
 */
function rfisView(alpine) {
  return () => {
    const store = shared(alpine);
    return {
      list: [...data.rfis],
      selectedId: data.rfis[0].id,
      reply: "",
      raising: false,
      newTitle: "",
      newText: "",
      get canAct() {
        return store.can("rfis", ACT_LEVEL);
      },
      get selected() {
        return this.list.find((rfi) => rfi.id === this.selectedId) ?? this.list[0];
      },
      /** @param {Rfi} rfi */
      isOpen(rfi) {
        return rfi.open && store.state.done[rfi.id] === undefined;
      },
      get isMine() {
        return this.selected.to === store.person && this.isOpen(this.selected);
      },
      get waitingOnSomeoneElse() {
        return this.isOpen(this.selected) && this.selected.to >= 0 && this.selected.to !== store.person;
      },
      /** @param {Rfi} rfi */
      status(rfi) {
        if (rfi.to === WITH_NUMA) return { label: "With Numa", className: badgeClass("muted") };
        if (!this.isOpen(rfi)) return { label: store.state.done[rfi.id] ?? "Closed", className: badgeClass("ok") };
        return rfi.to === store.person ? { label: "Waiting for you", className: badgeClass("waiting") } : { label: "Open", className: badgeClass("muted") };
      },
      /** @param {Rfi} rfi */
      addressedTo(rfi) {
        return rfi.to >= 0 ? `To ${data.people[rfi.to].name} · by ${rfi.due}` : rfi.due;
      },
      /** @param {number} person */
      personName(person) {
        return data.people[person].name;
      },
      send() {
        const text = this.reply.trim();
        if (text === "") return;
        const message = { who: store.personDetails.name, when: "Just now", text, fromNuma: false };
        const id = this.selected.id;
        this.list = this.list.map((rfi) => (rfi.id === id ? { ...rfi, messages: [...rfi.messages, message] } : rfi));
        store.markDone(id, "Answered");
        this.reply = "";
      },
      raise() {
        const title = this.newTitle.trim();
        if (title === "") return;
        const id = `new-${this.list.length}`;
        const code = `RFI-${String(FIRST_NEW_RFI_NUMBER + this.list.length - data.rfis.length).padStart(3, "0")}`;
        const message = { who: store.personDetails.name, when: "Just now", text: this.newText.trim() || title, fromNuma: false };
        this.list = [{ id, code, area: "General", title, to: WITH_NUMA, due: "Numa replies within 2 working days", open: true, messages: [message] }, ...this.list];
        this.selectedId = id;
        this.raising = false;
        this.newTitle = "";
        this.newText = "";
      },
    };
  };
}

/** @param {AlpineGlobal} alpine */
function trackingView(alpine) {
  return () => {
    const store = shared(alpine);
    return {
      get isMainContractor() {
        return store.person === MAIN_CONTRACTOR;
      },
      /** @param {string} id */
      isConfirmed(id) {
        return store.state.done[id] !== undefined;
      },
      /** @param {string} id */
      confirm(id) {
        store.markDone(id, "Site confirmed ready");
      },
    };
  };
}

/** The Responsibility Form. @param {AlpineGlobal} alpine */
function teamView(alpine) {
  return () => {
    const store = shared(alpine);
    return {
      notice: "",
      get isMain() {
        return store.isClientAdmin;
      },
      get clientAdminName() {
        return data.people[store.state.clientAdmin].name;
      },
      /** @param {number} person @param {number} column */
      level(person, column) {
        return store.state.rights[person][column];
      },
      /** @param {number} person @param {number} column */
      levelName(person, column) {
        return data.level_names[this.level(person, column)];
      },
      /** @param {number} person @param {number} column */
      cellClass(person, column) {
        return `min-h-10 w-full min-w-[84px] text-xs ${LEVEL_LOOKS[this.level(person, column)]} ${this.isMain ? "cursor-pointer" : "cursor-default"}`;
      },
      /** @param {number} person @param {number} column */
      cycle(person, column) {
        store.setRight(person, column, (this.level(person, column) + 1) % LEVEL_COUNT);
      },
      /** @param {number} person @param {number} column */
      cellLabel(person, column) {
        const description = `${data.people[person].name}, ${data.modules[column].label}: ${this.levelName(person, column)}`;
        return this.isMain ? `${description}. Click to change.` : description;
      },
      /** @param {Event} event */
      handOver(event) {
        store.setClientAdmin(Number(/** @type {HTMLSelectElement} */ (event.target).value));
      },
      invite() {
        this.notice = "Demo: in the live portal this sends an invite email.";
      },
    };
  };
}

document.addEventListener("alpine:init", () => {
  const alpine = /** @type {Window & { Alpine: AlpineGlobal }} */ (/** @type {unknown} */ (window)).Alpine;
  alpine.store("demo", createStore());
  alpine.data("approvals", approvalsView(alpine));
  alpine.data("rfis", rfisView(alpine));
  alpine.data("tracking", trackingView(alpine));
  alpine.data("team", teamView(alpine));
});
