---
---

```dataviewjs
const app = this.app;
const container = (typeof this.container !== "undefined" ? this.container : dv.container);
const now = new Date();
const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

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

/** Direct .md under …/Unfinished/ */
function isUnfinishedStandaloneFile(path) {
  const parts = path.split("/");
  return parts.length >= 2 && parts[parts.length - 2] === "Unfinished";
}

let pages = loadPagesFromRoots(AGENDA_ROOTS);

const AGENDA_ARCHIVE_FOLDER = "z_archive/Agenda";

function parseScheduled(p) {
  const raw = p.due != null && p.due !== undefined ? p.due : p.scheduled;
  if (!raw) return "";
  const s = raw;
  if (typeof s === "object" && s && s.toISOString) return s.toISOString().slice(0, 10);
  return String(s).trim().slice(0, 10);
}

// Cleanup: move completed standalones from past days to archive (runs when dashboard loads)
try {
  if (!app.vault.getAbstractFileByPath(AGENDA_ARCHIVE_FOLDER)) await app.vault.createFolder(AGENDA_ARCHIVE_FOLDER);
  for (const root of UNFINISHED_ROOTS) {
    if (!app.vault.getAbstractFileByPath(root)) continue;
    for (const p of dv.pages('"' + root + '"')) {
    if (p.file.name.includes("Dashboard")) continue;
    if (!isUnfinishedStandaloneFile(p.file.path)) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    const completion = p.completion || {};
    let shouldArchive = false;
    const scheduled = parseScheduled(p);
    if (scheduled && scheduled < today) {
      shouldArchive = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    } else if (!scheduled) {
      // no properties: archive if completed on any past date
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
    const scheduled = parseScheduled(p);
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

// Standalone items: scheduled <= today (today + overdue), or no scheduled/due = treat as today
const standalonePages = [];
try {
  for (const root of UNFINISHED_ROOTS) {
    if (!app.vault.getAbstractFileByPath(root)) continue;
    for (const p of dv.pages('"' + root + '"')) {
    if (p.file.name.includes("Dashboard")) continue;
    if (!isUnfinishedStandaloneFile(p.file.path)) continue;
    let scheduled = parseScheduled(p);
    if (!scheduled) scheduled = today; // no due/scheduled = due today (phone / unfinished inbox)
    if (scheduled > today) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    const completion = p.completion || {};
    const isCompleted = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    const isOverdue = scheduled < today && !isCompleted;
    standalonePages.push({ p, displayName, scheduled, isCompleted, isOverdue });
    }
  }
  for (const p of dv.pages('"Tools/Agenda/Active"')) {
    if (p.file.name.includes("Dashboard")) continue;
    const pathParts = p.file.path.split("/");
    if (pathParts.length !== 4) continue;
    let scheduled = parseScheduled(p);
    if (!scheduled) scheduled = today;
    if (scheduled > today) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    const completion = p.completion || {};
    const isCompleted = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    const isOverdue = scheduled < today && !isCompleted;
    standalonePages.push({ p, displayName, scheduled, isCompleted, isOverdue });
  }
} catch (e) {}

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
        o.days = Array.isArray(x.days) ? x.days : [];
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

async function completeAgendaItem(filePath, targetItem, cardEl) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (!fm.completion) fm.completion = {};
    if (!fm.completion[today]) fm.completion[today] = [];
    if (!fm.completion[today].includes(targetItem)) fm.completion[today].push(targetItem);
  });
  cardEl.classList.add("missions-agenda-card-done");
  const cb = cardEl.querySelector(".missions-agenda-checkbox");
  if (cb) cb.checked = true;
  updateTodayDot(1);
}

async function uncompleteAgendaItem(filePath, targetItem, cardEl) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (fm.completion && fm.completion[today]) {
      fm.completion[today] = fm.completion[today].filter(x => x !== targetItem);
      if (fm.completion[today].length === 0) delete fm.completion[today];
    }
  });
  cardEl.classList.remove("missions-agenda-card-done");
  const cb = cardEl.querySelector(".missions-agenda-checkbox");
  if (cb) cb.checked = false;
  updateTodayDot(-1);
}

async function ensureStandaloneProperties(filePath, scheduledDate) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (!fm.scheduled && (fm.due == null || fm.due === undefined)) {
      fm.scheduled = scheduledDate;
    }
  });
}

async function completeStandaloneItem(filePath, cardEl, scheduledDate) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== "md") return;
    const displayName = (file.name || "").replace(/\.md$/, "");
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (!fm.scheduled) fm.scheduled = scheduledDate;
      if (!fm.completion) fm.completion = {};
      if (!fm.completion[scheduledDate]) fm.completion[scheduledDate] = [];
      if (!fm.completion[scheduledDate].includes(displayName)) fm.completion[scheduledDate].push(displayName);
    });
    cardEl.classList.add("missions-agenda-card-done");
    cardEl.classList.remove("missions-agenda-card-overdue");
    const cb = cardEl.querySelector(".missions-agenda-checkbox");
    if (cb) cb.checked = true;
    updateTodayDot(1);
  } catch (e) {
    new Notice("Error: " + (e.message || "Could not complete"));
  }
}

async function uncompleteStandaloneItem(filePath, cardEl, scheduledDate, isOverdue) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== "md") return;
    const displayName = (file.name || "").replace(/\.md$/, "");
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (fm.completion && fm.completion[scheduledDate]) {
        fm.completion[scheduledDate] = fm.completion[scheduledDate].filter(x => x !== displayName);
        if (fm.completion[scheduledDate].length === 0) delete fm.completion[scheduledDate];
      }
    });
    cardEl.classList.remove("missions-agenda-card-done");
    if (isOverdue) cardEl.classList.add("missions-agenda-card-overdue");
    const cb = cardEl.querySelector(".missions-agenda-checkbox");
    if (cb) cb.checked = false;
    updateTodayDot(-1);
  } catch (e) {
    new Notice("Error: " + (e.message || "Could not uncomplete"));
  }
}

// Build flat agenda: { mission, missionPath, item, link } — include daily, weekly, monthly, custom (including completed)
const agendaItems = [];
for (const p of pages) {
  if (!isStructuredMissionMainPath(p.file.path)) continue;
  const dayList = getDaysInRange(p.timeframe);
  const missionStart = dayList[0] || today;
  const items = getObjectives(p).filter(t => {
    const f = (t.frequency || "daily").toLowerCase();
    return ["daily", "weekly", "monthly", "custom"].includes(f);
  });
  const missionName = (p.file.name || "").replace(/\.md$/, "");
  for (const t of items) {
    const item = t.item;
    if (!item) continue;
    if (!shouldShowObjectiveOnDate(t, today, missionStart)) continue;
    const isCompleted = isItemCompletedForDate(p, today, t);
    agendaItems.push({ mission: missionName, missionPath: p.file.path, item, links: t.links || [], isCompleted });
  }
}

// Add standalone items (today + overdue, including completed)
for (const { p, displayName, scheduled, isCompleted, isOverdue } of standalonePages) {
  agendaItems.push({ mission: displayName, missionPath: p.file.path, item: displayName, link: "", isStandalone: true, isCompleted, isOverdue, scheduledDate: scheduled });
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

function getDayStats(dateStr) {
  let total = 0, completed = 0;
  const missionPgs = pages.filter(p => isStructuredMissionMainPath(p.file.path));
  for (const p of missionPgs) {
    const dayList = getDaysInRange(p.timeframe);
    const missionStart = dayList[0] || dateStr;
    const items = getObjectives(p).filter(t => ["daily", "weekly", "monthly", "custom"].includes((t.frequency || "daily").toLowerCase()));
    for (const t of items) {
      if (!shouldShowObjectiveOnDate(t, dateStr, missionStart)) continue;
      total++;
      if (isItemCompletedForDate(p, dateStr, t)) completed++;
    }
  }
  let archivePages = [];
  try { archivePages = Array.from(dv.pages('"z_archive/Agenda"') || []); } catch (e) {}
  const unfinishedPages = [];
  for (const root of UNFINISHED_ROOTS) {
    try {
      if (!app.vault.getAbstractFileByPath(root)) continue;
      unfinishedPages.push(...Array.from(dv.pages('"' + root + '"') || []));
    } catch (e) {}
  }
  const agendaPages = [];
  for (const root of AGENDA_ROOTS) {
    try {
      if (!app.vault.getAbstractFileByPath(root)) continue;
      agendaPages.push(...Array.from(dv.pages('"' + root + '"') || []));
    } catch (e) {}
  }
  for (const p of [...unfinishedPages, ...agendaPages, ...archivePages]) {
    if (p.file.name.includes("Dashboard")) continue;
    const pathParts = p.file.path.split("/");
    const isArchive = pathParts[0] === "z_archive";
    const isStandalone =
      (isArchive && pathParts.length === 3) ||
      (!isArchive && (isUnfinishedStandaloneFile(p.file.path) || (pathParts.length === 4 && pathParts[1] === "Agenda" && pathParts[2] === "Active")));
    if (!isStandalone) continue;
    let scheduled = parseScheduled(p);
    if (!scheduled) scheduled = today;
    const isForThisDay = dateStr === today ? (scheduled <= today) : (scheduled === dateStr);
    if (!isForThisDay) continue;
    const displayName = (p.file.name || "").replace(/\.md$/, "");
    total++;
    const completion = p.completion || {};
    const completedForDate = Array.isArray(completion[scheduled]) && completion[scheduled].includes(displayName);
    if (completedForDate) completed++;
  }
  return { total, completed };
}

function getProgressColor(pct) {
  const red = "#b91c1c", purple = "#8b5cf6", green = "#22c55e";
  if (pct <= 0) return red;
  if (pct <= 50) {
    const t = pct / 50;
    return blendHex(red, purple, t);
  }
  if (pct <= 75) return purple;
  if (pct < 100) {
    const t = (pct - 75) / 25;
    return blendHex(purple, green, t);
  }
  return green;
}
function blendHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b_ = Math.round(ab + (bb - ab) * t);
  return "#" + [r, g, b_].map(x => x.toString(16).padStart(2, "0")).join("");
}

function updateTodayDot(completedIncrement = 0) {
  const todayDot = container.querySelector(".missions-agenda-week-dot-today");
  if (!todayDot) return;
  const total = agendaItems.length;
  const completedCount = agendaItems.filter(ag => ag.isCompleted).length;
  const newCompleted = Math.max(0, Math.min(total, completedCount + completedIncrement));
  const pct = total > 0 ? Math.min(100, Math.round((newCompleted / total) * 100)) : 0;
  todayDot.style.setProperty("--progress", pct);
  todayDot.style.setProperty("--progress-color", getProgressColor(pct));
  todayDot.title = today + " " + (total > 0 ? newCompleted + "/" + total + " (" + pct + "%)" : "—");
}

// Week progress row (Mon–Sun) above Today — today uses agendaItems for exact match
const weekProgressWrap = container.createEl("div", { cls: "missions-agenda-week-wrap" });
const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];
const weekDates = getWeekDatesMonSun(today);
for (let i = 0; i < 7; i++) {
  const dateStr = weekDates[i];
  let total, completed, pct;
  if (dateStr === today) {
    total = agendaItems.length;
    completed = agendaItems.filter(ag => ag.isCompleted).length;
    pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  } else {
    const stats = getDayStats(dateStr);
    total = stats.total;
    completed = stats.completed;
    pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  }
  const dot = weekProgressWrap.createEl("div", { cls: "missions-agenda-week-dot" });
  dot.style.setProperty("--progress", pct);
  dot.style.setProperty("--progress-color", getProgressColor(pct));
  if (dateStr === today) dot.classList.add("missions-agenda-week-dot-today");
  dot.createEl("span", { cls: "missions-agenda-week-dot-letter", text: dayLetters[i] });
  dot.title = dateStr + " " + (total > 0 ? completed + "/" + total + " (" + pct + "%)" : "—");
}

// Agenda section
const agendaSection = container.createEl("div", { cls: "missions-agenda-section" });
agendaSection.createEl("h2", { cls: "missions-agenda-title", text: "Today" });

const agendaCards = agendaSection.createEl("div", { cls: "missions-agenda-cards" });
if (agendaItems.length === 0) {
  const empty = agendaCards.createEl("div", { cls: "missions-agenda-empty" });
  empty.textContent = "All done for today";
} else {
  for (const ag of agendaItems) {
    const cardClasses = ["missions-agenda-card"];
    if (ag.isCompleted) cardClasses.push("missions-agenda-card-done");
    if (ag.isStandalone && ag.isOverdue) cardClasses.push("missions-agenda-card-overdue");
    const card = agendaCards.createEl("div", { cls: cardClasses.join(" ") });
    const cb = card.createEl("input", { type: "checkbox", cls: "missions-agenda-checkbox" });
    cb.title = "Mark complete";
    cb.id = "ag-" + Math.random().toString(36).slice(2);
    if (ag.isCompleted) cb.checked = true;
    const content = card.createEl("div", { cls: "missions-agenda-card-content" });
    const itemWrap = content.createEl("div", { cls: "missions-agenda-item-wrap" });
    if (ag.isStandalone) {
      const titleLink = itemWrap.createEl("a", { href: ag.missionPath, text: ag.item, cls: "missions-agenda-item internal-link missions-agenda-title-link" });
      titleLink.setAttribute("data-href", ag.missionPath);
      titleLink.addEventListener("click", async (e) => {
        e.preventDefault();
        await ensureStandaloneProperties(ag.missionPath, ag.scheduledDate);
        const file = app.vault.getAbstractFileByPath(ag.missionPath);
        if (file) app.workspace.getLeaf().openFile(file);
      });
    } else {
      const label = itemWrap.createEl("label", { cls: "missions-agenda-item", text: ag.item });
      label.htmlFor = cb.id;
      if (ag.links && ag.links.length > 0) {
        const linkWrap = itemWrap.createEl("div", { cls: "missions-agenda-links-wrap" });
        if (ag.links.length === 1) {
          const l = ag.links[0];
          const linkEl = linkWrap.createEl("a", { href: l.url, text: l.name || "linked", cls: "missions-agenda-linked" });
          linkEl.setAttribute("data-href", l.url);
          if (l.url.startsWith("http://") || l.url.startsWith("https://")) { linkEl.target = "_blank"; linkEl.rel = "noopener"; }
          else linkEl.classList.add("internal-link");
        } else {
          const btn = linkWrap.createEl("button", { type: "button", text: "Links", cls: "missions-agenda-linked missions-agenda-links-btn" });
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
    if (!ag.isStandalone) {
      const missionLink = content.createEl("a", { href: ag.missionPath, text: ag.mission, cls: "internal-link missions-agenda-mission" });
      missionLink.setAttribute("data-href", ag.missionPath);
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

function getWeekDates(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    dates.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"));
  }
  return dates;
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
    return obj.days.includes(dow);
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
    const weekDates = getWeekDates(dateStr);
    return weekDates.some(d => {
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

// Mission Status section: mission cards with day-range calendar
const statusSection = container.createEl("div", { cls: "missions-status-section" });
const statusHeader = statusSection.createEl("div", { cls: "missions-status-header-row" });
statusHeader.createEl("h2", { cls: "missions-status-title", text: "Progress" });
const newMissionBtn = statusHeader.createEl("button", { cls: "missions-new-mission-btn", text: "+ New agenda" });
newMissionBtn.addEventListener("click", async () => {
  const templaterPlugin = app.plugins.plugins["templater-obsidian"];
  const templateFile = app.vault.getAbstractFileByPath("Templates/Agenda Template.md");
  if (templaterPlugin && templaterPlugin.templater && templateFile) {
    await templaterPlugin.templater.create_new_note_from_template(templateFile);
  } else {
    app.commands.executeCommandById("templater-obsidian:create-new-note-from-template");
  }
});
const statusContainer = statusSection.createEl("div", { cls: "missions-status-cards-container" });

// Exclude standalone pages from Progress (Unfinished .md or legacy loose Active .md)
const missionPages = pages.filter(p => isStructuredMissionMainPath(p.file.path));

for (let i = 0; i < missionPages.length; i += 3) {
  const row = statusContainer.createEl("div", { cls: "missions-status-row" });
  const pair = missionPages.slice(i, i + 3);
  pair.forEach(p => {
    const cell = row.createEl("div", { cls: "missions-status-cell" });
    const card = cell.createEl("a", { cls: "missions-status-card internal-link" });
    card.setAttribute("data-href", p.file.path);
    card.setAttribute("href", p.file.path);
    const title = card.createEl("h3", { cls: "missions-status-card-title" });
    title.textContent = (p.file.name || "").replace(/\.md$/, "");
    const calWrap = card.createEl("div", { cls: "missions-status-cal missions-status-cal-range" });
    const dayList = getDaysInRange(p.timeframe);
    const currentMonth = today.slice(0, 7);
    const monthDays = dayList.filter(d => d.slice(0, 7) === currentMonth);
    if (monthDays.length === 0) {
      const empty = calWrap.createEl("div", { cls: "missions-status-cal-empty-msg" });
      empty.textContent = "No days this month";
    } else {
      const missionStart = dayList[0] || today;
      monthDays.forEach(dateStr => {
        const dayEl = calWrap.createEl("div", { cls: "missions-status-cal-day missions-status-cal-day-compact" });
        const isFuture = dateStr > today;
        if (isFuture) {
          dayEl.addClass("missions-status-cal-future");
        } else {
          const done = isDayComplete(p, dateStr, missionStart);
          dayEl.addClass(done ? "missions-status-cal-done" : "missions-status-cal-not-done");
        }
        if (dateStr === today) dayEl.addClass("missions-status-cal-today");
        const dayNum = dayEl.createEl("div", { cls: "missions-status-cal-day-num" });
        dayNum.textContent = dateStr.slice(8, 10);
        dayEl.title = dateStr;
      });
    }
  });
}
```
