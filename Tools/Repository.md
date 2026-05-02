---
---

```dataviewjs
const app = this.app;
const container = (typeof this.container !== "undefined" ? this.container : dv.container);
/** Capture + developing-tag notes for the Repository tool (all tool data under `Data/`). */
const REPO_INCOMING = "Data/Tools/Repository/New";
/** Boards + layer folders — vault-root `Data/` (includes `Tools/` for tool data). */
const REPO_DATA = "Data";
const ARCHIVE_FOLDER = "z_archive/Repository";
/** Old Developing folders — notes are migrated into `REPO_INCOMING` and tagged `developing`. */
const LEGACY_DEVELOPING_FOLDERS = [
  "Tools/Developing",
  "Tools/Repository/Developing",
  "Data/Tools/Repository/Developing"
];
/** Notes in `New/` with this tag appear under the Developing subsection (same folder). */
const DEVELOPING_TAG = "developing";
const byDate = (a, b) => (b.file.mtime?.ts || 0) - (a.file.mtime?.ts || 0);

async function ensureFolder(path) {
  const existing = app.vault.getAbstractFileByPath(path);
  if (!existing) await app.vault.createFolder(path);
}

async function moveFile(filePath, destFolder) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || file.extension !== "md") return;
  await ensureFolder(destFolder);
  await app.fileManager.renameFile(file, destFolder + "/" + file.name);
}

async function setDevelopingTagOnFile(file, on) {
  if (!file || file.extension !== "md") return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    let tags = fm.tags;
    if (tags == null) tags = [];
    else if (!Array.isArray(tags)) tags = [tags];
    tags = tags.map(t => String(t).replace(/^#/, ""));
    const norm = (t) => t.toLowerCase();
    const has = tags.some(t => norm(t) === DEVELOPING_TAG);
    if (on) {
      if (!has) tags.push(DEVELOPING_TAG);
    } else {
      tags = tags.filter(t => norm(t) !== DEVELOPING_TAG);
    }
    if (tags.length) fm.tags = tags;
    else delete fm.tags;
  });
}

function walkMdFilesRecursive(folderPath) {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder || !folder.children) return [];
  const out = [];
  for (const c of folder.children) {
    if (c.extension === "md") out.push(c);
    else if (!c.extension && !c.name.startsWith(".")) out.push(...walkMdFilesRecursive(c.path));
  }
  return out;
}

/** One-time per legacy path: move notes from old Developing/ into New/ and tag them `developing`. */
async function migrateDevelopingFoldersIfNeeded() {
  for (const legacyPath of LEGACY_DEVELOPING_FOLDERS) {
    const folder = app.vault.getAbstractFileByPath(legacyPath);
    if (!folder) continue;
    const files = walkMdFilesRecursive(legacyPath);
    if (files.length === 0) continue;
    await ensureFolder(REPO_INCOMING);
    new Notice("Moving " + files.length + " note(s) from " + legacyPath + " into New/…");
    for (const f of files) {
      const destPath = REPO_INCOMING + "/" + f.name;
      if (app.vault.getAbstractFileByPath(destPath)) {
        new Notice("Skipped (name exists in New/): " + f.name);
        continue;
      }
      await moveFile(f.path, REPO_INCOMING);
      const nf = app.vault.getAbstractFileByPath(destPath);
      if (nf) await setDevelopingTagOnFile(nf, true);
    }
  }
}

function pageHasDevelopingTag(p) {
  try {
    const has = (arr) => {
      const list = Array.isArray(arr) ? arr : arr != null ? [arr] : [];
      return list.some(t => String(t).replace(/^#/, "").toLowerCase() === DEVELOPING_TAG);
    };
    if (has(p.tags)) return true;
    if (has(p.file?.tags)) return true;
    if (has(p.file?.etags)) return true;
    const fm = p.file?.frontmatter;
    if (fm && fm.tags != null) return has(fm.tags);
    return false;
  } catch (e) {
    return false;
  }
}

function getPreview(p, maxLen) {
  if (maxLen == null) maxLen = 28;
  try {
    const raw = p.file && p.file.content;
    const first = (typeof raw === "string" ? raw : "").split("\n")[0].trim();
    if (!first) return "—";
    return first.length > maxLen ? first.slice(0, maxLen) + "…" : first;
  } catch (e) { return "—"; }
}

/** Focus for body-appended modals — Obsidian often steals focus back to the editor on the same tick. */
function focusModalTextInput(inputEl) {
  if (!inputEl) return;
  function tryFocus() {
    try {
      inputEl.focus({ preventScroll: true });
    } catch (e) {
      inputEl.focus();
    }
  }
  tryFocus();
  requestAnimationFrame(() => {
    tryFocus();
    if (document.activeElement !== inputEl) {
      setTimeout(tryFocus, 50);
    }
  });
}

function getSelectedPaths(cardsEl) {
  return Array.from(cardsEl.querySelectorAll(".ideas-card-checkbox:checked"))
    .map(cb => cb.dataset.path).filter(Boolean);
}

/** Quick-create a note in a folder (used by top-bar + on New; same behavior as former section +). */
function showNewNoteModalForFolder(folderPath) {
  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal" });
  modal.createEl("h4", { text: "New" });
  const input = modal.createEl("input", { cls: "links-search-input", type: "text", placeholder: "Name..." });
  const btnRow = modal.createEl("div", { cls: "ideas-modal-actions", style: "margin-top:0.75em;display:flex;gap:0.5em" });
  const cancelBtn = btnRow.createEl("button", { cls: "ideas-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { cls: "ideas-btn ideas-btn-final", text: "Create" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  createBtn.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) { new Notice("Enter a name"); return; }
    const safe = (name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled") + ".md";
    const newPath = folderPath + "/" + safe;
    if (app.vault.getAbstractFileByPath(newPath)) { new Notice("Note already exists"); return; }
    await ensureFolder(folderPath);
    await app.vault.create(newPath, "---\n---\n\n");
    overlay.remove();
    new Notice("Created");
    const file = app.vault.getAbstractFileByPath(newPath);
    if (file) await app.workspace.getLeaf().openFile(file);
    location.reload();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") createBtn.click(); });
  focusModalTextInput(input);
}

function createSection(title, folderPath, pages, parentEl, tagAction, sectionOpts) {
  sectionOpts = sectionOpts || {};
  const showAddButton = sectionOpts.showAddButton !== false;
  const block = parentEl.createEl("div", { cls: "ideas-section" });
  const sorted = Array.isArray(pages) ? [...pages].sort(byDate) : [];

  const header = block.createEl("div", { cls: "ideas-section-header" });
  const headerRow = header.createEl("div", { cls: "ideas-section-header-row" });
  headerRow.createEl("h2", { cls: "ideas-section-title", text: title });
  const badge = headerRow.createEl("span", { cls: "ideas-section-badge" });
  badge.textContent = String(sorted.length);
  const headerActions = headerRow.createEl("div", { cls: "ideas-section-actions" });

  const selectAll = headerActions.createEl("input", { type: "checkbox", cls: "ideas-select-all", title: "Select all" });
  let addBtn = null;
  if (showAddButton) {
    addBtn = headerActions.createEl("button", { type: "button", text: "+", cls: "ideas-btn ideas-btn-final ideas-add-btn" });
    addBtn.addEventListener("click", () => showNewNoteModalForFolder(folderPath));
  }
  const moveBtn = headerActions.createEl("button", { type: "button", text: "Move", cls: "ideas-btn ideas-btn-link" });
  const archiveBtn = headerActions.createEl("button", { type: "button", text: "Archive", cls: "ideas-btn ideas-btn-archive" });
  let markBtn = null;
  if (tagAction === "mark-developing") {
    markBtn = headerActions.createEl("button", { type: "button", text: "Developing", cls: "ideas-btn ideas-btn-link", title: "Tag selected notes as developing (same folder)" });
  } else if (tagAction === "mark-new") {
    markBtn = headerActions.createEl("button", { type: "button", text: "As new", cls: "ideas-btn ideas-btn-link", title: "Remove developing tag" });
  }

  const cards = block.createEl("div", { cls: "ideas-cards" });

  function updateButtons() {
    const count = getSelectedPaths(cards).length;
    const disabled = count === 0;
    moveBtn.disabled = disabled;
    archiveBtn.disabled = disabled;
    moveBtn.classList.toggle("disabled", disabled);
    archiveBtn.classList.toggle("disabled", disabled);
    if (markBtn) {
      markBtn.disabled = disabled;
      markBtn.classList.toggle("disabled", disabled);
    }
  }

  moveBtn.addEventListener("click", () => {
    const paths = getSelectedPaths(cards);
    if (paths.length === 0) { new Notice("Select items first"); return; }
    showMoveToBoardModal(paths, () => {
      for (const p of paths) {
        const card = cards.querySelector(`.ideas-card-checkbox[data-path="${p}"]`)?.closest(".ideas-card");
        if (card) card.remove();
      }
      badge.textContent = String(cards.querySelectorAll(".ideas-card").length);
    });
  });

  archiveBtn.addEventListener("click", async () => {
    const paths = getSelectedPaths(cards);
    if (paths.length === 0) { new Notice("Select items first"); return; }
    await ensureFolder(ARCHIVE_FOLDER);
    for (const path of paths) await moveFile(path, ARCHIVE_FOLDER);
    for (const path of paths) {
      const card = cards.querySelector(`.ideas-card-checkbox[data-path="${path}"]`)?.closest(".ideas-card");
      if (card) card.remove();
    }
    badge.textContent = String(cards.querySelectorAll(".ideas-card").length);
  });

  if (markBtn && tagAction === "mark-developing") {
    markBtn.addEventListener("click", async () => {
      const paths = getSelectedPaths(cards);
      if (paths.length === 0) { new Notice("Select items first"); return; }
      for (const path of paths) {
        const f = app.vault.getAbstractFileByPath(path);
        if (f) await setDevelopingTagOnFile(f, true);
      }
      new Notice("Marked as developing");
      location.reload();
    });
  }
  if (markBtn && tagAction === "mark-new") {
    markBtn.addEventListener("click", async () => {
      const paths = getSelectedPaths(cards);
      if (paths.length === 0) { new Notice("Select items first"); return; }
      for (const path of paths) {
        const f = app.vault.getAbstractFileByPath(path);
        if (f) await setDevelopingTagOnFile(f, false);
      }
      new Notice("Marked as new");
      location.reload();
    });
  }

  if (sorted.length > 0) {
    for (const p of sorted) {
      const card = cards.createEl("div", { cls: "ideas-card" });
      const cb = card.createEl("input", { type: "checkbox", cls: "ideas-card-checkbox" });
      cb.dataset.path = p.file.path;
      cb.addEventListener("change", updateButtons);
      const titleDiv = card.createEl("div", { cls: "ideas-card-title" });
      const link = titleDiv.createEl("a", { href: p.file.path, text: (p.file.name || "").replace(/\.md$/, ""), cls: "internal-link" });
      link.setAttribute("data-href", p.file.path);
      card.createEl("div", { cls: "ideas-card-preview", text: getPreview(p) });
    }
    selectAll.addEventListener("change", () => {
      cards.querySelectorAll(".ideas-card-checkbox").forEach(cb => { cb.checked = selectAll.checked; });
      updateButtons();
    });
  }
  updateButtons();
}

await ensureFolder(REPO_INCOMING);
await ensureFolder(REPO_DATA);
await migrateDevelopingFoldersIfNeeded();

// --- Three-layer navigation under vault Data/ (boards live here; tool is Tools/Repository.md) ---

const REPO_SESSION_KEY = "repo-dashboard-session";

let breadcrumbPath = [];
let boardEditMode = false;
/** After tile properties save, re-select this tile key on next board render */
let pendingBoardSelectTileKey = null;
/** Browser-style navigation: each entry is { view: "new-dev"|"repository", breadcrumb: string[] } */
let navHistory = [{ view: "new-dev", breadcrumb: [] }];
let navHistoryIndex = 0;
let viewNewDev = null;
let viewRepository = null;

/** Obsidian vault paths use `/`; normalize for Windows/Proton Drive. */
function normalizeVaultPath(path) {
  if (!path || typeof path !== "string") return path;
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Subfolders for navigation. Under `Data/`, list every top-level folder (including `Tools`).
 */
function getSubfolders(folderPath) {
  const norm = normalizeVaultPath(folderPath);
  const folder = app.vault.getAbstractFileByPath(norm);
  if (!folder || !folder.children) return [];
  const children = folder.children.filter(c => !c.extension && !c.name.startsWith("."));
  return children.sort((a, b) => a.name.localeCompare(b.name));
}

const BOARD_CONFIG_FILE = "_board.md";

/** Parse `key:\n  - a\n  - b` blocks from board YAML (supports tiles + legacy groups). */
function parseYamlDashList(yaml, key) {
  const re = new RegExp("^" + key + ":\\s*\\n((?:\\s+-\\s+.+\n?)*)", "m");
  const m = yaml.match(re);
  if (!m) return [];
  return m[1].split("\n").map(l => l.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean);
}

function isBoardPdfFile(file) {
  return file && String(file.extension || "").toLowerCase() === "pdf";
}

/** Display stem for markdown or PDF rows on boards (strip .md / .pdf). */
function displayStemForBoardFile(file) {
  return (file.name || "").replace(/\.(md|pdf)$/i, "");
}

/** Open in the active leaf only (avoids Obsidian’s default PDF behavior of opening in a split). */
async function openVaultFileInActiveLeaf(filePath) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return;
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
}

function getBoardRootFiles(folderPath) {
  const folder = app.vault.getAbstractFileByPath(normalizeVaultPath(folderPath));
  if (!folder || !folder.children) return [];
  return folder.children
    .filter((c) => {
      const ext = String(c.extension || "").toLowerCase();
      if (ext === "md") return c.name !== BOARD_CONFIG_FILE;
      if (ext === "pdf") return true;
      return false;
    })
    .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
}

/** Markdown + PDF under a folder tree (for boards); excludes `_board.md`. */
function walkBoardAssetFilesRecursive(folderPath) {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder || !folder.children) return [];
  const out = [];
  for (const c of folder.children) {
    const ext = String(c.extension || "").toLowerCase();
    if (ext === "md" && c.name !== BOARD_CONFIG_FILE) out.push(c);
    else if (ext === "pdf") out.push(c);
    else if (!c.extension && !c.name.startsWith(".")) out.push(...walkBoardAssetFilesRecursive(c.path));
  }
  return out;
}

/** Path of a file relative to the board folder (e.g. `Note.md` or `Folder/a.md`). */
function relPathFromBoardRoot(folderPath, filePath) {
  const norm = normalizeVaultPath(folderPath).replace(/\/$/, "");
  if (!filePath || !filePath.startsWith(norm + "/")) return "";
  return filePath.slice(norm.length + 1);
}

/**
 * Work Repository — board subfolders that contain at least one .md (recursive) become automatic group tiles.
 */
function listAutoFolderTileNames(folderPath) {
  const norm = normalizeVaultPath(folderPath);
  const subs = getSubfolders(norm);
  const names = [];
  for (const sub of subs) {
    const assets = walkBoardAssetFilesRecursive(sub.path);
    if (assets.length > 0) names.push(sub.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/** Root-level .md/.pdf plus every .md/.pdf under direct subfolders of the board (recursive). */
function collectBoardMarkdownFiles(folderPath) {
  const rootFiles = getBoardRootFiles(folderPath);
  const norm = normalizeVaultPath(folderPath);
  const subs = getSubfolders(norm);
  const nestedFiles = [];
  const seen = new Set(rootFiles.map((f) => f.path));
  for (const sub of subs) {
    for (const f of walkBoardAssetFilesRecursive(sub.path)) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        nestedFiles.push(f);
      }
    }
  }
  return { rootFiles, nestedFiles, allFiles: rootFiles.concat(nestedFiles) };
}

function effectiveBoardTileForFile(filePath, folderPath) {
  const rel = relPathFromBoardRoot(folderPath, filePath);
  if (rel && rel.includes("/")) {
    return rel.split("/")[0];
  }
  return getFileTile(filePath) || null;
}

function parseTileConfigYaml(yaml) {
  const tileConfig = {};
  const block = yaml.match(/tileConfig:\s*\n([\s\S]*)/);
  if (!block) return tileConfig;
  for (const line of block[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:"([^"]*)"|([^:]+)):\s*\{\s*kind:\s*(group|note)(?:,\s*file:\s*"((?:[^"\\]|\\.)*)")?\s*\}/);
    if (m) {
      const key = (m[1] !== undefined && m[1] !== "") ? m[1] : m[2];
      const kind = m[3];
      const f = m[4] || null;
      if (kind === "note" && f) tileConfig[key] = { kind: "note", file: f };
      else tileConfig[key] = { kind: "group" };
    }
  }
  return tileConfig;
}

/** JSON in frontmatter: tilePropsJSON: "{...}" (double-encoded) or raw JSON object */
function parseTilePropsFromYaml(yaml) {
  if (!yaml || typeof yaml !== "string") return {};
  const m = yaml.match(/^\s*tilePropsJSON:\s*(.+)$/m);
  if (!m) return {};
  const raw = m[1].trim();
  try {
    const step = JSON.parse(raw);
    if (typeof step === "string") return JSON.parse(step);
    return step && typeof step === "object" ? step : {};
  } catch (e) {
    return {};
  }
}

function relToFolder(folderPath, filePath) {
  if (!filePath) return "";
  const norm = folderPath.replace(/\/$/, "");
  return filePath.startsWith(norm + "/") ? filePath.slice(norm.length + 1) : filePath;
}

function hexToRgb(hex) {
  const h = String(hex || "").replace(/^#/, "");
  if (h.length !== 6) return { r: 48, g: 48, b: 58 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h *= 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function openTilePropertiesModal(opts) {
  const {
    folderPath,
    tileKey,
    tileName,
    isNoteTile,
    allMemberFiles,
    tilePropsRef,
    tilesList,
    tileConfigSnapshot,
    getSizes,
    onDone,
    autoFolderTileNames
  } = opts;
  const defaults = {
    bg: "", textColor: "", borderColor: "",
    borderWidth: "",
    textScale: 1,
    noteTextScale: 1,
    titleFontWeight: "",
    titleFontStyle: "",
    titleLetterSpacing: "",
    noteBg: "", noteText: "", noteBorderColor: "",
    imageScale: 1, linkMode: "all", linkPaths: []
  };
  const cur = { ...defaults, ...(tilePropsRef[tileKey] || {}) };
  if (!Array.isArray(cur.linkPaths)) cur.linkPaths = [];
  if (cur.noteTextScale == null || cur.noteTextScale === undefined) {
    cur.noteTextScale = typeof cur.textScale === "number" ? cur.textScale : parseFloat(cur.textScale) || 1;
  }

  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-tile-props-modal" });
  const scrollBody = modal.createEl("div", { cls: "repo-tile-props-body" });
  const headerRow = scrollBody.createEl("div", { cls: "repo-tile-props-header-row" });
  headerRow.createEl("h4", { cls: "repo-tile-props-title", text: "Tile: " + (tileName === "__ungrouped__" ? "Ungrouped" : tileName) });
  const restoreDefaultsBtn = headerRow.createEl("button", {
    type: "button",
    cls: "ideas-btn ideas-btn-link repo-tile-props-restore-header",
    text: "Restore to default",
    attr: { title: "Reset the current section (Tile or Content) to defaults" }
  });

  const scopeRow = scrollBody.createEl("div", { cls: "repo-tile-props-scope-row" });
  scopeRow.createEl("span", { cls: "repo-tile-props-label", text: "Edit" });
  const btnTileScope = scopeRow.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link repo-tile-props-scope-btn", text: "Tile" });
  const btnContentScope = scopeRow.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link repo-tile-props-scope-btn", text: "Content" });
  let scope = "tile";

  const colorSection = scrollBody.createEl("div", { cls: "repo-tile-props-section repo-tile-props-color" });
  const colorLabel = colorSection.createEl("div", { cls: "repo-tile-props-label", text: "Colors" });
  const tileColorDefs = [
    { key: "bg", label: "Background" },
    { key: "borderColor", label: "Border" },
    { key: "textColor", label: "Text" }
  ];
  const contentColorDefs = [
    { key: "noteBg", label: "Background" },
    { key: "noteBorderColor", label: "Border" },
    { key: "noteText", label: "Text" }
  ];
  let activeColorKey = "bg";
  const tabButtons = [];
  let pickerH = 0;
  let pickerS = 0;
  let pickerV = 0.5;

  const tabRow = colorSection.createEl("div", { cls: "repo-tile-props-color-tabs" });

  function clearTabRow() {
    while (tabRow.firstChild) tabRow.removeChild(tabRow.firstChild);
    tabButtons.length = 0;
  }

  function buildColorTabs() {
    clearTabRow();
    const defs = scope === "tile" ? tileColorDefs : contentColorDefs;
    if (!defs.some((d) => d.key === activeColorKey)) activeColorKey = defs[0].key;
    for (const def of defs) {
      const b = tabRow.createEl("button", {
        type: "button",
        cls: "repo-tile-props-color-tab" + (def.key === activeColorKey ? " repo-tile-props-color-tab-active" : ""),
        text: def.label
      });
      b.dataset.colorKey = def.key;
      tabButtons.push(b);
      b.addEventListener("click", () => setActiveTab(def.key));
    }
    loadActiveIntoPicker();
  }

  const pickerWrap = colorSection.createEl("div", { cls: "repo-tile-props-picker-wrap" });
  const svBox = pickerWrap.createEl("div", { cls: "repo-tile-props-sv" });
  const svInner = svBox.createEl("div", { cls: "repo-tile-props-sv-inner" });
  const svHandle = svBox.createEl("div", { cls: "repo-tile-props-sv-handle" });
  const hueTrack = pickerWrap.createEl("div", { cls: "repo-tile-props-hue" });
  const hueHandle = hueTrack.createEl("div", { cls: "repo-tile-props-hue-handle" });

  const hexRow = colorSection.createEl("div", { cls: "repo-tile-props-hex-row" });
  hexRow.createEl("span", { cls: "repo-tile-props-hex-label", text: "Hex" });
  const hexInput = hexRow.createEl("input", {
    type: "text",
    cls: "repo-tile-props-hex-input",
    attr: { spellcheck: "false", autocomplete: "off", placeholder: "#RRGGBB" }
  });

  function readHsvFromCur(key) {
    const hx = cur[key];
    if (!hx || typeof hx !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(hx.trim())) {
      const rgb = hexToRgb("");
      return rgbToHsv(rgb.r, rgb.g, rgb.b);
    }
    const norm = hx.trim().startsWith("#") ? hx.trim() : "#" + hx.trim();
    const rgb = hexToRgb(norm);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  }

  function applyHsvToCur() {
    const rgb = hsvToRgb(pickerH, pickerS, pickerV);
    cur[activeColorKey] = rgbToHex(rgb.r, rgb.g, rgb.b);
    hexInput.value = cur[activeColorKey];
    updatePickerVisuals();
  }

  function updatePickerVisuals() {
    const pure = hsvToRgb(pickerH, 1, 1);
    const pureHex = rgbToHex(pure.r, pure.g, pure.b);
    svInner.style.setProperty("--repo-sv-hue", pureHex);
    svHandle.style.left = pickerS * 100 + "%";
    svHandle.style.top = (1 - pickerV) * 100 + "%";
    hueHandle.style.top = (pickerH / 360) * 100 + "%";
  }

  function loadActiveIntoPicker() {
    const { h, s, v } = readHsvFromCur(activeColorKey);
    pickerH = h;
    pickerS = s;
    pickerV = v;
    hexInput.value = cur[activeColorKey] || "";
    updatePickerVisuals();
  }

  function setActiveTab(key) {
    activeColorKey = key;
    tabButtons.forEach((tb) => {
      tb.classList.toggle("repo-tile-props-color-tab-active", tb.dataset.colorKey === key);
    });
    loadActiveIntoPicker();
  }

  const tileExtras = scrollBody.createEl("div", { cls: "repo-tile-props-tile-extras repo-tile-props-section" });
  tileExtras.createEl("div", { cls: "repo-tile-props-panel-title", text: "Tile" });
  tileExtras.createEl("div", { cls: "repo-tile-props-label", text: "Border width" });
  const borderWRow = tileExtras.createEl("div", { cls: "repo-tile-props-slider-row" });
  const bw = cur.borderWidth !== "" && cur.borderWidth != null ? parseFloat(cur.borderWidth) : 1;
  const borderWidthRange = borderWRow.createEl("input", { type: "range", cls: "repo-tile-props-range-wide", attr: { min: "1", max: "8", step: "1", value: String(!isNaN(bw) ? bw : 1) } });
  const borderWVal = borderWRow.createEl("span", { cls: "repo-tile-props-val", text: String(!isNaN(bw) ? bw : 1) + "px" });
  borderWidthRange.addEventListener("input", () => {
    const v = parseInt(borderWidthRange.value, 10);
    borderWVal.textContent = v + "px";
    cur.borderWidth = v === 1 ? "" : v;
  });

  tileExtras.createEl("div", { cls: "repo-tile-props-label", text: "Title size" });
  const titleScaleRow = tileExtras.createEl("div", { cls: "repo-tile-props-slider-row" });
  const titleScaleRange = titleScaleRow.createEl("input", { type: "range", cls: "repo-tile-props-range-wide", attr: { min: "0.45", max: "2.1", step: "0.03", value: String(cur.textScale) } });
  const titleScaleVal = titleScaleRow.createEl("span", { cls: "repo-tile-props-val", text: Number(cur.textScale).toFixed(2) });
  titleScaleRange.addEventListener("input", () => {
    cur.textScale = parseFloat(titleScaleRange.value);
    titleScaleVal.textContent = cur.textScale.toFixed(2);
  });

  tileExtras.createEl("div", { cls: "repo-tile-props-label", text: "Font weight" });
  const weightSel = tileExtras.createEl("select", { cls: "repo-tile-props-select repo-tile-props-fullwidth" });
  [["", "Default (600)"], ["400", "Normal"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"]].forEach(([val, lab]) => {
    const o = weightSel.createEl("option", { text: lab, value: val });
    if (String(cur.titleFontWeight || "") === val) o.selected = true;
  });
  weightSel.addEventListener("change", () => { cur.titleFontWeight = weightSel.value || ""; });

  tileExtras.createEl("div", { cls: "repo-tile-props-label", text: "Font style" });
  const styleSel = tileExtras.createEl("select", { cls: "repo-tile-props-select repo-tile-props-fullwidth" });
  [["", "Default"], ["normal", "Normal"], ["italic", "Italic"]].forEach(([val, lab]) => {
    const o = styleSel.createEl("option", { text: lab, value: val });
    if (String(cur.titleFontStyle || "") === val) o.selected = true;
  });
  styleSel.addEventListener("change", () => { cur.titleFontStyle = styleSel.value || ""; });

  tileExtras.createEl("div", { cls: "repo-tile-props-label", text: "Letter spacing" });
  const trackRow = tileExtras.createEl("div", { cls: "repo-tile-props-slider-row" });
  const trk = cur.titleLetterSpacing !== "" && cur.titleLetterSpacing != null ? parseFloat(String(cur.titleLetterSpacing).replace(/em$/, "")) : 0;
  const trackRange = trackRow.createEl("input", { type: "range", cls: "repo-tile-props-range-wide", attr: { min: "-0.08", max: "0.16", step: "0.005", value: String(!isNaN(trk) ? trk : 0) } });
  const trackVal = trackRow.createEl("span", { cls: "repo-tile-props-val", text: (!isNaN(trk) ? trk : 0).toFixed(3) + "em" });
  trackRange.addEventListener("input", () => {
    const v = parseFloat(trackRange.value);
    trackVal.textContent = v.toFixed(3) + "em";
    cur.titleLetterSpacing = Math.abs(v) < 0.0001 ? "" : v.toFixed(3) + "em";
  });

  const contentExtras = scrollBody.createEl("div", { cls: "repo-tile-props-content-extras repo-tile-props-section" });
  contentExtras.createEl("div", { cls: "repo-tile-props-panel-title", text: "Content" });
  contentExtras.createEl("div", { cls: "repo-tile-props-label", text: "Text size" });
  const noteScaleRow = contentExtras.createEl("div", { cls: "repo-tile-props-slider-row" });
  const noteScaleRange = noteScaleRow.createEl("input", { type: "range", cls: "repo-tile-props-range-wide", attr: { min: "0.45", max: "2.1", step: "0.03", value: String(cur.noteTextScale) } });
  const noteScaleVal = noteScaleRow.createEl("span", { cls: "repo-tile-props-val", text: Number(cur.noteTextScale).toFixed(2) });
  noteScaleRange.addEventListener("input", () => {
    cur.noteTextScale = parseFloat(noteScaleRange.value);
    noteScaleVal.textContent = cur.noteTextScale.toFixed(2);
  });

  function setScope(s) {
    scope = s;
    btnTileScope.classList.toggle("active", scope === "tile");
    btnContentScope.classList.toggle("active", scope === "content");
    colorLabel.textContent = "Colors";
    tileExtras.style.display = scope === "tile" ? "" : "none";
    contentExtras.style.display = scope === "content" ? "" : "none";
    buildColorTabs();
  }
  btnTileScope.addEventListener("click", () => setScope("tile"));
  btnContentScope.addEventListener("click", () => setScope("content"));
  btnTileScope.classList.add("active");

  function parseHexInput(str) {
    const t = String(str || "").trim();
    if (!t) {
      cur[activeColorKey] = "";
      loadActiveIntoPicker();
      return;
    }
    const m = t.match(/^#?([0-9a-fA-F]{6})$/);
    if (m) {
      cur[activeColorKey] = "#" + m[1].toLowerCase();
      const { h, s, v } = readHsvFromCur(activeColorKey);
      pickerH = h;
      pickerS = s;
      pickerV = v;
      hexInput.value = cur[activeColorKey];
      updatePickerVisuals();
    } else {
      hexInput.value = cur[activeColorKey] || "";
    }
  }

  hexInput.addEventListener("change", () => parseHexInput(hexInput.value));
  hexInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      parseHexInput(hexInput.value);
      hexInput.blur();
    }
  });

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function setSvFromClient(clientX, clientY) {
    const rect = svBox.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pickerS = clamp01((clientX - rect.left) / rect.width);
    pickerV = clamp01(1 - (clientY - rect.top) / rect.height);
    applyHsvToCur();
  }

  function setHueFromClient(clientY) {
    const rect = hueTrack.getBoundingClientRect();
    if (rect.height <= 0) return;
    pickerH = clamp01((clientY - rect.top) / rect.height) * 360;
    applyHsvToCur();
  }

  let draggingSv = false;
  let draggingHue = false;
  svBox.addEventListener("mousedown", (e) => {
    e.preventDefault();
    draggingSv = true;
    setSvFromClient(e.clientX, e.clientY);
  });
  hueTrack.addEventListener("mousedown", (e) => {
    e.preventDefault();
    draggingHue = true;
    setHueFromClient(e.clientY);
  });
  document.addEventListener("mousemove", (e) => {
    if (draggingSv) setSvFromClient(e.clientX, e.clientY);
    if (draggingHue) setHueFromClient(e.clientY);
  });
  document.addEventListener("mouseup", () => {
    draggingSv = false;
    draggingHue = false;
  });

  setScope("tile");

  let imgRange = null;
  let imgVal = null;
  if (isNoteTile) {
    const imgSec = contentExtras.createEl("div", { cls: "repo-tile-props-section" });
    imgSec.createEl("div", { cls: "repo-tile-props-label", text: "Image size" });
    const imgRow = imgSec.createEl("div", { cls: "repo-tile-props-slider-row" });
    imgRange = imgRow.createEl("input", { type: "range", cls: "repo-tile-props-range-wide", attr: { min: "0.35", max: "2.2", step: "0.05", value: String(cur.imageScale) } });
    imgVal = imgRow.createEl("span", { cls: "repo-tile-props-val", text: Number(cur.imageScale).toFixed(2) });
    imgRange.addEventListener("input", () => {
      cur.imageScale = parseFloat(imgRange.value);
      imgVal.textContent = cur.imageScale.toFixed(2);
    });
  }

  if (!isNoteTile && allMemberFiles.length > 0) {
    const linkSec = contentExtras.createEl("div", { cls: "repo-tile-props-section" });
    linkSec.createEl("div", { cls: "repo-tile-props-label", text: "Notes shown in this tile" });
    const modeRow = linkSec.createEl("div", { cls: "repo-tile-props-mode-row" });
    const allId = "repo-tile-link-all-" + tileKey.replace(/\W/g, "_");
    const pickId = "repo-tile-link-pick-" + tileKey.replace(/\W/g, "_");
    const rAll = modeRow.createEl("label", { cls: "repo-tile-props-radio" });
    const inAll = rAll.createEl("input", { type: "radio", attr: { name: "linkMode", value: "all", id: allId } });
    rAll.createEl("span", { text: " Show all notes in this tile" });
    const rPick = modeRow.createEl("label", { cls: "repo-tile-props-radio" });
    const inPick = rPick.createEl("input", { type: "radio", attr: { name: "linkMode", value: "pick", id: pickId } });
    rPick.createEl("span", { text: " Choose which notes to show" });
    if (cur.linkMode === "pick") inPick.checked = true;
    else inAll.checked = true;

    const listWrap = linkSec.createEl("div", { cls: "repo-tile-props-link-list" });
    const relSet = new Set(cur.linkPaths);
    const checkboxes = [];
    for (const f of allMemberFiles) {
      const rel = relToFolder(folderPath, f.path);
      const row = listWrap.createEl("label", { cls: "repo-tile-props-link-row" });
      const cb = row.createEl("input", { type: "checkbox", attr: { value: rel } });
      cb.checked = cur.linkMode === "all" || relSet.has(rel);
      checkboxes.push({ cb, rel });
      const nm = row.createEl("span", { cls: "repo-tile-props-link-name" });
      nm.appendText(displayStemForBoardFile(f));
      if (isBoardPdfFile(f)) nm.appendChild(nm.ownerDocument.createElement("span")).classList.add("repo-board-file-kind"); /* patched below */
    }
    const selAllBtn = linkSec.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link repo-tile-props-selall", text: "Select all" });
    selAllBtn.addEventListener("click", () => {
      checkboxes.forEach(({ cb }) => { cb.checked = true; });
      inPick.checked = true;
    });
    inAll.addEventListener("change", () => {
      if (inAll.checked) checkboxes.forEach(({ cb }) => { cb.checked = true; });
    });
  }

  function applyScopeDefaults() {
    if (scope === "tile") {
      cur.bg = "";
      cur.borderColor = "";
      cur.textColor = "";
      cur.borderWidth = "";
      cur.textScale = 1;
      cur.titleFontWeight = "";
      cur.titleFontStyle = "";
      cur.titleLetterSpacing = "";
      borderWidthRange.value = "1";
      borderWVal.textContent = "1px";
      titleScaleRange.value = "1";
      titleScaleVal.textContent = "1.00";
      weightSel.value = "";
      styleSel.value = "";
      trackRange.value = "0";
      trackVal.textContent = "0.000em";
    } else {
      cur.noteBg = "";
      cur.noteText = "";
      cur.noteBorderColor = "";
      cur.noteTextScale = 1;
      noteScaleRange.value = "1";
      noteScaleVal.textContent = "1.00";
      if (imgRange && imgVal) {
        cur.imageScale = 1;
        imgRange.value = "1";
        imgVal.textContent = "1.00";
      }
    }
    loadActiveIntoPicker();
  }
  restoreDefaultsBtn.addEventListener("click", () => applyScopeDefaults());

  const actions = modal.createEl("div", { cls: "ideas-modal-actions repo-tile-props-actions" });
  const saveBtn = actions.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-final", text: "Save" });
  const cancelBtn = actions.createEl("button", { type: "button", cls: "ideas-btn", text: "Cancel" });
  const deleteBtn = actions.createEl("button", {
    type: "button",
    cls: "ideas-btn ideas-btn-archive repo-tile-props-delete",
    text: "Delete",
    attr: { title: tileKey === "__ungrouped__" ? "The Ungrouped tile can’t be removed from the board." : "Remove this tile from the board" }
  });
  if (tileKey === "__ungrouped__") deleteBtn.disabled = true;
  const autoNames = Array.isArray(autoFolderTileNames) ? autoFolderTileNames : [];
  if (autoNames.some((n) => String(n).toLowerCase() === String(tileKey).toLowerCase())) {
    deleteBtn.disabled = true;
    deleteBtn.title = "This tile comes from a folder inside the board. Remove or empty the folder to drop it.";
  }

  cancelBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  deleteBtn.addEventListener("click", async () => {
    if (tileKey === "__ungrouped__") {
      new Notice("The Ungrouped tile can’t be removed from the board.");
      return;
    }
    const ok = confirm(
      "Remove this tile from the board?\n\nNotes stay in the vault; their tile assignment is unchanged until you edit each note."
    );
    if (!ok) return;

    const idx = tilesList.indexOf(tileKey);
    if (idx >= 0) tilesList.splice(idx, 1);
    delete tilePropsRef[tileKey];
    delete tileConfigSnapshot[tileKey];
    const sizes = { ...getSizes() };
    delete sizes[tileKey];
    try {
      const layoutKey = "repo-board-layout:" + folderPath;
      const raw = localStorage.getItem(layoutKey);
      if (raw) {
        const dirty = JSON.parse(raw);
        if (dirty && dirty[tileKey]) {
          delete dirty[tileKey];
          localStorage.setItem(layoutKey, JSON.stringify(dirty));
        }
      }
    } catch (e) {}

    await saveBoardConfig(folderPath, {
      tiles: tilesList.slice(),
      sizes,
      tileConfig: tileConfigSnapshot,
      tileProps: tilePropsRef
    });
    overlay.remove();
    new Notice("Tile removed from board");
    if (typeof onDone === "function") onDone("delete");
  });

  saveBtn.addEventListener("click", async () => {
    const bw = parseInt(borderWidthRange.value, 10);
    const out = {
      bg: cur.bg || "",
      textColor: cur.textColor || "",
      borderColor: cur.borderColor || "",
      borderWidth: !bw || bw === 1 ? "" : bw,
      noteBg: cur.noteBg || "",
      noteText: cur.noteText || "",
      noteBorderColor: cur.noteBorderColor || "",
      textScale: parseFloat(titleScaleRange.value) || 1,
      noteTextScale: parseFloat(noteScaleRange.value) || 1,
      titleFontWeight: cur.titleFontWeight || "",
      titleFontStyle: cur.titleFontStyle || "",
      titleLetterSpacing: cur.titleLetterSpacing || "",
      imageScale: imgRange ? parseFloat(imgRange.value) || 1 : 1,
      linkMode: "all",
      linkPaths: []
    };
    if (!isNoteTile && allMemberFiles.length > 0) {
      const pick = modal.querySelector("input[name=linkMode][value=pick]");
      out.linkMode = pick && pick.checked ? "pick" : "all";
      if (out.linkMode === "pick") {
        modal.querySelectorAll(".repo-tile-props-link-list input[type=checkbox]").forEach((cb) => {
          if (cb.checked && cb.value) out.linkPaths.push(cb.value);
        });
      }
    }
    const empty =
      !out.bg && !out.textColor && !out.borderColor && !out.noteBg && !out.noteText && !out.noteBorderColor &&
      !out.borderWidth &&
      Math.abs(out.textScale - 1) < 0.001 &&
      Math.abs(out.noteTextScale - 1) < 0.001 &&
      !out.titleFontWeight && !out.titleFontStyle && !out.titleLetterSpacing &&
      Math.abs(out.imageScale - 1) < 0.001 &&
      out.linkMode === "all";
    if (empty) delete tilePropsRef[tileKey];
    else tilePropsRef[tileKey] = out;

    await saveBoardConfig(folderPath, {
      tiles: tilesList,
      sizes: getSizes(),
      tileConfig: tileConfigSnapshot,
      tileProps: tilePropsRef
    });
    overlay.remove();
    new Notice("Tile properties saved");
    if (typeof onDone === "function") onDone("save");
  });
}

async function getBoardConfig(folderPath) {
  const configPath = folderPath + "/" + BOARD_CONFIG_FILE;
  const file = app.vault.getAbstractFileByPath(configPath);
  const tiles = [];
  const sizes = {};
  const tileConfig = {};
  if (!file) return { tiles, sizes, tileConfig, tileProps: {} };
  try {
    const content = await app.vault.read(file);
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return { tiles, sizes, tileConfig, tileProps: {} };
    const yaml = match[1];
    let list = parseYamlDashList(yaml, "tiles");
    if (list.length === 0) list = parseYamlDashList(yaml, "groups");
    tiles.push(...list);
    const sizesBlock = yaml.match(/sizes:\s*\n([\s\S]*?)(?=\n\w|$)/);
    if (sizesBlock) {
      for (const line of sizesBlock[1].split("\n")) {
        const m = line.match(/(?:"([^"]*)"|([^\s:]+)):\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)(?:,\s*x:\s*(\d+),\s*y:\s*(\d+))?\s\}/);
        if (m) {
          const key = m[1] !== undefined ? m[1] : m[2];
          sizes[key] = { w: parseInt(m[3], 10), h: parseInt(m[4], 10) };
          if (m[5] != null) sizes[key].x = parseInt(m[5], 10);
          if (m[6] != null) sizes[key].y = parseInt(m[6], 10);
        }
      }
    }
    Object.assign(tileConfig, parseTileConfigYaml(yaml));
    const tileProps = parseTilePropsFromYaml(yaml);
    return { tiles, sizes, tileConfig, tileProps };
  } catch (e) {}
  return { tiles, sizes, tileConfig, tileProps: {} };
}

async function saveBoardConfig(folderPath, { tiles, sizes, tileConfig, tileProps }) {
  const configPath = folderPath + "/" + BOARD_CONFIG_FILE;
  const prev = await getBoardConfig(folderPath);
  const tList = tiles !== undefined ? tiles : prev.tiles;
  const sz = sizes !== undefined ? sizes : prev.sizes;
  const tc = tileConfig !== undefined ? tileConfig : (prev.tileConfig || {});
  const tp = tileProps !== undefined ? tileProps : (prev.tileProps || {});
  let yaml = "tiles:\n" + (tList || []).map(t => "  - " + t).join("\n") + "\n";
  if (sz && Object.keys(sz).length > 0) {
    yaml += "sizes:\n";
    for (const [name, s] of Object.entries(sz)) {
      const key = /[\s:]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
      const xy = (s.x != null && s.y != null) ? `, x: ${s.x}, y: ${s.y}` : "";
      yaml += `  ${key}: { w: ${s.w}, h: ${s.h}${xy} }\n`;
    }
  }
  if (tc && Object.keys(tc).length > 0) {
    yaml += "tileConfig:\n";
    for (const [name, conf] of Object.entries(tc)) {
      const key = /[\s:]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
      if (conf && conf.kind === "note" && conf.file) {
        const f = String(conf.file).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        yaml += `  ${key}: { kind: note, file: "${f}" }\n`;
      } else {
        yaml += `  ${key}: { kind: group }\n`;
      }
    }
  }
  if (tp && Object.keys(tp).length > 0) {
    yaml += "tilePropsJSON: " + JSON.stringify(JSON.stringify(tp)) + "\n";
  }
  const content = "---\n" + yaml + "---\n";
  const file = app.vault.getAbstractFileByPath(configPath);
  if (file) await app.vault.modify(file, content);
  else await app.vault.create(configPath, content);
}

async function getBoardTiles(folderPath) {
  const { tiles } = await getBoardConfig(folderPath);
  return tiles;
}

async function saveBoardTiles(folderPath, tiles) {
  const cfg = await getBoardConfig(folderPath);
  await saveBoardConfig(folderPath, { tiles, sizes: cfg.sizes, tileConfig: cfg.tileConfig || {}, tileProps: cfg.tileProps || {} });
}

/** Which board tile a note belongs to (`tile` in frontmatter; legacy `group` still read). */
function getFileTile(filePath) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== "md") return null;
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (fm && (fm.tile !== undefined || fm.group !== undefined)) {
      const t = String(fm.tile ?? fm.group ?? "").trim();
      return t || null;
    }
    const p = dv.page(filePath);
    const t = (p?.tile ?? p?.group ?? "").trim();
    return t || null;
  } catch (e) { return null; }
}

/**
 * Match note to a board tile. Root notes use `tile` frontmatter; notes inside a board subfolder
 * belong to the auto tile named after that folder (Work Repository).
 * Optional `filePath` + `folderPath` enable subfolder grouping.
 */
function tileNameMatchesBoard(assignedTile, tileNameFromBoard, filePath, folderPath) {
  const UNGROUPED = "__ungrouped__";
  if (folderPath && filePath) {
    const rel = relPathFromBoardRoot(folderPath, filePath);
    if (rel && rel.includes("/")) {
      const firstSeg = rel.split("/")[0];
      if (tileNameFromBoard === UNGROUPED) return false;
      return firstSeg.toLowerCase() === String(tileNameFromBoard).toLowerCase();
    }
  }
  const a = (assignedTile || "").trim();
  const t = tileNameFromBoard;
  if (t === UNGROUPED) {
    return !a || a === UNGROUPED;
  }
  if (!a || a === UNGROUPED) return false;
  return a.toLowerCase() === String(t).toLowerCase();
}

async function setFileTileByFile(file, tileName) {
  if (!file || file.extension !== "md") return;
  try {
    const content = await app.vault.read(file);
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let body;
    if (fmMatch) {
      const fmLines = fmMatch[1].split("\n");
      const out = [];
      for (const line of fmLines) {
        if (line.match(/^\s*(tile|group)\s*:/)) continue;
        out.push(line);
      }
      if (tileName) out.push("tile: " + tileName);
      const newFm = "---\n" + out.join("\n") + "\n---";
      body = content.replace(/^---\s*\n[\s\S]*?\n---/, newFm);
    } else if (tileName) {
      body = "---\ntile: " + tileName + "\n---\n\n" + content;
    } else {
      body = content;
    }
    await app.vault.modify(file, body);
  } catch (e) {
    console.error("setFileTile error", e);
    new Notice("Failed to move: " + (e.message || "error"));
  }
}

async function setFileTile(filePath, tileName) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (file) await setFileTileByFile(file, tileName);
}

async function renderMarkdownIntoEl(containerEl, file) {
  try {
    const { MarkdownRenderer, Component } = require("obsidian");
    const md = await app.vault.read(file);
    const comp = new Component();
    comp.load();
    await MarkdownRenderer.render(app, md, containerEl, file.path, comp);
  } catch (e) {
    console.error("repo tile embed", e);
    containerEl.createEl("div", { cls: "repo-board-tile-embed-error", text: "Could not render note." });
  }
}

/** Apply tile color/size CSS variables (shared by board + tile-actions clone). */
function applyRepoTileVisualProps(box, p) {
  p = p || {};
  if (p.bg) box.style.setProperty("--repo-tile-bg", p.bg);
  else box.style.removeProperty("--repo-tile-bg");
  if (p.textColor) box.style.setProperty("--repo-tile-text", p.textColor);
  else box.style.removeProperty("--repo-tile-text");
  if (p.borderColor) box.style.setProperty("--repo-tile-border", p.borderColor);
  else box.style.removeProperty("--repo-tile-border");
  const bw = parseFloat(p.borderWidth);
  if (!isNaN(bw) && bw > 1) box.style.setProperty("--repo-tile-border-w", bw + "px");
  else box.style.removeProperty("--repo-tile-border-w");
  if (p.noteBg) box.style.setProperty("--repo-tile-note-bg", p.noteBg);
  else box.style.removeProperty("--repo-tile-note-bg");
  if (p.noteText) box.style.setProperty("--repo-tile-note-text", p.noteText);
  else box.style.removeProperty("--repo-tile-note-text");
  if (p.noteBorderColor) box.style.setProperty("--repo-tile-note-border", p.noteBorderColor);
  else box.style.removeProperty("--repo-tile-note-border");
  const ts = parseFloat(p.textScale);
  box.style.setProperty("--repo-tile-title-scale", String(!isNaN(ts) ? ts : 1));
  let ns = parseFloat(p.noteTextScale);
  if (isNaN(ns)) ns = !isNaN(ts) ? ts : 1;
  box.style.setProperty("--repo-tile-note-scale", String(ns));
  if (p.titleFontWeight) box.style.setProperty("--repo-tile-title-weight", p.titleFontWeight);
  else box.style.removeProperty("--repo-tile-title-weight");
  if (p.titleFontStyle) box.style.setProperty("--repo-tile-title-style", p.titleFontStyle);
  else box.style.removeProperty("--repo-tile-title-style");
  if (p.titleLetterSpacing) box.style.setProperty("--repo-tile-title-tracking", p.titleLetterSpacing);
  else box.style.removeProperty("--repo-tile-title-tracking");
  const im = parseFloat(p.imageScale);
  box.style.setProperty("--repo-tile-img-scale", String(!isNaN(im) ? im : 1));
}

function appendRepoChipLabel(btn, text) {
  btn.empty();
  btn.createEl("span", { cls: "repo-link-picker-chip-label", text });
}

/** Shrink label font until it fits the chip’s fixed box (folder chips only). Tile chips use CSS size — no shrink-to-fit. */
function fitRepoLinkTreeChipLabels(container) {
  if (!container?.querySelectorAll) return;
  container.querySelectorAll(".repo-link-picker-chip").forEach((chip) => {
    if (chip.classList.contains("repo-link-picker-chip--tile")) return;
    const label = chip.querySelector(".repo-link-picker-chip-label");
    if (!label || !chip.isConnected) return;
    const cs = getComputedStyle(chip);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = chip.clientWidth - padX;
    const availH = chip.clientHeight - padY;
    if (availW < 2 || availH < 2) return;
    if (label.scrollWidth <= availW && label.scrollHeight <= availH) return;
    label.style.removeProperty("font-size");
    let fs = parseFloat(getComputedStyle(label).fontSize) || 14;
    const minFs = 7;
    for (let i = 0; i < 80; i++) {
      if (label.scrollWidth <= availW && label.scrollHeight <= availH) break;
      fs -= 0.5;
      if (fs < minFs) {
        label.style.fontSize = minFs + "px";
        break;
      }
      label.style.fontSize = fs + "px";
    }
  });
}

/**
 * Horizontal center of chip group in a branch row (full-width flex rows need chip bounds, not row box center).
 */
function repoLinkTreeRowChipCenterX(root, row) {
  if (!row) return null;
  const rr = root.getBoundingClientRect();
  /** Avoid `:scope` in querySelector — can return no matches in some embedded Chromium builds. */
  const chips = [];
  for (let i = 0; i < row.children.length; i++) {
    const col = row.children[i];
    if (!col.classList.contains("repo-link-tree-col")) continue;
    const chip = col.querySelector(".repo-link-picker-chip");
    if (chip) chips.push(chip);
  }
  if (chips.length === 0) return null;
  if (chips.length === 1) {
    const cr = chips[0].getBoundingClientRect();
    return cr.left + cr.width / 2 - rr.left;
  }
  let minL = Infinity;
  let maxR = -Infinity;
  chips.forEach((c) => {
    const r = c.getBoundingClientRect();
    minL = Math.min(minL, r.left);
    maxR = Math.max(maxR, r.right);
  });
  return (minL + maxR) / 2 - rr.left;
}

/**
 * Position each sublayer chip group under the selected parent.
 * Uses margin-left on a width:max-content wrapper — full-width rows with justify-content:center
 * cannot be aligned with translate on an outer 100% box (chips stay viewport-centered).
 */
function positionRepoLinkTreeSublayerShifts(root) {
  if (!root || !root.isConnected) return;
  root.querySelectorAll(".repo-link-tree-sublayer-shift").forEach((shift) => {
    shift.style.marginLeft = "0";
  });
  void root.offsetWidth;
  root.querySelectorAll(".repo-link-tree-sublayer-shift").forEach((shift) => {
    const depth = shift.dataset.repoDepth;
    let active = null;
    if (depth === "2") {
      active = root.querySelector(".repo-link-tree-layer-depth--1 .repo-link-picker-chip.is-active");
    } else if (depth === "3") {
      active = root.querySelector(".repo-link-tree-layer-depth--2 .repo-link-picker-chip.is-active");
    } else if (depth === "4") {
      active = root.querySelector(".repo-link-tree-layer-depth--3 .repo-link-picker-chip.is-active");
    } else if (depth === "5") {
      active = root.querySelector(".repo-link-tree-layer-depth--4 .repo-link-picker-chip--tile.is-active");
    }
    let row = shift.querySelector(".repo-link-tree-branch-wrap--layer .repo-link-tree-row--layer");
    if (!row) row = shift.querySelector(".repo-link-tree-branch-wrap--layer .repo-link-tree-row");
    const notesEl = shift.querySelector(".repo-link-picker-notes--tree, .repo-link-picker-notes");
    let childCenter = null;
    if (notesEl && depth === "5") {
      const nr = notesEl.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      if (nr.width > 0) childCenter = nr.left + nr.width / 2 - rr.left;
    } else {
      childCenter = repoLinkTreeRowChipCenterX(root, row);
    }
    const rr = root.getBoundingClientRect();
    if (!active || childCenter == null) {
      shift.style.marginLeft = "";
      return;
    }
    const ar = active.getBoundingClientRect();
    const parentCenter = ar.left + ar.width / 2 - rr.left;
    let ml = Math.round(parentCenter - childCenter);
    shift.style.marginLeft = ml + "px";
    void shift.offsetWidth;
    const sr = shift.getBoundingClientRect();
    const rr2 = root.getBoundingClientRect();
    const pad = 4;
    if (sr.left < rr2.left + pad) {
      ml += Math.ceil(rr2.left + pad - sr.left);
      shift.style.marginLeft = ml + "px";
    }
  });
}

/**
 * Shared Repository file tree: static layers (no transform / resize layout loops). Click only updates state + refresh.
 * Tile row = manual `_board.md` tiles + folder-as-group tiles (`listAutoFolderTileNames`, same as the board).
 * `link`: optional notes row. `move`: stops at tile — board path + tile/group only.
 * @param {"link"|"move"} mode
 * @param {{ onAfterRefresh?: () => void }} hooks
 */
function createRepoFileTreeController(stack, mode, hooks) {
  hooks = hooks || {};
  const onAfterRefresh = hooks.onAfterRefresh;
  const selectedTargets = new Set();
  const state = {
    base: null,
    secondary: null,
    tertiary: null,
    tileDisplayName: null
  };

  function togglePath(p, checked) {
    if (checked) selectedTargets.add(p);
    else selectedTargets.delete(p);
  }

  function renderNotesRow(container, boardPath, tileDisplayName, tc) {
    const { allFiles } = collectBoardMarkdownFiles(boardPath);
    const files = allFiles;
    const ftMap = new Map();
    for (const f of files) ftMap.set(f.path, effectiveBoardTileForFile(f.path, boardPath));
    let noteFiles = files.filter((f) => tileNameMatchesBoard(ftMap.get(f.path), tileDisplayName, f.path, boardPath));
    if (tc && tc.kind === "note" && tc.file) {
      const one = boardPath + "/" + tc.file;
      const f = app.vault.getAbstractFileByPath(one);
      if (f) noteFiles = [f];
    }
    const wrap = container.createEl("div", { cls: "repo-link-picker-notes-inner" });
    const head = wrap.createEl("div", { cls: "repo-link-picker-notes-header" });
    const sa = head.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link repo-link-picker-selall", text: "Select all" });
    const cbs = [];
    sa.addEventListener("click", () => {
      const allOn = cbs.length > 0 && cbs.every((c) => c.checked);
      cbs.forEach((c) => {
        c.checked = !allOn;
        togglePath(c.dataset.path, c.checked);
      });
    });
    for (const f of noteFiles) {
      const lab = wrap.createEl("label", { cls: "repo-link-picker-note-row" });
      const cb = lab.createEl("input", { type: "checkbox", cls: "repo-link-picker-note-cb" });
      cb.dataset.path = f.path;
      cb.addEventListener("change", () => togglePath(f.path, cb.checked));
      const link = lab.createEl("a", {
        href: f.path,
        text: displayStemForBoardFile(f),
        cls: "internal-link repo-link-picker-note-link",
      });
      link.setAttribute("data-href", f.path);
      if (isBoardPdfFile(f)) lab.createEl("span", { cls: "repo-board-file-kind", text: "PDF" });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      cbs.push(cb);
    }
    if (noteFiles.length === 0) {
      wrap.createEl("div", { cls: "repo-link-tree-empty", text: "No notes in this tile" });
    }
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function drawRepoLinkTreeSvg(root) {
    const svg = root.querySelector("svg.repo-link-tree-svg");
    if (!svg || !root.isConnected) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rr = root.getBoundingClientRect();
    if (rr.width < 1 || rr.height < 1) return;

    function addLine(x1, y1, x2, y2) {
      const pl = document.createElementNS(SVG_NS, "path");
      pl.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
      pl.setAttribute("fill", "none");
      pl.setAttribute("class", "repo-link-tree-svg-line");
      svg.appendChild(pl);
    }

    root.querySelectorAll(".repo-link-tree-flat-layer").forEach((layer) => {
      const inter = layer.previousElementSibling;
      if (!inter?.classList?.contains("repo-link-tree-inter-stem-wrap")) return;
      const prev = inter.previousElementSibling;
      const act = prev?.querySelector(".repo-link-picker-chip.is-active");
      const branch = layer.querySelector(".repo-link-tree-branch-wrap--layer:not(.repo-link-tree-branch-wrap--empty)");
      if (!act || !branch) return;
      const chips = [...branch.querySelectorAll(".repo-link-tree-col--child > .repo-link-picker-chip")];
      if (chips.length === 0) return;

      const ar = act.getBoundingClientRect();
      const px = ar.left + ar.width / 2 - rr.left;
      const pyBot = ar.bottom - rr.top;

      const brRect = branch.getBoundingClientRect();
      const yH = brRect.top - rr.top + 1;

      const centers = chips.map((c) => {
        const r = c.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - rr.left,
          yTop: r.top - rr.top,
        };
      });

      if (centers.length === 1) {
        const cx = centers[0].x;
        const yTop = centers[0].yTop;
        if (Math.abs(px - cx) <= 8) {
          const x = (px + cx) / 2;
          addLine(x, pyBot, x, yTop);
          return;
        }
      }

      let minX = px;
      let maxX = px;
      centers.forEach((c) => {
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
      });

      addLine(px, pyBot, px, yH);
      if (maxX - minX > 0.5) {
        addLine(minX, yH, maxX, yH);
      }
      centers.forEach((c) => {
        addLine(c.x, yH, c.x, c.yTop);
      });
    });

    const w = Math.max(1, Math.ceil(root.offsetWidth));
    const h = Math.max(1, Math.ceil(root.scrollHeight));
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.style.width = w + "px";
    svg.style.height = h + "px";
  }

  function scheduleDrawRepoLinkTree(root) {
    if (!root?.isConnected) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!root?.isConnected) return;
        positionRepoLinkTreeSublayerShifts(root);
        drawRepoLinkTreeSvg(root);
      });
    });
  }

  function finishTreeLayout(root) {
    requestAnimationFrame(() => {
      if (!root?.isConnected) return;
      fitRepoLinkTreeChipLabels(stack);
      requestAnimationFrame(() => {
        if (!root?.isConnected) return;
        positionRepoLinkTreeSublayerShifts(root);
        scheduleDrawRepoLinkTree(root);
        if (onAfterRefresh) onAfterRefresh();
      });
    });
  }

  /** Tile row uses same fixed size as folder chips (CSS vars on .repo-link-tree-viz); redraw SVG after layout. */
  function scheduleTileRowLayout(branchWrap) {
    if (!branchWrap?.classList?.contains("repo-link-tree-branch-wrap--tiles")) return;
    const treeRoot = branchWrap.closest(".repo-link-tree-root");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!branchWrap.isConnected) return;
        const ps = branchWrap.closest(".repo-link-picker-stack");
        if (ps) fitRepoLinkTreeChipLabels(ps);
        scheduleDrawRepoLinkTree(treeRoot);
      });
    });
  }

  function wireLayerBranch(branchWrap, row, opts) {
    opts = opts || {};
    let n = 0;
    for (let i = 0; i < row.children.length; i++) {
      if (row.children[i].classList.contains("repo-link-tree-col")) n++;
    }
    if (n === 0) {
      branchWrap.classList.add("repo-link-tree-branch-wrap--empty");
      return;
    }
    branchWrap.classList.add("repo-link-tree-branch-wrap--layer");
    if (opts.tiles) branchWrap.classList.add("repo-link-tree-branch-wrap--tiles");
    if (n === 1) branchWrap.classList.add("repo-link-tree-branch-wrap--single");
    else {
      branchWrap.classList.add("repo-link-tree-branch-wrap--multi");
      row.classList.add("repo-link-tree-row--multi");
    }
    row.classList.add("repo-link-tree-row--layer");
    const treeRoot = branchWrap.closest(".repo-link-tree-root");
    if (opts.tiles) scheduleTileRowLayout(branchWrap);
    else scheduleDrawRepoLinkTree(treeRoot);
    row.addEventListener("scroll", () => scheduleDrawRepoLinkTree(treeRoot), { passive: true });
  }

  function addInterStem(root) {
    return root.createEl("div", { cls: "repo-link-tree-inter-stem-wrap" });
  }

  /** Manual tiles from YAML + subfolders that contain .md (auto group tiles); mirrors `renderBoard` tile list. */
  function mergeBoardTileList(cfg, boardFolderPath) {
    const UNGROUPED = "__ungrouped__";
    let manualTiles = [...(cfg.tiles || [])];
    const autoNames = listAutoFolderTileNames(boardFolderPath);
    let tiles = [...manualTiles];
    for (const name of autoNames) {
      const dup = tiles.some((x) => x !== UNGROUPED && String(x).toLowerCase() === name.toLowerCase());
      if (!dup) tiles.push(name);
    }
    if (!tiles.includes(UNGROUPED)) tiles = [UNGROUPED, ...tiles];
    return tiles;
  }

  async function refresh() {
    stack.empty();
    let cfg = null;
    if (state.tertiary) {
      try {
        cfg = await getBoardConfig(state.tertiary.path);
      } catch (e) {
        cfg = { tiles: [], tileConfig: {} };
      }
    }

    const root = stack.createEl("div", { cls: "repo-link-tree-root repo-link-tree-root-flat" });
    const svgEl = document.createElementNS(SVG_NS, "svg");
    svgEl.setAttribute("class", "repo-link-tree-svg");
    svgEl.setAttribute("aria-hidden", "true");
    root.prepend(svgEl);
    const bases = getSubfolders(REPO_DATA);
    const rowBase = root.createEl("div", {
      cls: "repo-link-tree-row repo-link-tree-row-root repo-link-tree-row-primary repo-link-tree-layer-depth repo-link-tree-layer-depth--1",
    });
    if (bases.length === 0) {
      rowBase.createEl("div", { cls: "repo-link-tree-empty", text: "No folders under Data." });
    }
    for (const f of bases) {
      const col = rowBase.createEl("div", { cls: "repo-link-tree-col" });
      const b = col.createEl("button", { type: "button", cls: "repo-link-picker-chip" });
      appendRepoChipLabel(b, f.name);
      if (state.base && state.base.path === f.path) b.classList.add("is-active");
      b.addEventListener("click", () => {
        state.base = f;
        state.secondary = null;
        state.tertiary = null;
        state.tileDisplayName = null;
        selectedTargets.clear();
        void refresh();
      });
    }

    if (state.base) {
      addInterStem(root);
      const layerSec = root.createEl("div", { cls: "repo-link-tree-flat-layer repo-link-tree-layer-depth repo-link-tree-layer-depth--2" });
      const track1 = layerSec.createEl("div", { cls: "repo-link-tree-sublayer-track" });
      const shift1 = track1.createEl("div", { cls: "repo-link-tree-sublayer-shift" });
      shift1.dataset.repoDepth = "2";
      const bw1 = shift1.createEl("div", { cls: "repo-link-tree-branch-wrap repo-link-tree-branch-wrap-flat" });
      const row1 = bw1.createEl("div", { cls: "repo-link-tree-row" });
      const subs1 = getSubfolders(state.base.path);
      if (subs1.length === 0) {
        row1.createEl("div", { cls: "repo-link-tree-empty", text: "No subfolders" });
      } else {
        for (const sf of subs1) {
          const ccol = row1.createEl("div", { cls: "repo-link-tree-col repo-link-tree-col--child" });
          const bb = ccol.createEl("button", { type: "button", cls: "repo-link-picker-chip" });
          appendRepoChipLabel(bb, sf.name);
          if (state.secondary && state.secondary.path === sf.path) bb.classList.add("is-active");
          bb.addEventListener("click", () => {
            state.secondary = sf;
            state.tertiary = null;
            state.tileDisplayName = null;
            selectedTargets.clear();
            void refresh();
          });
        }
        wireLayerBranch(bw1, row1);
      }
    }

    if (state.base && state.secondary) {
      addInterStem(root);
      const layerTer = root.createEl("div", { cls: "repo-link-tree-flat-layer repo-link-tree-layer-depth repo-link-tree-layer-depth--3" });
      const track2 = layerTer.createEl("div", { cls: "repo-link-tree-sublayer-track" });
      const shift2 = track2.createEl("div", { cls: "repo-link-tree-sublayer-shift" });
      shift2.dataset.repoDepth = "3";
      const bw2 = shift2.createEl("div", { cls: "repo-link-tree-branch-wrap repo-link-tree-branch-wrap-flat" });
      const row2 = bw2.createEl("div", { cls: "repo-link-tree-row" });
      const subs2 = getSubfolders(state.secondary.path);
      if (subs2.length === 0) {
        row2.createEl("div", { cls: "repo-link-tree-empty", text: "No tertiary folders" });
      } else {
        for (const tf of subs2) {
          const tcol = row2.createEl("div", { cls: "repo-link-tree-col repo-link-tree-col--child" });
          const tb = tcol.createEl("button", { type: "button", cls: "repo-link-picker-chip" });
          appendRepoChipLabel(tb, tf.name);
          if (state.tertiary && state.tertiary.path === tf.path) tb.classList.add("is-active");
          tb.addEventListener("click", () => {
            state.tertiary = tf;
            state.tileDisplayName = null;
            selectedTargets.clear();
            void refresh();
          });
        }
        wireLayerBranch(bw2, row2);
      }
    }

    if (state.tertiary) {
      addInterStem(root);
      const UNGROUPED = "__ungrouped__";
      const tiles = mergeBoardTileList(cfg || { tiles: [], tileConfig: {} }, state.tertiary.path);
      const layerTiles = root.createEl("div", { cls: "repo-link-tree-flat-layer repo-link-tree-layer-depth repo-link-tree-layer-depth--4" });
      const track3 = layerTiles.createEl("div", { cls: "repo-link-tree-sublayer-track" });
      const shift3 = track3.createEl("div", { cls: "repo-link-tree-sublayer-shift" });
      shift3.dataset.repoDepth = "4";
      const bw3 = shift3.createEl("div", { cls: "repo-link-tree-branch-wrap repo-link-tree-branch-wrap-flat" });
      const row3 = bw3.createEl("div", { cls: "repo-link-tree-row" });
      if (tiles.length === 0) {
        row3.createEl("div", { cls: "repo-link-tree-empty", text: "No tiles on this board" });
      } else {
        for (const tName of tiles) {
          const label = tName === UNGROUPED ? "Ungrouped" : tName;
          const ncol = row3.createEl("div", { cls: "repo-link-tree-col repo-link-tree-col--child" });
          const tbtn = ncol.createEl("button", { type: "button", cls: "repo-link-picker-chip repo-link-picker-chip--tile" });
          appendRepoChipLabel(tbtn, label);
          if (state.tileDisplayName === tName) tbtn.classList.add("is-active");
          tbtn.addEventListener("click", () => {
            state.tileDisplayName = tName;
            selectedTargets.clear();
            void refresh();
          });
        }
        wireLayerBranch(bw3, row3, { tiles: true });
      }
    }

    if (mode === "link" && state.tertiary && state.tileDisplayName != null) {
      addInterStem(root);
      const UNGROUPED = "__ungrouped__";
      const tKey = state.tileDisplayName === UNGROUPED ? "__ungrouped__" : state.tileDisplayName;
      const tc = ((cfg && cfg.tileConfig) || {})[tKey] || { kind: "group" };
      const layerNotes = root.createEl("div", {
        cls: "repo-link-tree-flat-layer repo-link-tree-flat-layer-notes repo-link-tree-layer-depth repo-link-tree-layer-depth--5",
      });
      const trackN = layerNotes.createEl("div", { cls: "repo-link-tree-sublayer-track" });
      const shiftN = trackN.createEl("div", { cls: "repo-link-tree-sublayer-shift repo-link-tree-sublayer-shift--notes" });
      shiftN.dataset.repoDepth = "5";
      const notesHost = shiftN.createEl("div", { cls: "repo-link-picker-notes repo-link-picker-notes--tree" });
      renderNotesRow(notesHost, state.tertiary.path, state.tileDisplayName, tc);
    }

    finishTreeLayout(root);
  }

  function getLinkTargets() {
    if (mode !== "link") return [];
    return [...selectedTargets];
  }

  /** @returns {{ boardFolderPath: string, tileName: string | null } | null} */
  function getMoveDestination() {
    if (mode !== "move") return null;
    if (!state.tertiary || state.tileDisplayName == null) return null;
    const UNGROUPED = "__ungrouped__";
    const raw = state.tileDisplayName;
    const tileName = raw === UNGROUPED ? null : raw;
    return { boardFolderPath: state.tertiary.path, tileName };
  }

  stack.addEventListener(
    "scroll",
    () => {
      const r = stack.querySelector(".repo-link-tree-root");
      if (r) scheduleDrawRepoLinkTree(r);
    },
    { passive: true }
  );

  return { refresh, getLinkTargets, getMoveDestination, state };
}

async function showMoveToBoardModal(paths, onSuccess) {
  const overlay = document.body.createEl("div", { cls: "links-search-overlay repo-link-tree-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-link-tree-modal repo-link-tree-modal--move" });
  const head = modal.createEl("div", { cls: "repo-link-tree-header repo-link-tree-header--move" });
  head.createEl("h2", { text: "Select a Location..", cls: "repo-link-tree-title" });
  const stack = modal.createEl("div", { cls: "repo-link-picker-stack repo-link-tree-viz" });
  const foot = modal.createEl("div", { cls: "ideas-modal-actions repo-link-tree-footer" });
  const cancelFoot = foot.createEl("button", { type: "button", cls: "ideas-btn", text: "Cancel" });
  const moveBtn = foot.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-final", text: "Select", disabled: true });

  const tree = createRepoFileTreeController(stack, "move", {
    onAfterRefresh: () => {
      moveBtn.disabled = tree.getMoveDestination() == null;
    }
  });

  cancelFoot.addEventListener("click", () => overlay.remove());
  moveBtn.addEventListener("click", async () => {
    const dest = tree.getMoveDestination();
    if (!dest) return;
    try {
      await ensureFolder(dest.boardFolderPath);
      const selectedTile = dest.tileName;
      for (const p of paths) {
        const file = app.vault.getAbstractFileByPath(p);
        if (file && (file.extension === "md" || isBoardPdfFile(file))) {
          await moveFile(p, dest.boardFolderPath);
          const movedFile = app.vault.getAbstractFileByPath(dest.boardFolderPath + "/" + file.name);
          if (movedFile && movedFile.extension === "md") await setFileTileByFile(movedFile, selectedTile);
        }
      }
      overlay.remove();
      new Notice("Moved");
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error("Move failed:", e);
      new Notice("Move failed: " + (e.message || String(e)));
    }
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  await tree.refresh();
}

function countItems(folderPath, depth) {
  const folder = app.vault.getAbstractFileByPath(normalizeVaultPath(folderPath));
  if (!folder || !folder.children) return 0;
  if (depth >= 2) {
    return folder.children.filter((c) => {
      const ext = String(c.extension || "").toLowerCase();
      return (ext === "md" && c.name !== BOARD_CONFIG_FILE) || ext === "pdf";
    }).length;
  }
  return folder.children.filter(c => !c.extension && !c.name.startsWith(".")).length;
}

function buildCurrentPath() {
  let p = REPO_DATA;
  for (const seg of breadcrumbPath) p += "/" + seg;
  return normalizeVaultPath(p);
}

function collectAllLayer3Paths(basePath, currentDepth) {
  if (currentDepth >= 3) return [basePath];
  const results = [];
  const subs = getSubfolders(basePath);
  for (const sub of subs) {
    results.push(...collectAllLayer3Paths(normalizeVaultPath(sub.path), currentDepth + 1));
  }
  return results;
}

let backBtn, fwdBtn;

function getCurrentViewId() {
  return viewRepository && viewRepository.style.display !== "none" ? "repository" : "new-dev";
}

function updateNavButtons() {
  if (backBtn) backBtn.disabled = navHistoryIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = navHistoryIndex >= navHistory.length - 1;
}

function pushNavState() {
  const view = getCurrentViewId();
  const state = { view, breadcrumb: [...breadcrumbPath] };
  navHistory = navHistory.slice(0, navHistoryIndex + 1);
  navHistory.push(state);
  navHistoryIndex = navHistory.length - 1;
  saveSessionState();
  updateNavButtons();
}

async function applyNavState(state) {
  breadcrumbPath = [...(state.breadcrumb || [])];
  if (state.view === "new-dev") {
    await showView("new-dev", true);
  } else {
    await showView("repository", true);
  }
  updateNavButtons();
}

/** Three path segments (Data layer depth): bordered / highlighted title only */
function renderBreadcrumb(parentEl) {
  parentEl.empty();
  const wrapper = parentEl.createEl("div", { cls: "repo-nav-bar repo-breadcrumb-inline" });
  const bar = wrapper.createEl("div", { cls: "repo-breadcrumb repo-breadcrumb-three" });
  for (let i = 0; i < 3; i++) {
    if (i > 0) bar.createEl("span", { cls: "repo-breadcrumb-sep", text: " › " });
    const col = bar.createEl("div", { cls: "repo-breadcrumb-layer-col" });
    const seg = breadcrumbPath[i];
    const filled = seg != null && seg !== "";
    const cell = col.createEl("span", {
      cls: "repo-breadcrumb-layer-cell" + (filled ? " repo-breadcrumb-layer-filled" : " repo-breadcrumb-layer-empty")
    });
    if (filled) {
      cell.textContent = seg;
      cell.classList.add("repo-breadcrumb-segment", "repo-breadcrumb-clickable");
      const idx = i;
      cell.addEventListener("click", () => {
        breadcrumbPath = breadcrumbPath.slice(0, idx + 1);
        pushNavState();
        renderVaultView();
      });
    } else {
      cell.textContent = "—";
    }
  }
}

function showCreateLayerModal(folderPath, callback) {
  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal" });
  modal.createEl("h4", { text: "New layer" });
  const input = modal.createEl("input", { cls: "links-search-input", type: "text", placeholder: "Name..." });
  const btnRow = modal.createEl("div", { cls: "ideas-modal-actions", style: "margin-top:0.75em;display:flex;gap:0.5em" });
  const cancelBtn = btnRow.createEl("button", { cls: "ideas-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { cls: "ideas-btn ideas-btn-final", text: "Create" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  createBtn.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) { new Notice("Enter a name"); return; }
    const safe = name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
    const newPath = folderPath + "/" + safe;
    if (app.vault.getAbstractFileByPath(newPath)) { new Notice("Already exists"); return; }
    await app.vault.createFolder(newPath);
    overlay.remove();
    new Notice("Created " + safe);
    if (callback) callback();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") createBtn.click(); });
  focusModalTextInput(input);
}

function showCreateFileModal(folderPath, callback) {
  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal" });
  modal.createEl("h4", { text: "New note" });
  const input = modal.createEl("input", { cls: "links-search-input", type: "text", placeholder: "Name..." });
  const btnRow = modal.createEl("div", { cls: "ideas-modal-actions", style: "margin-top:0.75em;display:flex;gap:0.5em" });
  const cancelBtn = btnRow.createEl("button", { cls: "ideas-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { cls: "ideas-btn ideas-btn-final", text: "Create" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  createBtn.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) { new Notice("Enter a name"); return; }
    const safe = (name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled") + ".md";
    const newPath = folderPath + "/" + safe;
    if (app.vault.getAbstractFileByPath(newPath)) { new Notice("Note already exists"); return; }
    await ensureFolder(folderPath);
    await app.vault.create(newPath, "---\n---\n\n");
    overlay.remove();
    new Notice("Created");
    const file = app.vault.getAbstractFileByPath(newPath);
    if (file) await app.workspace.getLeaf().openFile(file);
    if (callback) callback();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") createBtn.click(); });
  focusModalTextInput(input);
}

function renderLayerGrid(parentEl, folderPath, depth) {
  const subfolders = getSubfolders(folderPath);
  if (subfolders.length === 0) {
    parentEl.createEl("div", { cls: "repo-layer-empty", text: "No layers yet. Click + to create one." });
    return;
  }
  const grid = parentEl.createEl("div", { cls: "repo-layer-grid" });
  for (const sub of subfolders) {
    const card = grid.createEl("div", { cls: "repo-layer-card" });
    const nameEl = card.createEl("div", { cls: "repo-layer-name", text: sub.name });
    const count = countItems(sub.path, depth);
    const unit = depth >= 2 ? "note" : "section";
    card.createEl("div", { cls: "repo-layer-count", text: String(count) + " " + unit + (count !== 1 ? "s" : "") });
    card.addEventListener("click", () => {
      breadcrumbPath.push(sub.name);
      pushNavState();
      renderVaultView();
    });
  }
}

/** Append wiki links + repo-links frontmatter to source note files */
async function appendRepoLinksToNoteFiles(sourcePaths, targetPaths) {
  const uniqTargets = [...new Set(targetPaths.filter(Boolean))];
  if (uniqTargets.length === 0) return;
  for (const sourcePath of sourcePaths) {
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.extension !== "md") continue;
    try {
      await app.fileManager.processFrontMatter(file, (fm) => {
        const key = "repo-links";
        if (!fm[key]) fm[key] = [];
        const arr = Array.isArray(fm[key]) ? fm[key] : (fm[key] != null ? [fm[key]] : []);
        const set = new Set(arr.map(String));
        for (const p of uniqTargets) {
          if (!set.has(p)) {
            arr.push(p);
            set.add(p);
          }
        }
        fm[key] = arr;
      });
    } catch (e) {
      console.error("processFrontMatter", e);
    }
    let content = await app.vault.read(file);
    const lines = [];
    for (const p of uniqTargets) {
      const tf = app.vault.getAbstractFileByPath(p);
      if (!tf || tf.path === file.path) continue;
      let linkStr = "";
      try {
        linkStr = app.fileManager.generateMarkdownLink(tf, sourcePath);
      } catch (e) {
        linkStr = isBoardPdfFile(tf)
          ? "[[" + tf.name + "]]"
          : "[[" + tf.basename.replace(/\.md$/i, "") + "]]";
      }
      if (!content.includes(linkStr)) {
        lines.push("- " + linkStr);
      }
    }
    if (lines.length === 0) continue;
    if (content.includes("## Repository links")) {
      content = content.replace(/\s*$/, "") + "\n" + lines.join("\n") + "\n";
    } else {
      content = content.replace(/\s*$/, "") + "\n\n## Repository links\n\n" + lines.join("\n") + "\n";
    }
    await app.vault.modify(file, content);
  }
}

function openTileContentActionsModal(opts) {
  const {
    folderPath,
    tileName,
    isNoteTile,
    noteTileRelPath,
    memberPaths,
    tileProps: tilePropsParam,
    tileWidth,
    tileHeight
  } = opts;
  const UNGROUPED = "__ungrouped__";
  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-tile-actions-modal" });
  const body = modal.createEl("div", { cls: "repo-tile-actions-body" });
  const host = body.createEl("div", { cls: "repo-tile-actions-tile-host" });
  const scaleWrap = host.createEl("div", { cls: "repo-tile-actions-tile-scale" });
  const box = scaleWrap.createEl("div", {
    cls: "repo-board-tile-box" + (isNoteTile ? " repo-board-tile-box-note" : "") + " repo-tile-actions-tile-clone"
  });
  const w = Math.max(120, Math.round(tileWidth || 260));
  const h = Math.max(80, Math.round(tileHeight || 180));
  box.style.width = w + "px";
  box.style.height = h + "px";
  applyRepoTileVisualProps(box, tilePropsParam || {});

  const titleRow = box.createEl("div", { cls: "repo-board-tile-title-row" });
  titleRow.createEl("div", { cls: "repo-board-tile-title", text: tileName === UNGROUPED ? "Ungrouped" : tileName });

  function selectedPaths() {
    return Array.from(host.querySelectorAll(".repo-tile-actions-note-cb:checked"))
      .map((el) => el.dataset.path)
      .filter(Boolean);
  }

  if (isNoteTile && noteTileRelPath) {
    const full = folderPath + "/" + noteTileRelPath;
    const cb = titleRow.createEl("input", { type: "checkbox", cls: "repo-tile-actions-note-cb", attr: { title: "Include this note" } });
    cb.dataset.path = full;
    cb.checked = true;
    const embedWrap = box.createEl("div", { cls: "repo-board-tile-embed-wrap" });
    const embedEl = embedWrap.createEl("div", { cls: "repo-board-tile-embed markdown-preview-view" });
    const embedFile = app.vault.getAbstractFileByPath(full);
    if (embedFile && embedFile.extension === "md") {
      void renderMarkdownIntoEl(embedEl, embedFile);
    } else {
      embedEl.createEl("div", { cls: "repo-board-tile-embed-error", text: "Missing note: " + (noteTileRelPath || "") });
    }
  } else {
    const list = box.createEl("div", { cls: "repo-board-tile-list" });
    if (!memberPaths || memberPaths.length === 0) {
      list.createEl("div", { cls: "repo-tile-actions-empty", text: "No notes in this tile." });
    } else {
      const single = memberPaths.length === 1;
      for (const p of memberPaths) {
        const lab = list.createEl("label", { cls: "repo-board-tile-item repo-tile-actions-selectable" });
        const cb = lab.createEl("input", { type: "checkbox", cls: "repo-tile-actions-note-cb" });
        cb.dataset.path = p;
        cb.checked = single;
        const name = (p || "").split("/").pop().replace(/\.(md|pdf)$/i, "");
        const link = lab.createEl("a", { href: "#", text: name, cls: "internal-link" });
        link.setAttribute("data-href", p);
        const pf = app.vault.getAbstractFileByPath(p);
        if (pf && isBoardPdfFile(pf)) lab.createEl("span", { cls: "repo-board-file-kind", text: "PDF" });
        link.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
      }
    }
  }

  const actions = modal.createEl("div", { cls: "ideas-modal-actions repo-tile-actions-footer" });
  const selAll = actions.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link repo-tile-actions-selall", text: "Select all" });
  selAll.addEventListener("click", () => {
    host.querySelectorAll(".repo-tile-actions-note-cb").forEach((c) => { c.checked = true; });
  });
  const cancelBtn = actions.createEl("button", { type: "button", cls: "ideas-btn", text: "Cancel" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  const linkBtn = actions.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-final", text: "Link…" });
  linkBtn.addEventListener("click", () => {
    const sp = selectedPaths();
    if (sp.length === 0) {
      new Notice("Select at least one note");
      return;
    }
    overlay.remove();
    openRepoLinkTreeModal({ sourcePaths: sp });
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function openRepoLinkTreeModal(opts) {
  const { sourcePaths } = opts;
  const overlay = document.body.createEl("div", { cls: "links-search-overlay repo-link-tree-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-link-tree-modal repo-link-tree-modal--link" });
  const head = modal.createEl("div", { cls: "repo-link-tree-header repo-link-tree-header--link" });
  head.createEl("h2", { text: "Select a Location..", cls: "repo-link-tree-title" });
  const stack = modal.createEl("div", { cls: "repo-link-picker-stack repo-link-tree-viz" });
  const tree = createRepoFileTreeController(stack, "link");
  const foot = modal.createEl("div", { cls: "ideas-modal-actions repo-link-tree-footer" });
  const cancelFoot = foot.createEl("button", { type: "button", cls: "ideas-btn", text: "Cancel" });
  cancelFoot.addEventListener("click", () => overlay.remove());
  const linkGo = foot.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-final", text: "Link" });
  linkGo.addEventListener("click", async () => {
    const targets = tree.getLinkTargets();
    if (targets.length === 0) {
      new Notice("Select at least one target note");
      return;
    }
    await appendRepoLinksToNoteFiles(sourcePaths, targets);
    overlay.remove();
    new Notice("Links added to " + sourcePaths.length + " note(s)");
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  void tree.refresh();
}

async function renderBoard(parentEl, folderPath) {
  const boardConfig = await getBoardConfig(folderPath);
  let manualTiles = [...(boardConfig.tiles || [])];
  const autoFolderTileNames = listAutoFolderTileNames(folderPath);
  let sizes = boardConfig.sizes || {};
  let tileConfig = boardConfig.tileConfig || {};
  let tileProps = { ...(boardConfig.tileProps || {}) };
  const { rootFiles, allFiles: files } = collectBoardMarkdownFiles(folderPath);
  const UNGROUPED = "__ungrouped__";
  if (files.length === 0 && manualTiles.length === 0 && autoFolderTileNames.length === 0) {
    pendingBoardSelectTileKey = null;
    parentEl.createEl("div", { cls: "repo-layer-empty", text: "No notes yet. Click + to add one." });
    return;
  }

  const fileTiles = new Map();
  for (const f of files) {
    fileTiles.set(f.path, effectiveBoardTileForFile(f.path, folderPath));
  }
  for (const f of rootFiles) {
    const t = getFileTile(f.path);
    if (t && t !== UNGROUPED) {
      const dup = manualTiles.some((x) => x !== UNGROUPED && String(x).toLowerCase() === String(t).toLowerCase());
      if (!dup) manualTiles.push(t);
    }
  }
  let tiles = [...manualTiles];
  for (const name of autoFolderTileNames) {
    const dup = tiles.some((x) => x !== UNGROUPED && String(x).toLowerCase() === name.toLowerCase());
    if (!dup) tiles = [...tiles, name];
  }
  if (!tiles.includes(UNGROUPED)) tiles = [UNGROUPED, ...tiles];

  let editMode = false;

  const fileByPath = new Map();
  for (const f of files) fileByPath.set(f.path, f);

  function toggleEdit() {
    editMode = !editMode;
    boardEditMode = editMode;
    saveSessionState();
    repoEditBtn.textContent = editMode ? "Done" : "Edit";
    boardWrap.classList.toggle("repo-board-edit-mode", editMode);
    boardContent.querySelectorAll(".repo-board-tile-item").forEach(el => {
      el.classList.toggle("repo-board-item-edit", editMode);
      el.draggable = editMode;
    });
    if (!editMode) {
      clearSelection();
      flushLayoutToFile();
    }
  }

  function applyEditMode() {
    editMode = true;
    repoEditBtn.textContent = "Done";
    boardWrap.classList.add("repo-board-edit-mode");
    boardContent.querySelectorAll(".repo-board-tile-item").forEach(el => {
      el.classList.add("repo-board-item-edit");
      el.draggable = true;
    });
  }

  repoEditBtn.disabled = false;
  repoEditBtn.onclick = toggleEdit;

  const boardWrap = parentEl.createEl("div", { cls: "repo-board-wrap" });
  const boardContent = boardWrap.createEl("div", { cls: "repo-board-content repo-board-canvas" });
  let selectedTileKey = null;
  function applyTilePropsToBox(box, tk) {
    applyRepoTileVisualProps(box, tileProps[tk] || {});
  }
  function clearSelection() {
    selectedTileKey = null;
    boardContent.querySelectorAll(".repo-board-tile-selected").forEach(el => el.classList.remove("repo-board-tile-selected"));
  }
  function setSelectedTile(key) {
    selectedTileKey = key;
    boardContent.querySelectorAll(".repo-board-tile-box").forEach(box => {
      box.classList.toggle("repo-board-tile-selected", box.dataset.tileKey === key);
    });
  }
  boardContent.addEventListener("mousedown", (e) => {
    if (e.target === boardContent) clearSelection();
  });
  /** Min inset from canvas (0 = flush). Selection/hover use inset outlines so this can stay 0.) */
  const EDGE = 0;
  /** Gap between tiles in auto-layout only. */
  const GAP = 6;
  const defW = 260, defH = 180;
  const LAYOUT_KEY = "repo-board-layout:" + folderPath;

  function canvasMinHeightFloor() {
    try {
      return Math.max(1000, Math.min(2000, Math.floor(window.innerHeight * 0.88)));
    } catch (e) {
      return 1200;
    }
  }

  function canvasInnerWidth() {
    let w = boardContent.clientWidth;
    if (!w && boardWrap) w = boardWrap.clientWidth;
    if (!w) w = parentEl.clientWidth;
    return Math.max(w || 0, 320);
  }

  function ensureCanvasHeightFromLayout() {
    let maxBottom = EDGE;
    for (const p of Object.values(layout)) {
      maxBottom = Math.max(maxBottom, (p.y || 0) + (p.h || 0));
    }
    /* +2px buffer avoids subpixel rounding vs absolute tiles (tiny phantom scrollbar in edit mode) */
    const minH = Math.max(maxBottom + EDGE + 2, canvasMinHeightFloor());
    boardContent.style.minHeight = Math.ceil(minH) + "px";
  }

  function clampLayoutBoxesToCanvas() {
    const cw = canvasInnerWidth();
    const minTileW = 120, minTileH = 80;
    for (const k of Object.keys(layout)) {
      let { x, y, w, h } = layout[k];
      w = Math.min(Math.max(minTileW, w), cw - 2 * EDGE);
      h = Math.max(minTileH, h);
      x = Math.max(EDGE, Math.min(x, cw - EDGE - w));
      y = Math.max(EDGE, y);
      layout[k] = { x, y, w, h };
    }
    ensureCanvasHeightFromLayout();
  }

  function saveDirtyLayout() {
    try {
      const obj = {};
      for (const [k, p] of Object.entries(layout)) {
        obj[k] = { w: Math.round(p.w), h: Math.round(p.h), x: Math.round(p.x), y: Math.round(p.y) };
      }
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function loadDirtyLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearDirtyLayout() {
    try { localStorage.removeItem(LAYOUT_KEY); } catch (e) {}
  }

  async function flushLayoutToFile() {
    const full = await getBoardConfig(folderPath);
    const newSizes = {};
    for (const [k, p] of Object.entries(layout)) {
      newSizes[k] = { w: Math.round(p.w), h: Math.round(p.h), x: Math.round(p.x), y: Math.round(p.y) };
    }
    await saveBoardConfig(folderPath, { tiles: manualTiles, sizes: newSizes, tileConfig: full.tileConfig || {}, tileProps: full.tileProps || {} });
  }

  function computeLayout() {
    const dirty = loadDirtyLayout();
    const positions = {};
    let x = EDGE, y = EDGE, rowH = 0;
    const availW = Math.max(canvasInnerWidth(), 320);
    for (let i = 0; i < tiles.length; i++) {
      const key = tiles[i] === UNGROUPED ? "__ungrouped__" : tiles[i];
      const d = dirty ? dirty[key] : null;
      const s = d || sizes[key] || {};
      const w = s.w ?? defW;
      const h = s.h ?? defH;
      if (s.x != null && s.y != null) {
        positions[key] = { x: s.x, y: s.y, w, h };
      } else {
        if (x + w + GAP > availW && x > EDGE) { x = EDGE; y += rowH + GAP; rowH = 0; }
        positions[key] = { x, y, w, h };
        x += w + GAP;
        rowH = Math.max(rowH, h);
      }
    }
    return positions;
  }

  let layout = computeLayout();
  clampLayoutBoxesToCanvas();
  for (let i = 0; i < tiles.length; i++) {
    const tileName = tiles[i];
    const tileKey = tileName === UNGROUPED ? "__ungrouped__" : tileName;
    const pos = layout[tileKey] || { x: EDGE, y: EDGE, w: defW, h: defH };
    const tc = tileConfig[tileKey] || { kind: "group" };
    const isNoteTile = tc.kind === "note" && tc.file;
    const allMemberFiles = files.filter((f) =>
      tileNameMatchesBoard(fileTiles.get(f.path), tileName, f.path, folderPath)
    );
    const tp = tileProps[tileKey] || {};
    let tileFiles = allMemberFiles.slice();
    if (!isNoteTile && tp.linkMode === "pick" && Array.isArray(tp.linkPaths) && tp.linkPaths.length > 0) {
      const norm = folderPath.replace(/\/$/, "");
      const pick = new Set(tp.linkPaths.map(rel => norm + "/" + rel));
      tileFiles = tileFiles.filter(f => pick.has(f.path));
    }
    const tileBox = boardContent.createEl("div", { cls: "repo-board-tile-box" + (isNoteTile ? " repo-board-tile-box-note" : "") });
    tileBox.dataset.tile = tileName === UNGROUPED ? "" : tileName;
    tileBox.dataset.tileKey = tileKey;
    if (!isNoteTile) tileBox.classList.add("repo-board-tile-dropzone");
    tileBox.style.width = pos.w + "px";
    tileBox.style.height = pos.h + "px";
    tileBox.style.left = pos.x + "px";
    tileBox.style.top = pos.y + "px";
    applyTilePropsToBox(tileBox, tileKey);
    tileBox.addEventListener("mousedown", (e) => {
        if (!editMode) return;
        /* Single-note tiles: allow click/drag on embed for selection only — tile drag starts from title row, not embed */
        const fromEmbed = isNoteTile && !!e.target.closest(".repo-board-tile-embed-wrap");
        if (e.target.closest(".repo-board-tile-item") || e.target.closest(".repo-board-resize-handle")) return;
        if (e.target.closest(".repo-board-tile-props-btn")) return;
        if (e.target.closest(".repo-board-tile-action-btn")) return;
        if (e.target.closest("a.internal-link")) return;
        if (!fromEmbed) e.preventDefault();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startLeft = parseInt(tileBox.style.left, 10) || 0;
        const startTop = parseInt(tileBox.style.top, 10) || 0;
        let dragStarted = false;
        const THRESH = 6;

        function onMove(ev) {
          const dx = ev.clientX - startMouseX;
          const dy = ev.clientY - startMouseY;
          if (fromEmbed) return;
          if (!dragStarted) {
            if (Math.hypot(dx, dy) < THRESH) return;
            dragStarted = true;
            tileBox.style.zIndex = "1000";
            tileBox.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
            tileBox.style.opacity = "0.95";
          }
          const cw = canvasInnerWidth();
          const w = parseInt(tileBox.style.width, 10) || defW;
          const h = parseInt(tileBox.style.height, 10) || defH;
          let nx = startLeft + dx;
          let ny = startTop + dy;
          nx = Math.max(EDGE, Math.min(nx, cw - EDGE - w));
          ny = Math.max(EDGE, ny);
          const neededBottom = ny + h + EDGE;
          const curMin = parseFloat(boardContent.style.minHeight) || boardContent.clientHeight || 400;
          if (neededBottom > curMin) boardContent.style.minHeight = neededBottom + "px";
          tileBox.style.left = nx + "px";
          tileBox.style.top = ny + "px";
        }

        function onUp(ev) {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          const moved = Math.hypot(ev.clientX - startMouseX, ev.clientY - startMouseY);
          if (dragStarted && !fromEmbed) {
            tileBox.style.zIndex = "";
            tileBox.style.boxShadow = "";
            tileBox.style.opacity = "";
            let finalX = parseInt(tileBox.style.left, 10) || 0;
            let finalY = parseInt(tileBox.style.top, 10) || 0;
            const cw = canvasInnerWidth();
            const w = parseInt(tileBox.style.width, 10) || defW;
            const h = parseInt(tileBox.style.height, 10) || defH;
            finalX = Math.max(EDGE, Math.min(finalX, cw - EDGE - w));
            finalY = Math.max(EDGE, finalY);
            tileBox.style.left = finalX + "px";
            tileBox.style.top = finalY + "px";
            layout[tileKey] = { ...layout[tileKey], x: finalX, y: finalY, w, h };
            ensureCanvasHeightFromLayout();
            saveDirtyLayout();
          } else if (moved <= THRESH) {
            setSelectedTile(tileKey);
          }
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

    if (!isNoteTile) {
      tileBox.addEventListener("dragover", (e) => {
        if (!editMode) return;
        if (e.dataTransfer.types.includes("application/x-repo-tile")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        tileBox.classList.add("repo-board-drag-over");
      });
      tileBox.addEventListener("dragleave", (e) => {
        if (!tileBox.contains(e.relatedTarget)) tileBox.classList.remove("repo-board-drag-over");
      });
      tileBox.addEventListener("drop", async (e) => {
        if (!editMode) return;
        e.preventDefault();
        tileBox.classList.remove("repo-board-drag-over");
        const data = e.dataTransfer.getData("text/plain");
        if (data.startsWith("tile:")) return;
        const path = data;
        let file = fileByPath.get(path) || app.vault.getAbstractFileByPath(path);
        if (!file || (file.extension !== "md" && !isBoardPdfFile(file))) return;
        const targetTile = tileBox.dataset.tile || null;
        const targetName = targetTile || "";
        const rel = relPathFromBoardRoot(folderPath, file.path);
        const isUngroupedTarget = !targetName;
        const autoMatch = autoFolderTileNames.find((n) => n.toLowerCase() === String(targetName).toLowerCase());

        if (isBoardPdfFile(file) && targetName && !autoMatch && !isUngroupedTarget) {
          new Notice("PDF: use a subfolder for this tile, or drop on Ungrouped.");
          return;
        }

        saveSessionState();
        try {
          const normRoot = normalizeVaultPath(folderPath);
          if (autoMatch) {
            const destDir = normRoot + "/" + autoMatch;
            await ensureFolder(destDir);
            let destPath = destDir + "/" + file.name;
            if (destPath !== file.path && app.vault.getAbstractFileByPath(destPath)) {
              const stem = (file.name || "").replace(/\.(md|pdf)$/i, "");
              const ext = file.extension || "md";
              let n = 2;
              while (app.vault.getAbstractFileByPath(destPath)) {
                destPath = destDir + "/" + stem + " " + n + "." + ext;
                n++;
              }
            }
            if (file.path !== destPath) {
              await app.fileManager.renameFile(file, destPath);
              file = app.vault.getAbstractFileByPath(destPath);
            }
            if (file) await setFileTileByFile(file, null);
          } else if (isUngroupedTarget) {
            const rootPath = normRoot + "/" + file.name;
            if (rel && rel.includes("/")) {
              if (app.vault.getAbstractFileByPath(rootPath) && rootPath !== file.path) {
                new Notice("A note with that name already exists at board root.");
                return;
              }
              await app.fileManager.renameFile(file, rootPath);
              file = app.vault.getAbstractFileByPath(rootPath);
            }
            if (file) await setFileTileByFile(file, null);
          } else {
            if (rel && rel.includes("/")) {
              const rootPath = normRoot + "/" + file.name;
              if (app.vault.getAbstractFileByPath(rootPath) && rootPath !== file.path) {
                new Notice("A note with that name already exists at board root.");
                return;
              }
              await app.fileManager.renameFile(file, rootPath);
              file = app.vault.getAbstractFileByPath(rootPath);
            }
            if (file) await setFileTileByFile(file, targetName);
          }
          new Notice("Moved");
          boardEditMode = true;
          renderVaultView();
        } catch (err) {
          console.error(err);
          new Notice("Move failed: " + (err.message || String(err)));
        }
      });
    }

    const titleRow = tileBox.createEl("div", { cls: "repo-board-tile-title-row" });
    titleRow.createEl("div", { cls: "repo-board-tile-title", text: tileName === UNGROUPED ? "Ungrouped" : tileName });
    const actionBtn = titleRow.createEl("button", { type: "button", cls: "repo-board-tile-action-btn", text: "⋯", title: "Tile actions" });
    actionBtn.addEventListener("mousedown", (e) => { e.stopPropagation(); });
    actionBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTileContentActionsModal({
        folderPath,
        tileName,
        isNoteTile,
        noteTileRelPath: isNoteTile && tc.file ? tc.file : null,
        memberPaths: tileFiles.map((f) => f.path),
        tileProps: tileProps[tileKey] || {},
        tileWidth: pos.w,
        tileHeight: pos.h
      });
    });
    const propsBtn = titleRow.createEl("button", { type: "button", cls: "repo-board-tile-props-btn", text: "⚙", title: "Tile properties" });
    propsBtn.addEventListener("mousedown", (e) => { e.stopPropagation(); });
    propsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedTile(tileKey);
      openTilePropertiesModal({
        app,
        folderPath,
        tileKey,
        tileName: tileName === UNGROUPED ? "Ungrouped" : tileName,
        isNoteTile,
        allMemberFiles,
        tilePropsRef: tileProps,
        tilesList: manualTiles,
        autoFolderTileNames,
        tileConfigSnapshot: { ...tileConfig },
        getSizes: () => {
          const o = {};
          for (const [k, p] of Object.entries(layout)) {
            o[k] = { w: Math.round(p.w), h: Math.round(p.h), x: Math.round(p.x), y: Math.round(p.y) };
          }
          return o;
        },
        onDone: (action) => {
          if (action === "save") pendingBoardSelectTileKey = tileKey;
          renderVaultView();
        }
      });
    });
    if (isNoteTile) {
      const embedWrap = tileBox.createEl("div", { cls: "repo-board-tile-embed-wrap" });
      const embedEl = embedWrap.createEl("div", { cls: "repo-board-tile-embed markdown-preview-view" });
      const embedPath = folderPath + "/" + tc.file;
      const embedFile = app.vault.getAbstractFileByPath(embedPath);
      if (embedFile && embedFile.extension === "md") {
        renderMarkdownIntoEl(embedEl, embedFile);
      } else {
        embedEl.createEl("div", { cls: "repo-board-tile-embed-error", text: "Missing note: " + (tc.file || "") });
      }
    } else {
      const list = tileBox.createEl("div", { cls: "repo-board-tile-list" });
      for (const f of tileFiles) {
        const item = list.createEl("div", { cls: "repo-board-tile-item" });
        item.dataset.path = f.path;
        item.draggable = editMode;
        const link = item.createEl("a", { href: f.path, text: displayStemForBoardFile(f), cls: "internal-link" });
        link.setAttribute("data-href", f.path);
        if (isBoardPdfFile(f)) {
          item.createEl("span", { cls: "repo-board-file-kind", text: "PDF" });
          link.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await openVaultFileInActiveLeaf(f.path);
          });
        }
        item.addEventListener("dragstart", (e) => {
          if (!editMode) return;
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", f.path);
          item.classList.add("repo-board-item-dragging");
        });
        item.addEventListener("dragend", () => item.classList.remove("repo-board-item-dragging"));
      }
    }

    tileBox.addEventListener("mousemove", (e) => {
        const rect = tileBox.getBoundingClientRect();
        const pad = 10;
        const nearLeft = e.clientX - rect.left < pad;
        const nearRight = rect.right - e.clientX < pad;
        const nearTop = e.clientY - rect.top < pad;
        const nearBottom = rect.bottom - e.clientY < pad;
        tileBox.classList.toggle("repo-board-tile-border-near", nearLeft || nearRight || nearTop || nearBottom);
      });
    tileBox.addEventListener("mouseleave", () => tileBox.classList.remove("repo-board-tile-border-near"));
    const corners = ["nw", "ne", "sw", "se"];
    for (const corner of corners) {
      const handle = tileBox.createEl("div", { cls: "repo-board-resize-handle repo-board-resize-" + corner });
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const sX = parseInt(tileBox.style.left, 10) || 0;
        const sY = parseInt(tileBox.style.top, 10) || 0;
        const sW = parseInt(tileBox.style.width, 10) || defW;
        const sH = parseInt(tileBox.style.height, 10) || defH;
        const minW = 120, minH = 80;
        function onMove(ev) {
          const dx = ev.clientX - startMouseX;
          const dy = ev.clientY - startMouseY;
          const cw = canvasInnerWidth();
          let x = sX, y = sY, w = sW, h = sH;
          if (corner === "se") {
            w = Math.max(minW, sW + dx);
            h = Math.max(minH, sH + dy);
          } else if (corner === "sw") {
            w = Math.max(minW, sW - dx);
            h = Math.max(minH, sH + dy);
            x = sX + sW - w;
          } else if (corner === "ne") {
            w = Math.max(minW, sW + dx);
            h = Math.max(minH, sH - dy);
            y = sY + sH - h;
          } else {
            w = Math.max(minW, sW - dx);
            h = Math.max(minH, sH - dy);
            x = sX + sW - w;
            y = sY + sH - h;
          }
          w = Math.min(w, cw - EDGE - x);
          w = Math.max(minW, w);
          x = Math.max(EDGE, Math.min(x, cw - EDGE - w));
          y = Math.max(EDGE, y);
          tileBox.style.width = w + "px";
          tileBox.style.height = h + "px";
          tileBox.style.left = x + "px";
          tileBox.style.top = y + "px";
          layout[tileKey] = { ...layout[tileKey], x, y, w, h };
          const neededBottom = y + h + EDGE;
          const curMin = parseFloat(boardContent.style.minHeight) || boardContent.clientHeight || 400;
          if (neededBottom > curMin) boardContent.style.minHeight = neededBottom + "px";
          tileBox.classList.add("repo-board-tile-resizing");
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          tileBox.classList.remove("repo-board-tile-resizing");
          let w = parseInt(tileBox.style.width, 10);
          let h = parseInt(tileBox.style.height, 10);
          let x = parseInt(tileBox.style.left, 10);
          let y = parseInt(tileBox.style.top, 10);
          const cw = canvasInnerWidth();
          w = Math.min(Math.max(minW, w), cw - EDGE - x);
          w = Math.max(minW, w);
          x = Math.max(EDGE, Math.min(x, cw - EDGE - w));
          y = Math.max(EDGE, y);
          h = Math.max(minH, h);
          tileBox.style.width = w + "px";
          tileBox.style.height = h + "px";
          tileBox.style.left = x + "px";
          tileBox.style.top = y + "px";
          if (w && h) {
            layout[tileKey] = { ...layout[tileKey], x, y, w, h };
            ensureCanvasHeightFromLayout();
            saveDirtyLayout();
          }
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }
  }
  ensureCanvasHeightFromLayout();
  if (boardEditMode) applyEditMode();
  if (pendingBoardSelectTileKey) {
    const k = pendingBoardSelectTileKey;
    pendingBoardSelectTileKey = null;
    setSelectedTile(k);
  }
}

async function renderVaultView() {
  viewRepository.empty();
  const depth = breadcrumbPath.length;
  const currentFolder = buildCurrentPath();
  renderBreadcrumb(breadcrumbContainer);
  if (depth < 3) {
    renderLayerGrid(viewRepository, currentFolder, depth);
    syncRepoEditButtonForContext();
  } else {
    repoEditBtn.textContent = "Edit";
    await renderBoard(viewRepository, currentFolder);
    repoEditBtn.disabled = false;
  }
  updateNavButtons();
}

async function showExistingNotesPickerModal(folderPath, initialSelected, onDone) {
  const UNGROUPED = "__ungrouped__";
  const cfg = await getBoardConfig(folderPath);
  let tileList = [...(cfg.tiles || [])];
  const autoNames = listAutoFolderTileNames(folderPath);
  for (const name of autoNames) {
    if (!tileList.some((x) => x !== UNGROUPED && String(x).toLowerCase() === name.toLowerCase())) {
      tileList.push(name);
    }
  }
  if (!tileList.includes(UNGROUPED)) tileList = [UNGROUPED, ...tileList];
  const { allFiles: files } = collectBoardMarkdownFiles(folderPath);
  const fileTiles = new Map();
  for (const f of files) fileTiles.set(f.path, effectiveBoardTileForFile(f.path, folderPath));
  const selected = new Set(initialSelected);

  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-picker-modal-wide" });
  modal.createEl("h4", { text: "Add notes from existing tiles", cls: "repo-picker-title" });
  const scroll = modal.createEl("div", { cls: "repo-picker-columns" });
  for (const tileName of tileList) {
    const col = scroll.createEl("div", { cls: "repo-picker-col" });
    col.createEl("div", { cls: "repo-picker-col-title", text: tileName === UNGROUPED ? "Ungrouped" : tileName });
    const inTile = files.filter((f) => tileNameMatchesBoard(fileTiles.get(f.path), tileName, f.path, folderPath));
    for (const f of inTile) {
      const row = col.createEl("button", { type: "button", cls: "repo-picker-note-row" });
      const mark = row.createEl("span", { cls: "repo-picker-check", text: selected.has(f.path) ? "✓" : "" });
      const nameEl = row.createEl("span", { cls: "repo-picker-note-name" });
      nameEl.appendChild(document.createTextNode(displayStemForBoardFile(f)));
      if (isBoardPdfFile(f)) nameEl.createEl("span", { cls: "repo-board-file-kind", text: "PDF" });
      row.addEventListener("click", () => {
        if (selected.has(f.path)) {
          selected.delete(f.path);
          mark.textContent = "";
          row.classList.remove("repo-picker-note-row-selected");
        } else {
          selected.add(f.path);
          mark.textContent = "✓";
          row.classList.add("repo-picker-note-row-selected");
        }
      });
      if (selected.has(f.path)) row.classList.add("repo-picker-note-row-selected");
    }
    if (inTile.length === 0) col.createEl("div", { cls: "repo-picker-empty", text: "—" });
  }
  const btnRow = modal.createEl("div", { cls: "ideas-modal-actions repo-picker-actions" });
  const cancelBtn = btnRow.createEl("button", { cls: "ideas-btn", text: "Cancel" });
  const okBtn = btnRow.createEl("button", { cls: "ideas-btn ideas-btn-final", text: "Done" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  okBtn.addEventListener("click", () => {
    onDone(selected);
    overlay.remove();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function showCreatePopup() {
  const depth = breadcrumbPath.length;
  const currentFolder = buildCurrentPath();
  if (depth < 3) {
    showCreateLayerModal(currentFolder, renderVaultView);
    return;
  }
  const UNGROUPED = "__ungrouped__";
  const overlay = document.body.createEl("div", { cls: "links-search-overlay" });
  const modal = overlay.createEl("div", { cls: "links-search-modal repo-create-modal" });

  const headerRow = modal.createEl("div", { cls: "repo-create-header-row" });
  headerRow.createEl("span", { cls: "repo-create-title", text: "Create" });
  const modeToggle = headerRow.createEl("div", { cls: "repo-create-mode-toggle" });
  const btnTileMode = modeToggle.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link", text: "Tile" });
  const btnNoteMode = modeToggle.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link", text: "Note" });

  const nameField = modal.createEl("div", { cls: "repo-create-name-field" });
  nameField.createEl("label", { cls: "repo-create-label", text: "Name", attr: { for: "repo-create-name-input" } });
  const nameInput = nameField.createEl("input", {
    cls: "links-search-input repo-create-name",
    attr: { id: "repo-create-name-input", type: "text", autocomplete: "off" },
    placeholder: "Tile name..."
  });

  const tileSection = modal.createEl("div", { cls: "repo-create-tile-section" });
  const subtypeRow = tileSection.createEl("div", { cls: "repo-create-subtype-row" });
  const btnGrouped = subtypeRow.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link", text: "Grouped notes" });
  const btnSingle = subtypeRow.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link", text: "Single note" });

  const groupOpts = tileSection.createEl("div", { cls: "repo-create-group-opts" });
  const addExistingBtn = groupOpts.createEl("button", { type: "button", cls: "ideas-btn ideas-btn-link", text: "Add existing notes…" });
  const selectedSummary = groupOpts.createEl("div", { cls: "repo-create-summary", text: "" });

  const singleOpts = tileSection.createEl("div", { cls: "repo-create-single-opts" });
  singleOpts.createEl("label", { cls: "repo-create-label", text: "Note to show in tile" });
  const singleFileSelect = singleOpts.createEl("select", { cls: "ideas-create-tile-select repo-create-fullwidth" });

  const noteSection = modal.createEl("div", { cls: "repo-create-note-section" });
  noteSection.createEl("label", { cls: "repo-create-label", text: "Assign to tile" });
  const noteTileSelect = noteSection.createEl("select", { cls: "ideas-create-tile-select repo-create-fullwidth" });

  const btnRow = modal.createEl("div", { cls: "ideas-modal-actions repo-create-actions" });
  const cancelBtn = btnRow.createEl("button", { cls: "ideas-btn", text: "Cancel" });
  const createBtn = btnRow.createEl("button", { cls: "ideas-btn ideas-btn-final", text: "Create" });

  let rootMode = "tile";
  let tileSubtype = "group";
  let selectedExistingPaths = new Set();

  function refresh() {
    tileSection.style.display = rootMode === "tile" ? "" : "none";
    noteSection.style.display = rootMode === "note" ? "" : "none";
    btnTileMode.classList.toggle("active", rootMode === "tile");
    btnNoteMode.classList.toggle("active", rootMode === "note");
    subtypeRow.style.display = rootMode === "tile" ? "flex" : "none";
    groupOpts.style.display = rootMode === "tile" && tileSubtype === "group" ? "" : "none";
    singleOpts.style.display = rootMode === "tile" && tileSubtype === "single" ? "" : "none";
    nameInput.placeholder = rootMode === "note" ? "Note name..." : "Tile name...";
    btnGrouped.classList.toggle("active", tileSubtype === "group");
    btnSingle.classList.toggle("active", tileSubtype === "single");
    const n = selectedExistingPaths.size;
    selectedSummary.textContent = n ? "Selected " + n + " note(s) to assign" : "";
  }

  btnTileMode.addEventListener("click", () => { rootMode = "tile"; refresh(); });
  btnNoteMode.addEventListener("click", () => { rootMode = "note"; refresh(); });
  btnGrouped.addEventListener("click", () => { tileSubtype = "group"; refresh(); });
  btnSingle.addEventListener("click", () => { tileSubtype = "single"; refresh(); });
  addExistingBtn.addEventListener("click", async () => {
    await showExistingNotesPickerModal(currentFolder, selectedExistingPaths, (set) => {
      selectedExistingPaths = set;
      refresh();
    });
  });

  (async () => {
    const cfg = await getBoardConfig(currentFolder);
    let tileList = [...(cfg.tiles || [])];
    const autoN = listAutoFolderTileNames(currentFolder);
    for (const n of autoN) {
      if (!tileList.some((x) => x !== UNGROUPED && String(x).toLowerCase() === n.toLowerCase())) {
        tileList.push(n);
      }
    }
    if (!tileList.includes(UNGROUPED)) tileList = [UNGROUPED, ...tileList];
    for (const g of tileList) {
      const opt = noteTileSelect.createEl("option");
      opt.value = g === UNGROUPED ? "" : g;
      opt.textContent = g === UNGROUPED ? "Ungrouped" : g;
    }
    const { allFiles } = collectBoardMarkdownFiles(currentFolder);
    const defOpt = singleFileSelect.createEl("option");
    defOpt.value = "";
    defOpt.textContent = "— Choose a note —";
    for (const f of allFiles.filter((x) => x.extension === "md")) {
      const opt = singleFileSelect.createEl("option");
      opt.value = f.name;
      opt.textContent = (f.name || "").replace(/\.md$/, "");
    }
  })();

  btnTileMode.classList.add("active");
  btnGrouped.classList.add("active");
  refresh();

  cancelBtn.addEventListener("click", () => overlay.remove());
  createBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) { new Notice("Enter a name"); return; }
    const safe = (name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled");

    if (rootMode === "note") {
      const safeName = safe.endsWith(".md") ? safe : safe + ".md";
      const newPath = currentFolder + "/" + safeName;
      if (app.vault.getAbstractFileByPath(newPath)) { new Notice("Note already exists"); return; }
      await ensureFolder(currentFolder);
      const file = await app.vault.create(newPath, "---\n---\n\n");
      const tileVal = noteTileSelect.value || null;
      if (tileVal) await setFileTileByFile(file, tileVal);
      overlay.remove();
      new Notice("Created");
      if (file) await app.workspace.getLeaf().openFile(file);
      renderVaultView();
      return;
    }

    const cfg = await getBoardConfig(currentFolder);
    const tileList = cfg.tiles || [];
    const sizes = cfg.sizes || {};
    const tileConfig = { ...(cfg.tileConfig || {}) };
    if (tileList.includes(name)) { new Notice("Tile already exists"); return; }
    if (listAutoFolderTileNames(currentFolder).some((n) => n.toLowerCase() === name.toLowerCase())) {
      new Notice("That name is already used by a folder on this board.");
      return;
    }

    if (tileSubtype === "single") {
      const fname = singleFileSelect.value;
      if (!fname) { new Notice("Choose a note for this tile"); return; }
      const newTiles = [...tileList, name];
      const tk = name === UNGROUPED ? "__ungrouped__" : name;
      tileConfig[tk] = { kind: "note", file: fname };
      await saveBoardConfig(currentFolder, { tiles: newTiles, sizes, tileConfig, tileProps: cfg.tileProps || {} });
      overlay.remove();
      new Notice("Tile created");
      boardEditMode = true;
      renderVaultView();
      return;
    }

    const newTiles = [...tileList, name];
    const tk = name === UNGROUPED ? "__ungrouped__" : name;
    tileConfig[tk] = { kind: "group" };
    await saveBoardConfig(currentFolder, { tiles: newTiles, sizes, tileConfig, tileProps: cfg.tileProps || {} });
    for (const p of selectedExistingPaths) {
      const file = app.vault.getAbstractFileByPath(p);
      if (file && file.extension === "md") await setFileTileByFile(file, name);
    }
    overlay.remove();
    new Notice(selectedExistingPaths.size ? "Tile created and notes assigned" : "Tile created");
    boardEditMode = true;
    renderVaultView();
  });

  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createBtn.click(); });
  focusModalTextInput(nameInput);
}

// Unified top bar: [New|Repository] [Home] [‹ ›] layer breadcrumb (flex) — [Edit] [+]
const topBar = container.createEl("div", { cls: "repo-top-bar repo-top-bar-unified" });
const barControlsLeft = topBar.createEl("div", { cls: "repo-bar-controls-left" });
const sliderInner = barControlsLeft.createEl("div", { cls: "repo-slider-inner" });
const btnNewDev = sliderInner.createEl("button", { type: "button", cls: "repo-slider-btn active", text: "New" });
const btnRepo = sliderInner.createEl("button", { type: "button", cls: "repo-slider-btn", text: "Repository" });
const homeWrap = topBar.createEl("div", { cls: "repo-bar-home-wrap" });
const homeBtn = homeWrap.createEl("button", { type: "button", cls: "repo-nav-btn repo-nav-home", title: "Home", text: "⌂" });
const barNavArrows = topBar.createEl("div", { cls: "repo-bar-nav-arrows" });
backBtn = barNavArrows.createEl("button", { type: "button", cls: "repo-nav-btn repo-nav-back", title: "Back", text: "‹" });
fwdBtn = barNavArrows.createEl("button", { type: "button", cls: "repo-nav-btn repo-nav-fwd", title: "Forward", text: "›" });
const breadcrumbContainer = topBar.createEl("div", { cls: "repo-bar-breadcrumb repo-bar-breadcrumb-zone" });
const barRepoActions = topBar.createEl("div", { cls: "repo-bar-repo-actions" });
const repoEditBtn = barRepoActions.createEl("button", { type: "button", text: "Edit", cls: "ideas-btn ideas-btn-link repo-top-edit" });
const repoAddBtn = barRepoActions.createEl("button", { type: "button", text: "+", cls: "ideas-btn ideas-btn-final ideas-add-btn repo-top-add" });
repoEditBtn.style.display = "";
repoEditBtn.disabled = true;
repoEditBtn.classList.add("repo-top-edit-static");
repoAddBtn.addEventListener("click", () => {
  if (getCurrentViewId() === "new-dev") {
    showNewNoteModalForFolder(REPO_INCOMING);
  } else {
    showCreatePopup();
  }
});

viewNewDev = container.createEl("div", { cls: "repo-view repo-view-new-dev" });
viewRepository = container.createEl("div", { cls: "repo-view repo-view-repository" });
viewRepository.style.display = "none";

function saveSessionState() {
  try {
    sessionStorage.setItem(REPO_SESSION_KEY, JSON.stringify({
      navHistory,
      navHistoryIndex,
      breadcrumb: [...breadcrumbPath],
      view: getCurrentViewId(),
      boardEditMode
    }));
  } catch (e) {}
}

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(REPO_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function syncRepoEditButtonForContext() {
  repoEditBtn.style.display = "";
  const depth = breadcrumbPath.length;
  const onRepo = getCurrentViewId() === "repository";
  if (!onRepo) {
    repoEditBtn.disabled = true;
    repoEditBtn.textContent = "Edit";
    repoEditBtn.onclick = () => new Notice("Open Repository and a board to edit layout.");
    return;
  }
  if (depth < 3) {
    repoEditBtn.disabled = true;
    repoEditBtn.textContent = "Edit";
    repoEditBtn.onclick = () => new Notice("Open a board (3rd layer) to edit tiles.");
    return;
  }
}

async function showView(which, skipHistoryPush) {
  if (which === "new-dev") {
    viewNewDev.style.display = "";
    viewRepository.style.display = "none";
    repoAddBtn.style.display = "";
    btnNewDev.classList.add("active");
    btnRepo.classList.remove("active");
    breadcrumbContainer.empty();
    breadcrumbContainer.classList.add("repo-bar-breadcrumb-hidden");
    syncRepoEditButtonForContext();
  } else {
    viewNewDev.style.display = "none";
    viewRepository.style.display = "";
    repoAddBtn.style.display = "";
    btnRepo.classList.add("active");
    btnNewDev.classList.remove("active");
    breadcrumbContainer.classList.remove("repo-bar-breadcrumb-hidden");
    await renderVaultView();
  }
  if (!skipHistoryPush) pushNavState();
  else saveSessionState();
}

homeBtn.addEventListener("click", async () => {
  breadcrumbPath = [];
  await showView("repository", true);
  pushNavState();
});
backBtn.addEventListener("click", async () => {
  if (navHistoryIndex <= 0) return;
  navHistoryIndex--;
  await applyNavState(navHistory[navHistoryIndex]);
});
fwdBtn.addEventListener("click", async () => {
  if (navHistoryIndex >= navHistory.length - 1) return;
  navHistoryIndex++;
  await applyNavState(navHistory[navHistoryIndex]);
});

btnNewDev.addEventListener("click", async () => { await showView("new-dev"); });
btnRepo.addEventListener("click", async () => { await showView("repository"); });

const sess = loadSessionState();
if (sess && Array.isArray(sess.navHistory) && sess.navHistory.length > 0) {
  navHistory = sess.navHistory;
  navHistoryIndex = Math.min(Math.max(0, sess.navHistoryIndex ?? 0), navHistory.length - 1);
  const cur = navHistory[navHistoryIndex];
  if (cur) {
    breadcrumbPath = [...(cur.breadcrumb || [])];
    if (sess.boardEditMode === true) boardEditMode = true;
    await applyNavState(cur);
  } else {
    navHistory = [{ view: "new-dev", breadcrumb: [] }];
    navHistoryIndex = 0;
    breadcrumbPath = [];
    await showView("new-dev", true);
  }
} else {
  navHistory = [{ view: "new-dev", breadcrumb: [] }];
  navHistoryIndex = 0;
  breadcrumbPath = [];
  await showView("new-dev", true);
}
updateNavButtons();

// New view: single New/ folder — untagged vs #developing subsections
let repoNewPages = [];
try {
  repoNewPages = Array.from(dv.pages('"' + REPO_INCOMING + '"'));
} catch (e) {}
const freshPages = repoNewPages.filter(p => !pageHasDevelopingTag(p));
const developingPages = repoNewPages.filter(p => pageHasDevelopingTag(p));
createSection("New", REPO_INCOMING, freshPages, viewNewDev, "mark-developing", { showAddButton: false });
createSection("Developing", REPO_INCOMING, developingPages, viewNewDev, "mark-new", { showAddButton: false });
```
