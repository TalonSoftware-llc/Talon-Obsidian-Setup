---
---

```dataviewjs
const app = this.app;
const container = (typeof this.container !== "undefined" ? this.container : dv.container);
const now = new Date();
const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

const LS_AGENDA_CUSTOMIZE = "work-agenda-customize-v1";
const LS_AGENDA_DEFAULT_RIGHT = "work-agenda-default-right-mode";
const AGENDA_CUSTOMIZE_DEFAULTS = {
  textScale: 1,
  progressRed: "#b91c1c",
  progressMid: "#d97706",
  progressGreen: "#22c55e",
  todayRing: "",
  todayLetter: "",
  successColor: "#22c55e",
  dangerColor: "#b91c1c",
  accentColor: "#8b5cf6"
};
function cloneAgendaCustomizeDefaults() {
  return { ...AGENDA_CUSTOMIZE_DEFAULTS };
}
function loadAgendaCustomize() {
  try {
    const raw = localStorage.getItem(LS_AGENDA_CUSTOMIZE);
    if (!raw) return cloneAgendaCustomizeDefaults();
    const o = JSON.parse(raw);
    if (typeof o !== "object" || !o) return cloneAgendaCustomizeDefaults();
    return { ...cloneAgendaCustomizeDefaults(), ...o };
  } catch (e) {
    return cloneAgendaCustomizeDefaults();
  }
}
function saveAgendaCustomize(c) {
  try {
    localStorage.setItem(LS_AGENDA_CUSTOMIZE, JSON.stringify(c));
  } catch (e) {}
}
function applyAgendaCustomizeToRoot(root, c) {
  if (!root || !c) return;
  const scale = typeof c.textScale === "number" && c.textScale > 0 ? c.textScale : 1;
  root.style.setProperty("--agenda-text-scale", String(scale));
  root.style.setProperty("--agenda-progress-red", c.progressRed || "#b91c1c");
  root.style.setProperty("--agenda-progress-mid", c.progressMid || "#d97706");
  root.style.setProperty("--agenda-progress-green", c.progressGreen || "#22c55e");
  const tr = String(c.todayRing || "").trim();
  const tl = String(c.todayLetter || "").trim();
  if (tr) root.style.setProperty("--agenda-today-ring", tr);
  else root.style.removeProperty("--agenda-today-ring");
  if (tl) root.style.setProperty("--agenda-today-letter", tl);
  else root.style.removeProperty("--agenda-today-letter");
  root.style.setProperty("--agenda-success-color", c.successColor || "#22c55e");
  root.style.setProperty("--agenda-danger-color", c.dangerColor || "#b91c1c");
  root.style.setProperty("--agenda-accent-custom", c.accentColor || "#8b5cf6");
}
let agendaCustomize = loadAgendaCustomize();
container.classList.add("missions-agenda-dashboard-root");
applyAgendaCustomizeToRoot(container, agendaCustomize);

/** Persisted for this tab so Dataview re-runs (preview refresh) do not reset the picked day. */
const SS_AGENDA_SELECTED_DATE = "work-agenda-selected-date";
/** Legacy key (week nav only); read once if new key is empty. */
const SS_AGENDA_PENDING_LEGACY = "work-agenda-pending-selected-date";
const SS_AGENDA_RIGHT_MODE = "work-agenda-right-panel-mode";
let selectedDate = today;
let rightPanelMode = "deadlines";
function parseValidIsoDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const test = new Date(s + "T12:00:00");
  return !isNaN(test.getTime()) ? s : "";
}
function persistAgendaSelectedDate() {
  try {
    sessionStorage.setItem(SS_AGENDA_SELECTED_DATE, selectedDate);
  } catch (e) {}
}
try {
  let stored = sessionStorage.getItem(SS_AGENDA_SELECTED_DATE);
  if (!stored) {
    stored = sessionStorage.getItem(SS_AGENDA_PENDING_LEGACY);
    if (stored) sessionStorage.removeItem(SS_AGENDA_PENDING_LEGACY);
  }
  const iso = parseValidIsoDate(stored);
  if (iso) selectedDate = iso;
} catch (e) {}
try {
  const mode = sessionStorage.getItem(SS_AGENDA_RIGHT_MODE);
  if (mode === "deadlines" || mode === "objectives") rightPanelMode = mode;
  else {
    try {
      const def = localStorage.getItem(LS_AGENDA_DEFAULT_RIGHT);
      if (def === "deadlines" || def === "objectives") rightPanelMode = def;
    } catch (e2) {}
  }
} catch (e) {}

/** e.g. 3/21/26 */
function formatShortUsDate(iso) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.getMonth() + 1 + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(-2);
}

/** Paths: missions + inbox under Data/Tools/Agenda (Work vault) or Work/Data/... (parent vault) */
const AGENDA_ROOTS = ["Data/Tools/Agenda", "Work/Data/Tools/Agenda"];
const UNFINISHED_ROOTS = ["Data/Tools/Agenda/Unfinished", "Work/Data/Tools/Agenda/Unfinished"];

function loadPagesFromRoots(roots) {
  const seen = new Set();
  const out = [];
  for (const root of roots) {
    try {
      if (!app.vault.getAbstractFileByPath(root)) continue;
      const q = dv.pages('"' + root + '"').where(p => !p.file.name.includes("Dashboard"));
      for (const p of q) {
        if (!seen.has(p.file.path)) {
          seen.add(p.file.path);
          out.push(p);
        }
      }
    } catch (e) {}
  }
  return out.sort((a, b) => a.file.name.localeCompare(b.file.name));
}

/** Mission main note: …/Agenda/[Mission]/[Mission].md (5 / 6 path segments), or legacy …/Agenda/Structured/[Mission]/[Mission].md */
function isStructuredMissionMainPath(path) {
  const p = path.split("/");
  const n = p.length;
  const RESERVED = new Set(["Unfinished", "Structured", "Active", "Paused", "Unstarted"]);
  if (p[0] === "Data" && p[1] === "Tools" && p[2] === "Agenda" && p[3] === "Structured") return n === 6;
  if (p[0] === "Work" && p[1] === "Data" && p[2] === "Tools" && p[3] === "Agenda" && p[4] === "Structured") return n === 7;
  if (p[0] === "Data" && p[1] === "Tools" && p[2] === "Agenda" && !RESERVED.has(p[3])) return n === 5;
  if (p[0] === "Work" && p[1] === "Data" && p[2] === "Tools" && p[3] === "Agenda" && !RESERVED.has(p[4])) return n === 6;
  if (p[0] === "Tools" && p[1] === "Agenda" && p[2] === "Active") return n === 5;
  return false;
}

/** Any .md under …/Unfinished/ (flat or legacy nested, e.g. old _from_project paths) */
function isUnfinishedStandaloneFile(path) {
  if (!path || !path.endsWith(".md")) return false;
  const parts = path.split("/").filter(Boolean);
  const i = parts.indexOf("Unfinished");
  if (i < 0) return false;
  return i < parts.length - 1;
}

let pages = loadPagesFromRoots(AGENDA_ROOTS);

/** Archived agenda items + mission folders land here (see also legacy z_archive/Agenda) */
const AGENDA_ARCHIVE_FOLDER = "z_archive/Tools/Agenda";
const AGENDA_ARCHIVE_LEGACY = "z_archive/Agenda";

async function ensureFolderExists(fullPath) {
  if (app.vault.getAbstractFileByPath(fullPath)) return;
  const parts = fullPath.split("/").filter(Boolean);
  let acc = "";
  for (const p of parts) {
    acc = acc ? acc + "/" + p : p;
    if (!app.vault.getAbstractFileByPath(acc)) await app.vault.createFolder(acc);
  }
}

function getUnfinishedFolderResolved() {
  for (const root of UNFINISHED_ROOTS) {
    if (app.vault.getAbstractFileByPath(root)) return root;
  }
  return UNFINISHED_ROOTS[0];
}

function objectiveToFileStem(text) {
  const oneLine = String(text || "").trim().split(/\r?\n/)[0] || "Todo";
  let stem = oneLine.replace(/[\\/:*?"<>|#\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (stem.length > 80) stem = stem.slice(0, 80).trim();
  return stem || "Todo";
}

async function openAddStandaloneTodoModal() {
  if (selectedDate < today) {
    new Notice("Select a current or future date.");
    return;
  }
  const overlay = document.body.createEl("div", { cls: "missions-add-standalone-overlay" });
  const modal = overlay.createEl("div", { cls: "missions-add-standalone-modal" });
  modal.createEl("h4", { cls: "missions-add-standalone-title", text: "New to-do" });
  const dueWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  dueWrap.createEl("label", { text: "Due date", attr: { for: "missions-add-standalone-due" } });
  const dueInput = dueWrap.createEl("input", {
    type: "date",
    cls: "missions-add-standalone-date",
    attr: { id: "missions-add-standalone-due", value: selectedDate, min: today }
  });
  const timeWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  timeWrap.createEl("label", { text: "Due time (optional)", attr: { for: "missions-add-standalone-time" } });
  const timeInput = timeWrap.createEl("input", {
    type: "time",
    cls: "missions-add-standalone-date",
    attr: { id: "missions-add-standalone-time" }
  });
  const objWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  objWrap.createEl("label", { text: "Objective", attr: { for: "missions-add-standalone-obj" } });
  const objInput = objWrap.createEl("textarea", {
    cls: "missions-add-standalone-textarea",
    attr: { id: "missions-add-standalone-obj", rows: "4", placeholder: "What to do" }
  });
  const btnRow = modal.createEl("div", { cls: "missions-add-standalone-actions" });
  const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn missions-add-standalone-create", text: "Create" });
  function close() {
    overlay.remove();
  }
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  createBtn.addEventListener("click", async () => {
    const bodyText = (objInput.value || "").trim();
    if (!bodyText) {
      new Notice("Enter an objective.");
      return;
    }
    let due = (dueInput.value && /^\d{4}-\d{2}-\d{2}$/.test(dueInput.value)) ? dueInput.value : selectedDate;
    if (due < today) {
      new Notice("Due date must be today or in the future.");
      return;
    }
    const folder = getUnfinishedFolderResolved();
    await ensureFolderExists(folder);
    const stem = objectiveToFileStem(bodyText);
    let fullPath = folder + "/" + stem + ".md";
    let n = 2;
    while (app.vault.getAbstractFileByPath(fullPath)) {
      fullPath = folder + "/" + stem + " " + n + ".md";
      n++;
    }
    const dueTimeNorm = normalizeDueTimeString(timeInput.value);
    const yamlLines = ["---", "schedule: " + due];
    if (dueTimeNorm) yamlLines.push('due_time: "' + dueTimeNorm + '"');
    yamlLines.push("---", "", bodyText, "");
    const yaml = yamlLines.join("\n");
    try {
      await app.vault.create(fullPath, yaml);
      const displayName = fullPath.split("/").pop().replace(/\.md$/, "");
      if (!itemsByDay[due]) itemsByDay[due] = [];
      itemsByDay[due].push({
        mission: displayName,
        missionPath: fullPath,
        item: displayName,
        link: "",
        isStandalone: true,
        isCompleted: false,
        isOverdue: false,
        scheduledDate: due,
        dueTime: dueTimeNorm || "",
        fromArchive: false
      });
      sortItemsForDay(itemsByDay[due]);
      new Notice("Created: " + fullPath.split("/").pop());
      close();
      refreshDotForDate(due);
      renderAgendaCards();
    } catch (e) {
      new Notice("Error: " + (e.message || "Could not create note"));
    }
  });
  objInput.focus();
}

function parseScheduled(p) {
  const raw = p.due != null && p.due !== undefined ? p.due : p.scheduled;
  if (!raw) return "";
  const s = raw;
  if (typeof s === "object" && s && s.toISOString) return s.toISOString().slice(0, 10);
  return String(s).trim().slice(0, 10);
}

/** Due date: `schedule` (ISO). Legacy notes may use `due` / `scheduled` only — still read. */
function getScheduleForPage(p) {
  if (p.schedule != null && p.schedule !== undefined) {
    const raw = p.schedule;
    if (typeof raw === "object" && raw && raw.toISOString) return raw.toISOString().slice(0, 10);
    const str = String(raw).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  }
  return parseScheduled(p);
}

/** Optional time on standalone to-dos (24h `HH:mm`). Frontmatter: `due_time`. */
function normalizeDueTimeString(raw) {
  if (raw == null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  let min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min) || h > 23 || min > 59) return "";
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}
function getDueTimeForPage(p) {
  const raw = p.due_time != null && p.due_time !== undefined ? p.due_time : p.dueTime;
  return normalizeDueTimeString(raw);
}
function formatDueTimeForDisplay(hhmm) {
  const n = normalizeDueTimeString(hhmm);
  if (!n) return "";
  const parts = n.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isArchiveStandalonePath(path) {
  return /^z_archive\/Tools\/Agenda\/[^/]+\.md$/.test(path) || /^z_archive\/Agenda\/[^/]+\.md$/.test(path);
}

function addDaysIso(iso, deltaDays) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/**
 * Archive completed standalones after the due *day* has ended: once `today` is a later calendar
 * day than `schedule`, the note moves to z_archive on dashboard load. Same calendar day:
 * stays in Unfinished (strikethrough when completed). Phone notes with no date are treated as due
 * today until completion adds `schedule` + completion.
 */
// Cleanup: move completed standalones whose due date is in the past (runs when dashboard loads)
try {
  await ensureFolderExists(AGENDA_ARCHIVE_FOLDER);
  for (const root of UNFINISHED_ROOTS) {
    if (!app.vault.getAbstractFileByPath(root)) continue;
    for (const p of dv.pages('"' + root + '"')) {
    if (p.file.name.includes("Dashboard")) continue;
    if (!isUnfinishedStandaloneFile(p.file.path)) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    const completion = p.completion || {};
    let shouldArchive = false;
    const scheduled = getScheduleForPage(p);
    if (scheduled && scheduled < today) {
      shouldArchive = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    } else if (!scheduled) {
      for (const d of Object.keys(completion)) {
        if (d < today && Array.isArray(completion[d]) && completion[d].includes(displayName)) {
          shouldArchive = true;
          break;
        }
      }
    }
    if (shouldArchive) {
      const file = app.vault.getAbstractFileByPath(p.file.path);
      if (file && file.extension === "md") await app.fileManager.renameFile(file, AGENDA_ARCHIVE_FOLDER + "/" + file.name);
    }
    }
  }
  // Legacy: loose .md under Tools/Agenda/Active (pre-migration)
  for (const p of dv.pages('"Tools/Agenda/Active"')) {
    if (p.file.name.includes("Dashboard")) continue;
    const pathParts = p.file.path.split("/");
    if (pathParts.length !== 4) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    const completion = p.completion || {};
    let shouldArchive = false;
    const scheduled = getScheduleForPage(p);
    if (scheduled && scheduled < today) {
      shouldArchive = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    } else if (!scheduled) {
      for (const d of Object.keys(completion)) {
        if (d < today && Array.isArray(completion[d]) && completion[d].includes(displayName)) {
          shouldArchive = true;
          break;
        }
      }
    }
    if (shouldArchive) {
      const file = app.vault.getAbstractFileByPath(p.file.path);
      if (file && file.extension === "md") await app.fileManager.renameFile(file, AGENDA_ARCHIVE_FOLDER + "/" + file.name);
    }
  }
} catch (e) {}

/** Standalone .md in archive whose `schedule` matches this calendar day (always merge into that day’s list). */
function collectArchiveStandalonesForDate(selectedDate) {
  const rows = [];
  try {
    for (const archRoot of [AGENDA_ARCHIVE_FOLDER, AGENDA_ARCHIVE_LEGACY]) {
      if (!app.vault.getAbstractFileByPath(archRoot)) continue;
      for (const p of dv.pages('"' + archRoot + '"')) {
        if (p.file.name.includes("Dashboard")) continue;
        if (!isArchiveStandalonePath(p.file.path)) continue;
        let scheduled = getScheduleForPage(p);
        if (!scheduled || scheduled !== selectedDate) continue;
        const displayName = (p.file.name || "").replace(/\.md$/, "");
        const completion = p.completion || {};
        const isCompleted = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
        rows.push({ p, displayName, scheduled, dueTime: getDueTimeForPage(p), isCompleted, isOverdue: false, fromArchive: true });
      }
    }
  } catch (e) {}
  return rows;
}

/** Past days: archive only. Today/future: Unfinished + Active + archive rows for that same date (so moved notes stay visible). */
function collectStandaloneForDate(selectedDate) {
  const rows = [];
  const isPastSelected = selectedDate < today;
  const isFutureSelected = selectedDate > today;
  try {
    if (isPastSelected) {
      return collectArchiveStandalonesForDate(selectedDate);
    }
    for (const root of UNFINISHED_ROOTS) {
      if (!app.vault.getAbstractFileByPath(root)) continue;
      for (const p of dv.pages('"' + root + '"')) {
        if (p.file.name.includes("Dashboard")) continue;
        if (!isUnfinishedStandaloneFile(p.file.path)) continue;
        let scheduled = getScheduleForPage(p);
        if (!scheduled) {
          if (isFutureSelected) continue;
          scheduled = today;
        }
        if (isFutureSelected) {
          if (scheduled !== selectedDate) continue;
        } else {
          if (scheduled > today) continue;
        }
        const displayName = (p.file.name || "").replace(/\.md$/, "");
        const completion = p.completion || {};
        const isCompleted = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
        const isOverdue = scheduled < today && !isCompleted;
        rows.push({ p, displayName, scheduled, dueTime: getDueTimeForPage(p), isCompleted, isOverdue, fromArchive: false });
      }
    }
    for (const p of dv.pages('"Tools/Agenda/Active"')) {
      if (p.file.name.includes("Dashboard")) continue;
      const pathParts = p.file.path.split("/");
      if (pathParts.length !== 4) continue;
      let scheduled = getScheduleForPage(p);
      if (!scheduled) {
        if (isFutureSelected) continue;
        scheduled = today;
      }
      if (isFutureSelected) {
        if (scheduled !== selectedDate) continue;
      } else {
        if (scheduled > today) continue;
      }
      const displayName = (p.file.name || "").replace(/\.md$/, "");
      const completion = p.completion || {};
      const isCompleted = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
      const isOverdue = scheduled < today && !isCompleted;
      rows.push({ p, displayName, scheduled, dueTime: getDueTimeForPage(p), isCompleted, isOverdue, fromArchive: false });
    }
    const seen = new Set(rows.map((r) => r.p.file.path));
    for (const ar of collectArchiveStandalonesForDate(selectedDate)) {
      if (seen.has(ar.p.file.path)) continue;
      seen.add(ar.p.file.path);
      rows.push(ar);
    }
  } catch (e) {}
  return rows;
}

function agendaItemSortRank(ag) {
  if (!ag.isCompleted) return 0;
  if (ag.isStandalone && ag.fromArchive) return 2;
  return 1;
}
function sortItemsForDay(list) {
  if (!list || list.length < 2) return;
  list.sort((a, b) => {
    const ra = agendaItemSortRank(a);
    const rb = agendaItemSortRank(b);
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

function parseLinks(x) {
  if (Array.isArray(x.links) && x.links.length) {
    return x.links.map(l => ({ name: String(l.name || "Link").trim() || "Link", url: String(l.url || "").trim() })).filter(l => l.url);
  }
  if (x.link && String(x.link).trim()) return [{ name: "Link", url: String(x.link).trim() }];
  return [];
}

function getObjectives(p) {
  const t = p.objectives || p.complete || p.targets;
  if (!t) return [];
  if (Array.isArray(t)) {
    return t.map(x => {
      if (typeof x === "object" && x && x.item) {
        const o = { item: String(x.item).trim(), frequency: (x.frequency || "daily").toLowerCase() };
        o.startDate = x.startDate || x.startingOn || "";
        /* Dataview / YAML may store DOW as strings; getDay() is numeric */
        o.days = Array.isArray(x.days)
          ? x.days.map((d) => (typeof d === "string" ? parseInt(d, 10) : Number(d))).filter((n) => !isNaN(n) && n >= 0 && n <= 6)
          : [];
        o.links = parseLinks(x);
        return o;
      }
      if (typeof x === "string" && x.trim()) return { item: x.trim(), frequency: "daily", startDate: "", days: [], links: [] };
      return null;
    }).filter(Boolean);
  }
  if (typeof t === "string") return t.trim() ? [{ item: t.trim(), frequency: "daily", startDate: "", days: [], links: [] }] : [];
  return [];
}

const weekDates = getWeekDatesMonSun(selectedDate);
const itemsByDay = {};
for (const d of weekDates) {
  itemsByDay[d] = [];
  for (const p of pages) {
    if (!isStructuredMissionMainPath(p.file.path)) continue;
    const dayList = getDaysInRange(p.timeframe);
    const missionStart = dayList[0] || d;
    const items = getObjectives(p).filter(t => {
      const f = (t.frequency || "daily").toLowerCase();
      return ["daily", "weekly", "monthly", "custom"].includes(f);
    });
    const missionName = (p.file.name || "").replace(/\.md$/, "");
    for (const t of items) {
      const item = t.item;
      if (!item) continue;
      if (!shouldShowObjectiveOnDate(t, d, missionStart)) continue;
      const isCompleted = isItemCompletedForDate(p, d, t);
      itemsByDay[d].push({ mission: missionName, missionPath: p.file.path, item, links: t.links || [], isCompleted });
    }
  }
  for (const row of collectStandaloneForDate(d)) {
    const { p, displayName, scheduled, dueTime, isCompleted, isOverdue, fromArchive } = row;
    itemsByDay[d].push({
      mission: displayName,
      missionPath: p.file.path,
      item: displayName,
      link: "",
      isStandalone: true,
      isCompleted,
      isOverdue: !!isOverdue,
      scheduledDate: scheduled,
      dueTime: dueTime || "",
      fromArchive: !!fromArchive
    });
  }
  sortItemsForDay(itemsByDay[d]);
}

const dotByDate = {};

function patchItemInCurrentDay(ag, completed) {
  const list = itemsByDay[selectedDate];
  if (!list) return;
  const idx = list.findIndex(x => x.missionPath === ag.missionPath && x.item === ag.item && !!x.isStandalone === !!ag.isStandalone);
  if (idx >= 0) list[idx] = { ...list[idx], isCompleted: completed };
}

function refreshDotForDate(dateStr) {
  const dot = dotByDate[dateStr];
  if (!dot) return;
  const items = itemsByDay[dateStr] || [];
  const total = items.length;
  const completed = items.filter(x => x.isCompleted).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  dot.style.setProperty("--progress", pct);
  dot.style.setProperty("--progress-color", getProgressColor(pct));
  dot.title = dateStr + " — click to view " + (total > 0 ? completed + "/" + total + " (" + pct + "%)" : "—");
}

async function completeAgendaItem(filePath, targetItem, cardEl) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  const dayKey = selectedDate;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (!fm.completion) fm.completion = {};
    if (!fm.completion[dayKey]) fm.completion[dayKey] = [];
    if (!fm.completion[dayKey].includes(targetItem)) fm.completion[dayKey].push(targetItem);
  });
  cardEl.classList.add("missions-agenda-card-done");
  const cb = cardEl.querySelector(".missions-agenda-checkbox");
  if (cb) cb.checked = true;
  patchItemInCurrentDay({ missionPath: filePath, item: targetItem, isStandalone: false }, true);
  sortItemsForDay(itemsByDay[selectedDate]);
  refreshDotForDate(selectedDate);
  renderAgendaCards();
}

async function uncompleteAgendaItem(filePath, targetItem, cardEl) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  const dayKey = selectedDate;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (fm.completion && fm.completion[dayKey]) {
      fm.completion[dayKey] = fm.completion[dayKey].filter(x => x !== targetItem);
      if (fm.completion[dayKey].length === 0) delete fm.completion[dayKey];
    }
  });
  cardEl.classList.remove("missions-agenda-card-done");
  const cb = cardEl.querySelector(".missions-agenda-checkbox");
  if (cb) cb.checked = false;
  patchItemInCurrentDay({ missionPath: filePath, item: targetItem, isStandalone: false }, false);
  sortItemsForDay(itemsByDay[selectedDate]);
  refreshDotForDate(selectedDate);
  renderAgendaCards();
}

async function ensureStandaloneProperties(filePath, scheduledDate) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (!fm.schedule) fm.schedule = scheduledDate;
    if (fm.dueTime && !fm.due_time) {
      const n = normalizeDueTimeString(fm.dueTime);
      if (n) fm.due_time = n;
    }
  });
}

function fileStemFromPath(path) {
  const base = String(path || "").split("/").pop() || "";
  return base.replace(/\.md$/, "");
}

/** Move standalone into z_archive after check (collision-safe name). Returns final path. */
async function moveStandaloneToArchiveAfterComplete(file) {
  if (!file || file.extension !== "md") return file.path;
  if (isArchiveStandalonePath(file.path)) return file.path;
  await ensureFolderExists(AGENDA_ARCHIVE_FOLDER);
  let destPath = AGENDA_ARCHIVE_FOLDER + "/" + file.name;
  let n = 2;
  while (app.vault.getAbstractFileByPath(destPath)) {
    destPath = AGENDA_ARCHIVE_FOLDER + "/" + file.basename + " " + n + ".md";
    n++;
  }
  await app.fileManager.renameFile(file, destPath);
  return destPath;
}

/** Restore standalone from archive to Unfinished when unchecking. Returns final path. */
async function moveStandaloneFromArchiveToUnfinished(file) {
  if (!file || file.extension !== "md") return file.path;
  if (!isArchiveStandalonePath(file.path)) return file.path;
  const folder = getUnfinishedFolderResolved();
  await ensureFolderExists(folder);
  let destPath = folder + "/" + file.name;
  let n = 2;
  while (app.vault.getAbstractFileByPath(destPath)) {
    destPath = folder + "/" + file.basename + " " + n + ".md";
    n++;
  }
  await app.fileManager.renameFile(file, destPath);
  return destPath;
}

function patchStandaloneRowInDay(oldPath, newPath, extra) {
  const list = itemsByDay[selectedDate];
  if (!list) return;
  const idx = list.findIndex((x) => x.isStandalone && x.missionPath === oldPath);
  if (idx < 0) return;
  const stem = fileStemFromPath(newPath);
  list[idx] = { ...list[idx], ...extra, missionPath: newPath, item: stem, mission: stem };
}

async function completeStandaloneItem(filePath, cardEl, scheduledDate) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== "md") return;
    const displayName = (file.name || "").replace(/\.md$/, "");
    await app.fileManager.processFrontMatter(file, (fm) => {
      fm.schedule = scheduledDate;
      if (!fm.completion) fm.completion = {};
      if (!fm.completion[scheduledDate]) fm.completion[scheduledDate] = [];
      if (!fm.completion[scheduledDate].includes(displayName)) fm.completion[scheduledDate].push(displayName);
    });
    let fileAfter = app.vault.getAbstractFileByPath(filePath);
    if (!fileAfter || fileAfter.extension !== "md") return;
    const newPath = await moveStandaloneToArchiveAfterComplete(fileAfter);
    const newStem = fileStemFromPath(newPath);
    if (newStem !== displayName) {
      const fFix = app.vault.getAbstractFileByPath(newPath);
      if (fFix) {
        await app.fileManager.processFrontMatter(fFix, (fm) => {
          const arr = fm.completion && fm.completion[scheduledDate];
          if (Array.isArray(arr)) {
            const i = arr.indexOf(displayName);
            if (i >= 0) arr[i] = newStem;
          }
        });
      }
    }
    cardEl.classList.add("missions-agenda-card-done");
    cardEl.classList.remove("missions-agenda-card-overdue");
    const cb = cardEl.querySelector(".missions-agenda-checkbox");
    if (cb) cb.checked = true;
    patchStandaloneRowInDay(filePath, newPath, { isCompleted: true, fromArchive: true, isOverdue: false });
    sortItemsForDay(itemsByDay[selectedDate]);
    refreshDotForDate(selectedDate);
    renderAgendaCards();
  } catch (e) {
    new Notice("Error: " + (e.message || "Could not complete"));
  }
}

async function uncompleteStandaloneItem(filePath, cardEl, scheduledDate, isOverdue) {
  try {
    let file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== "md") return;
    let curPath = filePath;
    if (isArchiveStandalonePath(file.path)) {
      curPath = await moveStandaloneFromArchiveToUnfinished(file);
      file = app.vault.getAbstractFileByPath(curPath);
      if (!file || file.extension !== "md") return;
    }
    const displayName = (file.name || "").replace(/\.md$/, "");
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (fm.completion && fm.completion[scheduledDate]) {
        fm.completion[scheduledDate] = fm.completion[scheduledDate].filter((x) => x !== displayName);
        if (fm.completion[scheduledDate].length === 0) delete fm.completion[scheduledDate];
      }
    });
    cardEl.classList.remove("missions-agenda-card-done");
    if (isOverdue) cardEl.classList.add("missions-agenda-card-overdue");
    const cb = cardEl.querySelector(".missions-agenda-checkbox");
    if (cb) cb.checked = false;
    patchStandaloneRowInDay(filePath, curPath, { isCompleted: false, fromArchive: false, isOverdue: !!isOverdue });
    sortItemsForDay(itemsByDay[selectedDate]);
    refreshDotForDate(selectedDate);
    renderAgendaCards();
  } catch (e) {
    new Notice("Error: " + (e.message || "Could not uncomplete"));
  }
}

function getWeekDatesMonSun(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    dates.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"));
  }
  return dates;
}

function getProgressColor(pct) {
  const red = agendaCustomize.progressRed || "#b91c1c";
  const green = agendaCustomize.progressGreen || "#22c55e";
  let mid = String(agendaCustomize.progressMid || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(mid)) mid = blendHex(red, green, 0.5);
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 50) return blendHex(red, mid, p / 50);
  return blendHex(mid, green, (p - 50) / 50);
}
function blendHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b_ = Math.round(ab + (bb - ab) * t);
  return "#" + [r, g, b_].map(x => x.toString(16).padStart(2, "0")).join("");
}

function refreshWeekProgressColors() {
  for (let i = 0; i < 7; i++) {
    const dateStr = weekDates[i];
    const dot = dotByDate[dateStr];
    if (!dot) continue;
    const dayItems = itemsByDay[dateStr] || [];
    const total = dayItems.length;
    const completed = dayItems.filter(ag => ag.isCompleted).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    dot.style.setProperty("--progress", pct);
    dot.style.setProperty("--progress-color", getProgressColor(pct));
  }
}

function openAgendaCustomizeModal() {
  let curDefault = "deadlines";
  try {
    const d = localStorage.getItem(LS_AGENDA_DEFAULT_RIGHT);
    if (d === "objectives") curDefault = "objectives";
  } catch (e) {}
  const overlay = document.body.createEl("div", { cls: "agenda-actions-overlay agenda-customize-overlay" });
  const modal = overlay.createEl("div", { cls: "agenda-actions-modal agenda-customize-modal" });
  const custHead = modal.createEl("div", { cls: "agenda-customize-header" });
  custHead.createEl("h4", { cls: "agenda-actions-title agenda-customize-main-title", text: "Customize agenda" });
  custHead.createEl("p", { cls: "agenda-customize-subtitle", text: "Text scale, colors, and default right tab." });
  const form = modal.createEl("div", { cls: "agenda-customize-form" });
  function section(title, hint) {
    const s = form.createEl("div", { cls: "agenda-customize-section" });
    const head = s.createEl("div", { cls: "agenda-customize-section-head" });
    head.createEl("div", { cls: "agenda-customize-section-title", text: title });
    if (hint) head.createEl("p", { cls: "agenda-customize-section-hint", text: hint });
    return s;
  }
  function hexOrFallback(hexVal, fb) {
    const v = String(hexVal || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb;
  }
  /** Compact label + color (no full-width row). */
  function colorSwatch(parent, labelText, id, hexVal, fallback) {
    const cell = parent.createEl("div", { cls: "agenda-customize-swatch" });
    cell.createEl("label", { cls: "agenda-customize-swatch-lbl", text: labelText, attr: { for: id } });
    const inp = cell.createEl("input", {
      type: "color",
      cls: "agenda-customize-color agenda-customize-color-compact",
      attr: { id }
    });
    inp.value = hexOrFallback(hexVal, fallback);
    return inp;
  }

  const secDef = section("Right panel", "Deadlines vs objectives on first open.");
  const segRow = secDef.createEl("div", { cls: "agenda-customize-seg-group", attr: { role: "group", "aria-label": "Default panel" } });
  const btnDead = segRow.createEl("button", { type: "button", cls: "agenda-customize-seg", text: "Deadlines" });
  const btnObj = segRow.createEl("button", { type: "button", cls: "agenda-customize-seg", text: "Objectives" });
  let defRight = curDefault;
  function syncSeg() {
    btnDead.classList.toggle("agenda-customize-seg-active", defRight === "deadlines");
    btnObj.classList.toggle("agenda-customize-seg-active", defRight === "objectives");
    btnDead.setAttribute("aria-pressed", defRight === "deadlines" ? "true" : "false");
    btnObj.setAttribute("aria-pressed", defRight === "objectives" ? "true" : "false");
  }
  btnDead.addEventListener("click", () => {
    defRight = "deadlines";
    syncSeg();
  });
  btnObj.addEventListener("click", () => {
    defRight = "objectives";
    syncSeg();
  });
  syncSeg();

  const secScale = section("Text size", "To-do and objective list text.");
  const scaleRow = secScale.createEl("div", { cls: "agenda-customize-scale-row" });
  scaleRow.createEl("span", { cls: "agenda-customize-scale-lbl", text: "Scale" });
  const scaleRange = scaleRow.createEl("input", { type: "range", cls: "agenda-customize-range", attr: { id: "agenda-cust-scale", min: "75", max: "130", step: "5" } });
  scaleRange.value = String(Math.round((agendaCustomize.textScale || 1) * 100));
  const scaleOut = scaleRow.createEl("output", { cls: "agenda-customize-scale-val", attr: { for: "agenda-cust-scale" } });
  function updateScaleLabel() {
    scaleOut.textContent = scaleRange.value + "%";
  }
  updateScaleLabel();
  scaleRange.addEventListener("input", updateScaleLabel);
  scaleRange.addEventListener("change", updateScaleLabel);
  scaleRange.oninput = updateScaleLabel;

  const secProg = section("Week progress", "Day ring color at 0%, 50%, and 100% done.");
  const progRow = secProg.createEl("div", { cls: "agenda-customize-swatch-row agenda-customize-swatch-row-3" });
  const inpRed = colorSwatch(progRow, "0%", "agenda-c-red", agendaCustomize.progressRed, "#b91c1c");
  const inpMid = colorSwatch(progRow, "50%", "agenda-c-mid", agendaCustomize.progressMid, "#d97706");
  const inpGr = colorSwatch(progRow, "100%", "agenda-c-green", agendaCustomize.progressGreen, "#22c55e");

  const secCards = section("Status & accent", "Done, overdue, and accent UI.");
  const cardRow = secCards.createEl("div", { cls: "agenda-customize-swatch-row agenda-customize-swatch-row-3" });
  const inpSucc = colorSwatch(cardRow, "Done", "agenda-c-succ", agendaCustomize.successColor, "#22c55e");
  const inpDan = colorSwatch(cardRow, "Overdue", "agenda-c-dan", agendaCustomize.dangerColor, "#b91c1c");
  const inpAcc = colorSwatch(cardRow, "Accent", "agenda-c-acc", agendaCustomize.accentColor, "#8b5cf6");

  const btnRow = modal.createEl("div", { cls: "agenda-customize-actions" });
  const resetBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Reset all" });
  const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
  const saveBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn missions-add-standalone-create", text: "Save" });

  function close() {
    overlay.remove();
  }
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  resetBtn.addEventListener("click", () => {
    agendaCustomize = cloneAgendaCustomizeDefaults();
    saveAgendaCustomize(agendaCustomize);
    applyAgendaCustomizeToRoot(container, agendaCustomize);
    try {
      localStorage.removeItem(LS_AGENDA_DEFAULT_RIGHT);
    } catch (e) {}
    refreshWeekProgressColors();
    close();
    new Notice("Agenda customization reset to defaults.");
  });
  saveBtn.addEventListener("click", () => {
    const defRightSave = defRight === "objectives" ? "objectives" : "deadlines";
    try {
      localStorage.setItem(LS_AGENDA_DEFAULT_RIGHT, defRightSave);
    } catch (e) {}
    const sc = Math.max(0.5, Math.min(2, parseInt(scaleRange.value, 10) / 100));
    const keepRing = agendaCustomize.todayRing;
    const keepLetter = agendaCustomize.todayLetter;
    agendaCustomize = {
      textScale: isNaN(sc) ? 1 : sc,
      progressRed: inpRed.value,
      progressMid: inpMid.value,
      progressGreen: inpGr.value,
      todayRing: typeof keepRing === "string" ? keepRing : "",
      todayLetter: typeof keepLetter === "string" ? keepLetter : "",
      successColor: inpSucc.value,
      dangerColor: inpDan.value,
      accentColor: inpAcc.value
    };
    saveAgendaCustomize(agendaCustomize);
    applyAgendaCustomizeToRoot(container, agendaCustomize);
    refreshWeekProgressColors();
    close();
    new Notice("Agenda settings saved.");
  });
}

// Week strip (above horizontal rule) + two columns below with vertical separator (T layout)
const weekOuter = container.createEl("div", { cls: "missions-agenda-week-outer" });
const weekStrip = weekOuter.createEl("div", { cls: "missions-agenda-week-strip" });
const todayBtn = weekStrip.createEl("button", {
  type: "button",
  cls: "missions-agenda-today-btn",
  text: "Today"
});
todayBtn.addEventListener("click", () => {
  if (selectedDate === today) return;
  selectedDate = today;
  persistAgendaSelectedDate();
  if (!weekDates.includes(today)) {
    location.reload();
    return;
  }
  for (const d of weekDates) {
    const el = dotByDate[d];
    if (el) el.classList.toggle("missions-agenda-week-dot-selected", d === selectedDate);
  }
  updateAgendaTitle();
  renderAgendaCards();
  renderRightPanel();
});
const weekStripMain = weekStrip.createEl("div", { cls: "missions-agenda-week-strip-main" });
const prevWeekBtn = weekStripMain.createEl("button", { type: "button", cls: "missions-agenda-week-arrow missions-agenda-week-arrow-prev", text: "<" });
prevWeekBtn.setAttribute("aria-label", "Previous week");
prevWeekBtn.addEventListener("click", () => {
  try {
    sessionStorage.setItem(SS_AGENDA_SELECTED_DATE, addDaysIso(selectedDate, -7));
  } catch (e) {}
  location.reload();
});
const weekProgressWrap = weekStripMain.createEl("div", { cls: "missions-agenda-week-wrap" });
const nextWeekBtn = weekStripMain.createEl("button", { type: "button", cls: "missions-agenda-week-arrow missions-agenda-week-arrow-next", text: ">" });
nextWeekBtn.setAttribute("aria-label", "Next week");
nextWeekBtn.addEventListener("click", () => {
  try {
    sessionStorage.setItem(SS_AGENDA_SELECTED_DATE, addDaysIso(selectedDate, 7));
  } catch (e) {}
  location.reload();
});
const weekStripEnd = weekStrip.createEl("div", { cls: "missions-agenda-week-strip-end" });
const customizeBtn = weekStripEnd.createEl("button", {
  type: "button",
  cls: "missions-agenda-customize-btn",
  text: "\u2699",
  attr: { "aria-label": "Customize agenda appearance" }
});
customizeBtn.addEventListener("click", () => {
  openAgendaCustomizeModal();
});
const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];
for (let i = 0; i < 7; i++) {
  const dateStr = weekDates[i];
  const dayItems = itemsByDay[dateStr] || [];
  const total = dayItems.length;
  const completed = dayItems.filter(ag => ag.isCompleted).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dot = weekProgressWrap.createEl("div", { cls: "missions-agenda-week-dot" });
  dotByDate[dateStr] = dot;
  dot.style.setProperty("--progress", pct);
  dot.style.setProperty("--progress-color", getProgressColor(pct));
  dot.style.cursor = "pointer";
  if (dateStr === today) dot.classList.add("missions-agenda-week-dot-today");
  if (dateStr === selectedDate) dot.classList.add("missions-agenda-week-dot-selected");
  dot.createEl("span", { cls: "missions-agenda-week-dot-letter", text: dayLetters[i] });
  dot.title = dateStr + " — click to view " + (total > 0 ? completed + "/" + total + " (" + pct + "%)" : "—");
  dot.addEventListener("click", () => {
    if (dateStr === selectedDate) return;
    selectedDate = dateStr;
    persistAgendaSelectedDate();
    for (const d of weekDates) {
      const el = dotByDate[d];
      if (el) el.classList.toggle("missions-agenda-week-dot-selected", d === selectedDate);
    }
    updateAgendaTitle();
    renderAgendaCards();
    renderRightPanel();
  });
}

// Two columns below week strip: day checklist (left) | Objectives cards (right)
const mainSplit = container.createEl("div", { cls: "missions-agenda-dashboard-split" });

// Agenda section
const agendaSection = mainSplit.createEl("div", { cls: "missions-agenda-section" });
const agendaHeaderRow = agendaSection.createEl("div", { cls: "missions-agenda-header-row missions-agenda-header-with-add" });
const agendaTitleBlock = agendaHeaderRow.createEl("div", { cls: "missions-agenda-header-title-block" });
agendaTitleBlock.createEl("h2", { cls: "missions-agenda-title missions-agenda-title-weekday", text: "To Do" });
const stripDateSpan = agendaTitleBlock.createEl("span", { cls: "missions-agenda-header-date", text: formatShortUsDate(selectedDate) });
const headerBtnGroup = agendaHeaderRow.createEl("div", { cls: "agenda-header-btn-group" });
const addTodoBtn = headerBtnGroup.createEl("button", {
  type: "button",
  cls: "missions-dash-add-btn",
  text: "+",
  attr: { "aria-label": "Add to-do" }
});
const actionsHeaderBtn = headerBtnGroup.createEl("button", {
  type: "button",
  cls: "missions-dash-add-btn agenda-header-actions-btn",
  text: "\u22EF",
  attr: { "aria-label": "Item actions" }
});
actionsHeaderBtn.addEventListener("click", () => { openActionsModal(); });

function updateAddTodoButtonState() {
  const allowed = selectedDate >= today;
  /* No native `disabled` — keeps hover tooltips working in all browsers */
  addTodoBtn.classList.toggle("missions-dash-add-btn-disabled", !allowed);
  addTodoBtn.setAttribute("aria-disabled", allowed ? "false" : "true");
  addTodoBtn.tabIndex = allowed ? 0 : -1;
  if (allowed) {
    /* Obsidian preview shows both native `title` and `aria-label` tooltips — use one only */
    addTodoBtn.removeAttribute("title");
    addTodoBtn.setAttribute("aria-label", "Add to-do for " + formatShortUsDate(selectedDate) + " (default due date in the form)");
  } else {
    addTodoBtn.removeAttribute("aria-label");
    addTodoBtn.title = "Select a current or future date.";
  }
}

addTodoBtn.addEventListener("click", () => {
  if (selectedDate < today) return;
  openAddStandaloneTodoModal();
});

const agendaCards = agendaSection.createEl("div", { cls: "missions-agenda-cards" });

function updateAgendaTitle() {
  stripDateSpan.textContent = formatShortUsDate(selectedDate);
  updateAddTodoButtonState();
}

const REPO_NEW_FOLDER = "Data/Tools/Repository/New";

async function readFileBody(filePath) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return "";
  const raw = await app.vault.read(file);
  return raw.replace(/^---[\s\S]*?---\s*/, "").trim();
}

async function archiveStandaloneItems(items) {
  await ensureFolderExists(AGENDA_ARCHIVE_FOLDER);
  let count = 0;
  for (const ag of items) {
    const file = app.vault.getAbstractFileByPath(ag.missionPath);
    if (!file || file.extension !== "md") continue;
    const dest = AGENDA_ARCHIVE_FOLDER + "/" + file.name;
    if (app.vault.getAbstractFileByPath(dest)) {
      new Notice("Skipped (name exists in archive): " + file.name);
      continue;
    }
    await app.fileManager.renameFile(file, dest);
    count++;
  }
  return count;
}

async function moveItemsToRepository(items) {
  await ensureFolderExists(REPO_NEW_FOLDER);
  let count = 0;
  for (const ag of items) {
    const file = app.vault.getAbstractFileByPath(ag.missionPath);
    if (!file || file.extension !== "md") continue;
    const dest = REPO_NEW_FOLDER + "/" + file.name;
    if (app.vault.getAbstractFileByPath(dest)) {
      new Notice("Skipped (name exists in Repository/New): " + file.name);
      continue;
    }
    await app.fileManager.renameFile(file, dest);
    count++;
  }
  return count;
}

async function combineItems(items) {
  if (items.length < 2) { new Notice("Select at least 2 items to combine."); return 0; }
  const bodies = [];
  for (const ag of items) {
    const body = await readFileBody(ag.missionPath);
    bodies.push("## " + ag.item + "\n" + (body || "(empty)"));
  }
  const combinedBody = bodies.join("\n\n---\n\n");
  const firstName = items[0].item;
  const folder = getUnfinishedFolderResolved();
  await ensureFolderExists(folder);
  const stem = objectiveToFileStem(firstName + " (combined)");
  let fullPath = folder + "/" + stem + ".md";
  let n = 2;
  while (app.vault.getAbstractFileByPath(fullPath)) { fullPath = folder + "/" + stem + " " + n + ".md"; n++; }
  const schedule = items[0].scheduledDate || selectedDate;
  const dt = normalizeDueTimeString(items[0].dueTime);
  const yamlLines = ["---", "schedule: " + schedule];
  if (dt) yamlLines.push('due_time: "' + dt + '"');
  yamlLines.push("---", "", combinedBody, "");
  await app.vault.create(fullPath, yamlLines.join("\n"));
  await ensureFolderExists(AGENDA_ARCHIVE_FOLDER);
  for (const ag of items) {
    const file = app.vault.getAbstractFileByPath(ag.missionPath);
    if (!file || file.extension !== "md") continue;
    const dest = AGENDA_ARCHIVE_FOLDER + "/" + file.name;
    if (!app.vault.getAbstractFileByPath(dest)) await app.fileManager.renameFile(file, dest);
  }
  return items.length;
}

function removeItemsFromDay(items) {
  const list = itemsByDay[selectedDate];
  if (!list) return;
  const paths = new Set(items.map(a => a.missionPath));
  itemsByDay[selectedDate] = list.filter(x => !paths.has(x.missionPath));
}

function openActionsModal() {
  const standalones = (itemsByDay[selectedDate] || []).filter(a => a.isStandalone && !a.fromArchive);
  if (standalones.length === 0) { new Notice("No to-do items to act on."); return; }

  const overlay = document.body.createEl("div", { cls: "agenda-actions-overlay" });
  const modal = overlay.createEl("div", { cls: "agenda-actions-modal agenda-actions-modal-select-todos" });
  const headerRow = modal.createEl("div", { cls: "agenda-actions-header-row" });
  headerRow.createEl("h4", { cls: "agenda-actions-title", text: "Select Todo Items" });
  const selAllLabel = headerRow.createEl("label", { cls: "agenda-actions-select-all-top" });
  const selAllCb = selAllLabel.createEl("input", { type: "checkbox", cls: "agenda-actions-cb" });
  selAllLabel.createEl("span", { cls: "agenda-actions-label-muted", text: "Select all" });

  const listWrap = modal.createEl("div", { cls: "agenda-actions-list" });
  const selected = new Set();
  const checkboxEls = [];

  for (const ag of standalones) {
    const row = listWrap.createEl("label", { cls: "agenda-actions-row" });
    const cb = row.createEl("input", { type: "checkbox", cls: "agenda-actions-cb" });
    const labelText = ag.dueTime ? ag.item + " · " + formatDueTimeForDisplay(ag.dueTime) : ag.item;
    row.createEl("span", { cls: "agenda-actions-label", text: labelText });
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(ag); else selected.delete(ag);
      updateActionButtons();
    });
    checkboxEls.push({ cb, ag });
  }

  selAllCb.addEventListener("change", () => {
    for (const { cb, ag } of checkboxEls) {
      cb.checked = selAllCb.checked;
      if (selAllCb.checked) selected.add(ag); else selected.delete(ag);
    }
    updateActionButtons();
  });

  const btnRow = modal.createEl("div", { cls: "agenda-actions-buttons" });
  const combineBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn agenda-actions-btn-combine", text: "Combine" });
  const repoBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn agenda-actions-btn-repo", text: "To Repository" });
  const archiveBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn agenda-actions-btn-archive", text: "Archive" });
  const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });

  function updateActionButtons() {
    const n = selected.size;
    combineBtn.disabled = n < 2;
    combineBtn.classList.toggle("agenda-actions-btn-disabled", n < 2);
    repoBtn.disabled = n < 1;
    repoBtn.classList.toggle("agenda-actions-btn-disabled", n < 1);
    archiveBtn.disabled = n < 1;
    archiveBtn.classList.toggle("agenda-actions-btn-disabled", n < 1);
  }
  updateActionButtons();

  function close() { overlay.remove(); }
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  combineBtn.addEventListener("click", async () => {
    if (selected.size < 2) return;
    const items = [...selected];
    try {
      const count = await combineItems(items);
      if (count > 0) {
        removeItemsFromDay(items);
        new Notice("Combined " + count + " items into one note.");
        close();
        renderAgendaCards();
        refreshDotForDate(selectedDate);
      }
    } catch (e) { new Notice("Error: " + (e.message || "Could not combine")); }
  });

  repoBtn.addEventListener("click", async () => {
    if (selected.size < 1) return;
    const items = [...selected];
    try {
      const count = await moveItemsToRepository(items);
      if (count > 0) {
        removeItemsFromDay(items);
        new Notice("Moved " + count + " item(s) to Repository/New.");
        close();
        renderAgendaCards();
        refreshDotForDate(selectedDate);
      }
    } catch (e) { new Notice("Error: " + (e.message || "Could not move")); }
  });

  archiveBtn.addEventListener("click", async () => {
    if (selected.size < 1) return;
    const items = [...selected];
    try {
      const count = await archiveStandaloneItems(items);
      if (count > 0) {
        removeItemsFromDay(items);
        new Notice("Archived " + count + " item(s).");
        close();
        renderAgendaCards();
        refreshDotForDate(selectedDate);
      }
    } catch (e) { new Notice("Error: " + (e.message || "Could not archive")); }
  });
}

function renderAgendaCards() {
  while (agendaCards.firstChild) agendaCards.removeChild(agendaCards.firstChild);
  const agendaItems = itemsByDay[selectedDate] || [];
  if (agendaItems.length === 0) {
    const empty = agendaCards.createEl("div", { cls: "missions-agenda-empty" });
    empty.textContent = selectedDate === today ? "All done for today" : "Nothing scheduled for this day";
    return;
  }
  for (const ag of agendaItems) {
    const cardClasses = ["missions-agenda-card"];
    if (ag.isCompleted) cardClasses.push("missions-agenda-card-done");
    if (ag.isStandalone && ag.isOverdue) cardClasses.push("missions-agenda-card-overdue");
    const card = agendaCards.createEl("div", { cls: cardClasses.join(" ") });
    const cb = card.createEl("input", { type: "checkbox", cls: "missions-agenda-checkbox", attr: { "aria-label": "Mark complete" } });
    cb.id = "ag-" + Math.random().toString(36).slice(2);
    if (ag.isCompleted) cb.checked = true;
    const content = card.createEl("div", { cls: "missions-agenda-card-content" });
    const itemWrap = content.createEl("div", { cls: "missions-agenda-item-wrap" });
    if (ag.isStandalone) {
      const titleRow = itemWrap.createEl("div", { cls: "missions-agenda-standalone-title-row" });
      const titleLink = titleRow.createEl("a", { href: ag.missionPath, text: ag.item, cls: "missions-agenda-item internal-link missions-agenda-title-link" });
      titleLink.setAttribute("data-href", ag.missionPath);
      titleLink.addEventListener("click", async (e) => {
        e.preventDefault();
        await ensureStandaloneProperties(ag.missionPath, ag.scheduledDate);
        const file = app.vault.getAbstractFileByPath(ag.missionPath);
        if (file) app.workspace.getLeaf().openFile(file);
      });
      if (ag.dueTime) {
        titleRow.createEl("span", { cls: "missions-agenda-due-time", text: formatDueTimeForDisplay(ag.dueTime) });
      }
    } else {
      const titleStack = itemWrap.createEl("div", { cls: "missions-agenda-title-stack" });
      const label = titleStack.createEl("label", { cls: "missions-agenda-item", text: ag.item });
      label.htmlFor = cb.id;
      const missionLink = titleStack.createEl("a", { href: ag.missionPath, text: ag.mission, cls: "internal-link missions-agenda-mission" });
      missionLink.setAttribute("data-href", ag.missionPath);
      if (ag.links && ag.links.length > 0) {
        const linkWrap = itemWrap.createEl("div", { cls: "missions-agenda-links-wrap" });
        if (ag.links.length === 1) {
          const l = ag.links[0];
          const linkEl = linkWrap.createEl("a", { href: l.url, text: l.name || "linked", cls: "missions-agenda-linked" });
          linkEl.setAttribute("data-href", l.url);
          if (l.url.startsWith("http://") || l.url.startsWith("https://")) { linkEl.target = "_blank"; linkEl.rel = "noopener"; }
          else linkEl.classList.add("internal-link");
        } else {
          const btn = linkWrap.createEl("button", {
            type: "button",
            text: "Links",
            cls: "missions-agenda-linked missions-agenda-links-btn",
            attr: { "aria-label": "Open links menu" }
          });
          const dropdown = linkWrap.createEl("div", { cls: "missions-agenda-links-dropdown" });
          ag.links.forEach(l => {
            const a = dropdown.createEl("a", { href: l.url, text: l.name || "Link", cls: "missions-agenda-linked-item" });
            a.setAttribute("data-href", l.url);
            if (l.url.startsWith("http://") || l.url.startsWith("https://")) { a.target = "_blank"; a.rel = "noopener"; }
            else a.classList.add("internal-link");
          });
          btn.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("open"); });
          document.addEventListener("click", (e) => { if (!linkWrap.contains(e.target)) dropdown.classList.remove("open"); });
        }
      }
    }
    cb.addEventListener("change", async () => {
      if (cb.checked) {
        if (ag.isStandalone) {
          await completeStandaloneItem(ag.missionPath, card, ag.scheduledDate);
        } else {
          await completeAgendaItem(ag.missionPath, ag.item, card);
        }
      } else {
        if (ag.isStandalone) {
          await uncompleteStandaloneItem(ag.missionPath, card, ag.scheduledDate, ag.isOverdue);
        } else {
          await uncompleteAgendaItem(ag.missionPath, ag.item, card);
        }
      }
    });
  }
}

updateAgendaTitle();
renderAgendaCards();

function parseDateStr(str) {
  str = String(str).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T12:00:00");
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }
  return null;
}

// Parse timeframe: "2/28/26 - 3/20/26" or "2026-02-28 - 2026-03-20"
function getDaysInRange(timeframe) {
  if (timeframe == null || timeframe === undefined) return [];
  let tf = "";
  if (typeof timeframe === "object") {
    if (timeframe.toISODate) tf = timeframe.toISODate();
    else if (timeframe.toISOString) tf = timeframe.toISOString().slice(0, 10);
    else tf = String(timeframe);
  } else if (typeof timeframe === "number") {
    tf = new Date(timeframe).toISOString().slice(0, 10);
  } else {
    tf = String(timeframe || "").trim();
  }
  if (!tf) return [];
  let parts = tf.split(" - ").map(s => s.trim());
  if (parts.length === 1 && tf.includes("-")) parts = tf.split(/\s*-\s*/).map(s => s.trim());
  let start, end;
  if (parts.length >= 2) {
    start = parseDateStr(parts[0]);
    end = parseDateStr(parts[1]);
  } else {
    end = parseDateStr(parts[0]);
    const todayDate = new Date(today + "T12:00:00");
    start = todayDate <= end ? todayDate : end;
    end = todayDate <= end ? end : todayDate;
  }
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  if (start > end) [start, end] = [end, start];
  const days = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getMonthDates(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let i = 1; i <= last; i++) {
    dates.push(year + "-" + String(month + 1).padStart(2, "0") + "-" + String(i).padStart(2, "0"));
  }
  return dates;
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const reformed = y + "-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  return reformed === dateStr.trim();
}

function toIso(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return isValidDate(dateStr) ? dateStr : "";
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const iso = y + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0");
    return isValidDate(iso) ? iso : "";
  }
  return "";
}

function shouldShowObjectiveOnDate(obj, dateStr, missionStart) {
  const freq = (obj.frequency || "daily").toLowerCase();
  const start = (obj.startDate && toIso(obj.startDate)) || missionStart;
  if (!start) return true;
  if (dateStr < start) return false;
  if (freq === "daily") return true;
  if (freq === "weekly") {
    const s = new Date(start + "T12:00:00").getTime();
    const d = new Date(dateStr + "T12:00:00").getTime();
    const diff = Math.round((d - s) / 86400000);
    return diff >= 0 && diff % 7 === 0;
  }
  if (freq === "monthly") {
    const ds = new Date(start + "T12:00:00");
    const dd = new Date(dateStr + "T12:00:00");
    return ds.getDate() === dd.getDate() && dateStr >= start;
  }
  if (freq === "custom" && obj.days && obj.days.length) {
    const dow = new Date(dateStr + "T12:00:00").getDay();
    return obj.days.some((d) => Number(d) === dow);
  }
  return false;
}

function isItemCompletedForDate(p, dateStr, obj) {
  const completion = p.completion || {};
  const freq = (obj.frequency || "daily").toLowerCase();
  if (freq === "daily") {
    const c = completion[dateStr];
    return Array.isArray(c) && c.includes(obj.item);
  }
  if (freq === "weekly") {
    // Same Mon–Sun week as the strip (was Sun–Sat via getWeekDates, which skewed rings at week boundaries)
    const monSunWeek = getWeekDatesMonSun(dateStr);
    return monSunWeek.some(d => {
      const c = completion[d];
      return Array.isArray(c) && c.includes(obj.item);
    });
  }
  if (freq === "monthly") {
    const monthDates = getMonthDates(dateStr);
    return monthDates.some(d => {
      const c = completion[d];
      return Array.isArray(c) && c.includes(obj.item);
    });
  }
  if (freq === "custom") {
    const c = completion[dateStr];
    return Array.isArray(c) && c.includes(obj.item);
  }
  return false;
}

function isDayComplete(p, dateStr, missionStart) {
  const items = getObjectives(p).filter(t => {
    const f = (t.frequency || "daily").toLowerCase();
    return ["daily", "weekly", "monthly", "custom"].includes(f);
  });
  const applicable = items.filter(t => shouldShowObjectiveOnDate(t, dateStr, missionStart));
  if (applicable.length === 0) return true;
  return applicable.every(t => isItemCompletedForDate(p, dateStr, t));
}

const MONTH_NAMES_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Same week grid as Objective Template Activity, one row per objective (per-item completion). */
function renderMiniContribGrid(combinedRoot, p, obj, dayList, missionStart, missionDaysSet) {
  if (dayList.length === 0) {
    combinedRoot.createEl("p", { cls: "missions-contrib-empty", text: "Set timeframe in note." });
    return;
  }
  const firstMission = new Date(dayList[0] + "T12:00:00");
  const lastMission = new Date(dayList[dayList.length - 1] + "T12:00:00");
  const displayStart = new Date(firstMission.getFullYear(), firstMission.getMonth(), 1);
  const endOfMonthAfterStart = new Date(firstMission.getFullYear(), firstMission.getMonth() + 2, 0);
  const endOfMissionEndMonth = new Date(lastMission.getFullYear(), lastMission.getMonth() + 1, 0);
  const displayEnd = new Date(Math.max(endOfMonthAfterStart.getTime(), endOfMissionEndMonth.getTime()));
  const block = combinedRoot.createEl("div", { cls: "missions-contrib-combined-block" });
  const body = block.createEl("div", { cls: "missions-contrib-month-body" });
  const dowBlock = body.createEl("div", { cls: "missions-contrib-dow-block" });
  dowBlock.createEl("div", { cls: "missions-contrib-dow-marker-gutter" });
  const dowCol = dowBlock.createEl("div", { cls: "missions-contrib-month-dow-col" });
  ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
    dowCol.createEl("span", { cls: "missions-contrib-month-dow-lbl", text: d });
  });
  const scan = new Date(displayStart);
  while (scan.getDay() !== 0) scan.setDate(scan.getDate() - 1);
  const endScan = new Date(displayEnd);
  while (endScan.getDay() !== 6) endScan.setDate(endScan.getDate() + 1);
  const weekStarts = [];
  const wk = new Date(scan);
  while (wk <= endScan) {
    weekStarts.push(new Date(wk));
    wk.setDate(wk.getDate() + 7);
  }
  const weeksCol = body.createEl("div", { cls: "missions-contrib-weeks-column" });
  const markersRow = weeksCol.createEl("div", { cls: "missions-contrib-markers-row" });
  const weeksWrap = weeksCol.createEl("div", { cls: "missions-contrib-month-weeks" });
  weekStarts.forEach((weekStart) => {
    const tmp = new Date(weekStart);
    let monthLabelText = "";
    for (let wi = 0; wi < 7; wi++) {
      if (tmp.getTime() >= displayStart.getTime() && tmp.getTime() <= displayEnd.getTime() && tmp.getDate() === 1) {
        monthLabelText = MONTH_NAMES_LONG[tmp.getMonth()];
        break;
      }
      tmp.setDate(tmp.getDate() + 1);
    }
    const markerCell = markersRow.createEl("div", { cls: "missions-contrib-month-marker-cell" });
    if (monthLabelText) markerCell.createEl("span", { cls: "missions-contrib-month-marker", text: monthLabelText, attr: { title: monthLabelText } });
  });
  weekStarts.forEach((weekStart) => {
    const cur = new Date(weekStart);
    const weekCol = weeksWrap.createEl("div", { cls: "missions-contrib-week-col" });
    for (let wi = 0; wi < 7; wi++) {
      const iso = cur.getFullYear() + "-" + String(cur.getMonth() + 1).padStart(2, "0") + "-" + String(cur.getDate()).padStart(2, "0");
      const cell = weekCol.createEl("div", { cls: "missions-contrib-cell", attr: { title: iso + " — " + (obj.item || "") } });
      if (!missionDaysSet.has(iso)) {
        cell.classList.add("missions-contrib-pad");
      } else if (!shouldShowObjectiveOnDate(obj, iso, missionStart)) {
        /* In mission timeframe but not a scheduled day (e.g. custom frequency skips some weekdays) */
        cell.classList.add("missions-contrib-off-pattern");
        cell.setAttribute("title", iso + " — not scheduled (" + (obj.item || "") + ")");
      } else {
        cell.classList.add("missions-contrib-in-range");
        if (iso === today) cell.classList.add("missions-contrib-today");
        if (iso <= today) {
          if (isItemCompletedForDate(p, iso, obj)) cell.classList.add("missions-contrib-done");
          else if (iso < today) cell.classList.add("missions-contrib-missed");
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
}

// Mission Status section: right column with Deadlines/Objectives toggle
const statusSection = mainSplit.createEl("div", { cls: "missions-status-section missions-agenda-progress-column" });
const statusHeader = statusSection.createEl("div", { cls: "missions-status-header-row missions-status-header-with-add" });
const statusToggle = statusHeader.createEl("div", { cls: "missions-panel-toggle" });
const deadlinesToggleBtn = statusToggle.createEl("button", {
  type: "button",
  cls: "missions-panel-toggle-btn",
  text: "Deadlines"
});
const objectivesToggleBtn = statusToggle.createEl("button", {
  type: "button",
  cls: "missions-panel-toggle-btn",
  text: "Objectives"
});
const statusAddBtn = statusHeader.createEl("button", {
  type: "button",
  cls: "missions-dash-add-btn",
  text: "+",
  attr: { "aria-label": "Add deadline" }
});
const statusContainer = statusSection.createEl("div", { cls: "missions-status-cards-container" });

// Exclude standalone pages from Objectives column (Unfinished .md or legacy loose Active .md)
const missionPages = pages.filter(p => isStructuredMissionMainPath(p.file.path));

const PROJECT_ROOTS = ["Data/Tools/Projects"];
function isProjectMainPath(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts.length === 5 && parts[0] === "Data" && parts[1] === "Tools" && parts[2] === "Projects") return path.endsWith(".md");
  if (parts.length === 6 && parts[0] === "Work" && parts[1] === "Data" && parts[2] === "Tools" && parts[3] === "Projects") return path.endsWith(".md");
  return false;
}
function loadProjectMainPages() {
  const out = [];
  const seen = new Set();
  for (const root of PROJECT_ROOTS) {
    try {
      if (!app.vault.getAbstractFileByPath(root)) continue;
      for (const p of dv.pages('"' + root + '"')) {
        if (!isProjectMainPath(p.file.path)) continue;
        const status = String(p.status || "").toLowerCase().trim();
        const isActiveStatus = status === "started" || status === "unstarted";
        if (!isActiveStatus) continue;
        if (p.archived === true) continue;
        if (p["dashboard-include"] === false) continue;
        if (seen.has(p.file.path)) continue;
        seen.add(p.file.path);
        out.push(p);
      }
    } catch (e) {}
  }
  return out.sort((a, b) => a.file.name.localeCompare(b.file.name));
}
function toIsoFromAny(raw) {
  if (raw == null || raw === undefined) return "";
  if (typeof raw === "object" && raw && raw.toISOString) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : toIso(s);
}
function deadlineVisibleOnDay(createdIso, completedOnIso, D) {
  if (!createdIso || D < createdIso) return false;
  if (completedOnIso) return D <= completedOnIso;
  return true;
}
function legacyDeadlineCompletedOnFromCompletion(p, idx) {
  const key = "deadline:" + idx;
  const comp = p.completion || {};
  let best = "";
  for (const day of Object.keys(comp)) {
    if (Array.isArray(comp[day]) && comp[day].includes(key)) {
      if (!best || day > best) best = day;
    }
  }
  return best;
}
function parseProjectDeadlines(p) {
  const rows = [];
  const projectName = (p.file.name || "").replace(/\.md$/, "");
  const pushFromRow = (d, idx) => {
    const date = toIsoFromAny(d.date || d.due || d.deadline || d.schedule);
    if (!date) return;
    const title = String(d.title || d.name || d.label || "Deadline").trim() || "Deadline";
    let created = toIsoFromAny(d.created);
    if (!created) created = date;
    let completedOn = toIsoFromAny(d.completedOn);
    if (!completedOn && idx >= 0) completedOn = legacyDeadlineCompletedOnFromCompletion(p, idx) || "";
    if (!deadlineVisibleOnDay(created, completedOn, selectedDate)) return;
    const isDoneForView = !!completedOn && selectedDate === completedOn;
    rows.push({ projectName, projectPath: p.file.path, deadlineIndex: idx, title, date, created, completedOn, isOverdue: !completedOn && date < today, isDoneForView });
  };
  if (Array.isArray(p.deadlines)) {
    for (let i = 0; i < p.deadlines.length; i++) {
      const d = p.deadlines[i];
      if (!d) continue;
      if (typeof d === "object") pushFromRow(d, i);
      else pushFromRow({ title: "Deadline", date: d }, i);
    }
  }
  if (p.deadline != null && p.deadline !== undefined) {
    const date = toIsoFromAny(p.deadline);
    if (date) {
      const created = date;
      if (deadlineVisibleOnDay(created, "", selectedDate)) {
        rows.push({ projectName, projectPath: p.file.path, deadlineIndex: -1, title: "Deadline", date, created, completedOn: "", isOverdue: date < today, isDoneForView: false });
      }
    }
  }
  return rows;
}
async function openAddDeadlineModal() {
  const projects = loadProjectMainPages();
  if (projects.length === 0) { new Notice("No project notes found under Data/Tools/Projects."); return; }
  const overlay = document.body.createEl("div", { cls: "missions-add-standalone-overlay" });
  const modal = overlay.createEl("div", { cls: "missions-add-standalone-modal" });
  modal.createEl("h4", { cls: "missions-add-standalone-title", text: "New deadline" });
  const projectWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  projectWrap.createEl("label", { text: "Project", attr: { for: "missions-add-deadline-project" } });
  const projectSelect = projectWrap.createEl("select", { cls: "missions-add-deadline-select", attr: { id: "missions-add-deadline-project" } });
  projects.forEach((p, i) => {
    projectSelect.createEl("option", { text: p.file.name, value: p.file.path, attr: i === 0 ? { selected: "selected" } : {} });
  });
  const titleWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  titleWrap.createEl("label", { text: "Deadline title", attr: { for: "missions-add-deadline-title" } });
  const titleInput = titleWrap.createEl("input", { type: "text", cls: "missions-add-standalone-date", attr: { id: "missions-add-deadline-title", placeholder: "Launch v1, Client review, etc." } });
  const dueWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
  dueWrap.createEl("label", { text: "Due date", attr: { for: "missions-add-deadline-due" } });
  const defaultDue = selectedDate >= today ? selectedDate : today;
  const dueInput = dueWrap.createEl("input", { type: "date", cls: "missions-add-standalone-date", attr: { id: "missions-add-deadline-due", value: defaultDue } });
  const btnRow = modal.createEl("div", { cls: "missions-add-standalone-actions" });
  const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn missions-add-standalone-create", text: "Create" });
  function close() { overlay.remove(); }
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  createBtn.addEventListener("click", async () => {
    const projectPath = String(projectSelect.value || "").trim();
    const due = String(dueInput.value || "").trim();
    const title = String(titleInput.value || "").trim() || "Deadline";
    if (!projectPath) { new Notice("Select a project."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { new Notice("Select a valid due date."); return; }
    const file = app.vault.getAbstractFileByPath(projectPath);
    if (!file || file.extension !== "md") { new Notice("Project note not found."); return; }
    try {
      await app.fileManager.processFrontMatter(file, (fm) => {
        if (!Array.isArray(fm.deadlines)) fm.deadlines = [];
        fm.deadlines.push({ title, date: due, created: today });
      });
      new Notice("Deadline added.");
      close();
      renderRightPanel();
    } catch (e) { new Notice("Error: " + (e.message || "Could not add deadline")); }
  });
  titleInput.focus();
}
function renderObjectiveCards() {
  missionPages.forEach(p => {
    const card = statusContainer.createEl("div", { cls: "missions-status-card missions-status-card-stack missions-agenda-mission-card" });
    const title = card.createEl("h3", { cls: "missions-status-card-title" });
    title.createEl("a", { cls: "internal-link", text: (p.file.name || "").replace(/\.md$/, ""), href: p.file.path, attr: { "data-href": p.file.path } });
    const objListWrap = card.createEl("div", { cls: "missions-agenda-mission-objectives" });
    const dayList = getDaysInRange(p.timeframe);
    const missionStart = dayList[0] || today;
    const missionDaysSet = new Set(dayList);
    const trackable = getObjectives(p).filter(t => {
      const f = (t.frequency || "daily").toLowerCase();
      return ["daily", "weekly", "monthly", "custom"].includes(f);
    });
    if (trackable.length === 0) {
      objListWrap.createEl("div", { cls: "missions-agenda-mini-empty", text: "No tasks yet" });
    } else if (dayList.length === 0) {
      objListWrap.createEl("div", { cls: "missions-agenda-mini-empty", text: "Set timeframe in note" });
    } else {
      trackable.forEach((obj) => {
        const row = objListWrap.createEl("div", { cls: "missions-agenda-objective-row" });
        const miniOuter = row.createEl("div", { cls: "missions-contrib-outer missions-agenda-mini-activity" });
        const combined = miniOuter.createEl("div", { cls: "missions-contrib-combined" });
        renderMiniContribGrid(combined, p, obj, dayList, missionStart, missionDaysSet);
      });
    }
  });
}
function syncDeadlineCardVisual(card, dl, completed) {
  card.classList.toggle("missions-deadline-card-done", completed);
  const showOverdue = !completed && dl.date < today;
  card.classList.toggle("missions-deadline-card-overdue", showOverdue);
  let badge = card.querySelector(".missions-deadline-overdue");
  if (showOverdue && !badge) card.createEl("span", { cls: "missions-deadline-overdue", text: "Overdue" });
  else if (!showOverdue && badge) badge.remove();
}
async function toggleDeadlineCompletionForDay(dl, completed) {
  const file = app.vault.getAbstractFileByPath(dl.projectPath);
  if (!file || file.extension !== "md" || dl.deadlineIndex < 0) { new Notice("Cannot update this deadline."); throw new Error("bad deadline"); }
  if (completed && selectedDate < dl.created) { new Notice("Cannot mark complete before the deadline's created date."); throw new Error("bad date"); }
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (!Array.isArray(fm.deadlines) || !fm.deadlines[dl.deadlineIndex]) return;
    let row = fm.deadlines[dl.deadlineIndex];
    if (typeof row !== "object" || row == null) row = { date: String(row || "") };
    if (completed) row.completedOn = selectedDate; else delete row.completedOn;
    fm.deadlines[dl.deadlineIndex] = row;
  });
}
function renderDeadlineCards() {
  const all = [];
  const projectPages = loadProjectMainPages();
  for (const p of projectPages) all.push(...parseProjectDeadlines(p));
  async function mutateDeadline(dl, mutator) {
    const file = app.vault.getAbstractFileByPath(dl.projectPath);
    if (!file || file.extension !== "md") { new Notice("Project note not found."); return; }
    if (dl.deadlineIndex < 0) { new Notice("This deadline uses legacy field format and cannot be edited here yet."); return; }
    try {
      await app.fileManager.processFrontMatter(file, (fm) => {
        if (!Array.isArray(fm.deadlines) || !fm.deadlines[dl.deadlineIndex]) return;
        let row = fm.deadlines[dl.deadlineIndex];
        if (typeof row !== "object" || row == null) row = { date: String(row || "") };
        mutator(row);
        fm.deadlines[dl.deadlineIndex] = row;
      });
      renderRightPanel();
    } catch (e) { new Notice("Error: " + (e.message || "Could not update deadline")); }
  }
  async function promptUpdateDate(dl) {
    const overlay = document.body.createEl("div", { cls: "missions-add-standalone-overlay" });
    const modal = overlay.createEl("div", { cls: "missions-add-standalone-modal" });
    modal.createEl("h4", { cls: "missions-add-standalone-title", text: "Update deadline date" });
    const dueWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
    dueWrap.createEl("label", { text: "Due date", attr: { for: "missions-edit-deadline-due" } });
    const dueInput = dueWrap.createEl("input", { type: "date", cls: "missions-add-standalone-date", attr: { id: "missions-edit-deadline-due", value: dl.date } });
    const btnRow = modal.createEl("div", { cls: "missions-add-standalone-actions" });
    const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
    const saveBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn missions-add-standalone-create", text: "Save" });
    function close() { overlay.remove(); }
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    saveBtn.addEventListener("click", async () => {
      const next = String(dueInput.value || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) { new Notice("Use date format YYYY-MM-DD."); return; }
      await mutateDeadline(dl, (row) => { row.date = next; delete row.due; delete row.deadline; delete row.schedule; });
      close();
      new Notice("Deadline date updated.");
    });
  }
  async function promptUpdateDescription(dl) {
    const overlay = document.body.createEl("div", { cls: "missions-add-standalone-overlay" });
    const modal = overlay.createEl("div", { cls: "missions-add-standalone-modal" });
    modal.createEl("h4", { cls: "missions-add-standalone-title", text: "Update deadline description" });
    const titleWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
    titleWrap.createEl("label", { text: "Description", attr: { for: "missions-edit-deadline-title" } });
    const titleInput = titleWrap.createEl("input", { type: "text", cls: "missions-add-standalone-date", attr: { id: "missions-edit-deadline-title", value: dl.title } });
    const btnRow = modal.createEl("div", { cls: "missions-add-standalone-actions" });
    const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
    const saveBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn missions-add-standalone-create", text: "Save" });
    function close() { overlay.remove(); }
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    saveBtn.addEventListener("click", async () => {
      const next = String(titleInput.value || "").trim();
      if (!next) { new Notice("Description is required."); return; }
      await mutateDeadline(dl, (row) => { row.title = next; delete row.name; delete row.label; });
      close();
      new Notice("Deadline description updated.");
    });
    titleInput.focus();
  }
  all.sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return a.projectName.localeCompare(b.projectName); });
  if (all.length === 0) { statusContainer.createEl("div", { cls: "missions-agenda-mini-empty", text: "No project deadlines yet" }); return; }
  for (const dl of all) {
    const cardClasses = ["missions-deadline-card"];
    if (dl.isDoneForView) cardClasses.push("missions-deadline-card-done");
    else if (dl.isOverdue) cardClasses.push("missions-deadline-card-overdue");
    const card = statusContainer.createEl("div", { cls: cardClasses.join(" ") });
    const top = card.createEl("div", { cls: "missions-deadline-title-row" });
    const titleWrap = top.createEl("div", { cls: "missions-deadline-title-wrap" });
    titleWrap.createEl("a", { cls: "internal-link missions-deadline-title-link", text: dl.title, href: dl.projectPath, attr: { "data-href": dl.projectPath } });
    titleWrap.createEl("div", { cls: "missions-deadline-date", text: formatShortUsDate(dl.date) });
    const rightCol = top.createEl("div", { cls: "missions-deadline-right-col" });
    const actionWrap = rightCol.createEl("div", { cls: "missions-deadline-actions-wrap" });
    const actionBtn = actionWrap.createEl("button", { type: "button", cls: "missions-deadline-actions-btn", text: "...", attr: { "aria-label": "Deadline actions" } });
    const actionMenu = actionWrap.createEl("div", { cls: "missions-deadline-actions-menu" });
    const updateDateBtn = actionMenu.createEl("button", { type: "button", cls: "missions-deadline-actions-item", text: "Update date" });
    const updateDescBtn = actionMenu.createEl("button", { type: "button", cls: "missions-deadline-actions-item", text: "Update description" });
    actionBtn.addEventListener("click", (e) => { e.stopPropagation(); actionMenu.classList.toggle("open"); });
    document.addEventListener("click", (e) => { if (!actionWrap.contains(e.target)) actionMenu.classList.remove("open"); });
    if (dl.deadlineIndex >= 0) {
      const cb = rightCol.createEl("input", {
        type: "checkbox",
        cls: "missions-deadline-checkbox",
        attr: { "aria-label": "Mark complete for " + formatShortUsDate(selectedDate) }
      });
      cb.checked = !!dl.completedOn && selectedDate === dl.completedOn;
      cb.addEventListener("change", () => {
        const completed = cb.checked;
        syncDeadlineCardVisual(card, dl, completed);
        queueMicrotask(async () => {
          try { await toggleDeadlineCompletionForDay(dl, completed); } catch (e) { cb.checked = !completed; syncDeadlineCardVisual(card, dl, !completed); }
        });
      });
    }
    updateDateBtn.addEventListener("click", async (e) => { e.stopPropagation(); actionMenu.classList.remove("open"); await promptUpdateDate(dl); });
    updateDescBtn.addEventListener("click", async (e) => { e.stopPropagation(); actionMenu.classList.remove("open"); await promptUpdateDescription(dl); });
    if (dl.isOverdue && !dl.isDoneForView) card.createEl("span", { cls: "missions-deadline-overdue", text: "Overdue" });
  }
}
function persistRightPanelMode(mode) {
  rightPanelMode = mode;
  try { sessionStorage.setItem(SS_AGENDA_RIGHT_MODE, mode); } catch (e) {}
}
function updateRightHeader() {
  const isDeadlines = rightPanelMode === "deadlines";
  deadlinesToggleBtn.classList.toggle("active", isDeadlines);
  objectivesToggleBtn.classList.toggle("active", !isDeadlines);
  if (isDeadlines) {
    statusAddBtn.removeAttribute("title");
    statusAddBtn.setAttribute("aria-label", "Add deadline");
  } else {
    statusAddBtn.removeAttribute("title");
    statusAddBtn.setAttribute("aria-label", "Add objective tracker (from template)");
  }
}
function renderRightPanel() {
  while (statusContainer.firstChild) statusContainer.removeChild(statusContainer.firstChild);
  updateRightHeader();
  if (rightPanelMode === "deadlines") renderDeadlineCards();
  else renderObjectiveCards();
}
deadlinesToggleBtn.addEventListener("click", () => { if (rightPanelMode === "deadlines") return; persistRightPanelMode("deadlines"); renderRightPanel(); });
objectivesToggleBtn.addEventListener("click", () => { if (rightPanelMode === "objectives") return; persistRightPanelMode("objectives"); renderRightPanel(); });
statusAddBtn.addEventListener("click", async () => {
  if (rightPanelMode === "deadlines") { await openAddDeadlineModal(); return; }
  const templaterPlugin = app.plugins.plugins["templater-obsidian"];
  const templateFile = app.vault.getAbstractFileByPath("Templates/Objective Template.md");
  if (templaterPlugin && templaterPlugin.templater && templateFile) {
    await templaterPlugin.templater.create_new_note_from_template(templateFile);
  } else {
    app.commands.executeCommandById("templater-obsidian:create-new-note-from-template");
  }
});
renderRightPanel();
```
