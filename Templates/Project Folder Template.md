<%*
const projectName = await tp.system.prompt("Project Name (used for folder and main note)", "");
if (!projectName) {
  new Notice("Project creation cancelled.");
  return;
}

// Initial status is metadata only (no Started/Unstarted folders)
const statusOptions = ["Started", "Unstarted"];
const status = await tp.system.suggester(statusOptions, statusOptions, true, "Initial project status (metadata):");
if (!status) {
  new Notice("Status selection cancelled.");
  return;
}

// Prompt for initial priority (1-10 scale)
const priorityLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const initialPriority = await tp.system.suggester(priorityLevels, priorityLevels, true, "Initial Priority (1-10)?");

// All projects live directly under Data/Tools/Projects/[Name]/
const basePath = "Data/Tools/Projects/";
const projectFolder = basePath + projectName + "/";

if (!(await app.vault.adapter.exists(projectFolder))) {
  await app.vault.createFolder(projectFolder);
}

const mainNotePath = projectFolder + projectName + ".md";

const mainContent = [
  "---",
  "status: " + status.toLowerCase(),
  "priority: " + initialPriority,
  "tags:",
  "  - project",
  "  - " + status.toLowerCase(),
  "dashboard-include: true",
  'objective: ""',
  "---",
  "",
  "```dataviewjs",
  "(() => {",
  "const app = this.app;",
  "const page = dv.current();",
  "if (!page || !page.file) return;",
  "const filePath = page.file.path;",
  "const folderPath = filePath.replace(/\\/[^/]+$/, '');",
  "const overviewCard = dv.container.createEl('div', { cls: 'missions-overview-card' });",
  "const overviewHeader = overviewCard.createEl('div', { cls: 'missions-overview-header' });",
  "overviewHeader.createEl('div', { cls: 'missions-overview-label', text: 'Objective' });",
  "const statusLabel = (page.status || 'started').toLowerCase();",
  "const displayStatus = statusLabel === 'started' ? 'Started' : 'Unstarted';",
  "const statusBtnWrap = overviewHeader.createEl('div', { cls: 'missions-status-btn-wrap' });",
  "const statusBtn = statusBtnWrap.createEl('button', { cls: 'missions-status-btn', text: displayStatus });",
  "const modalOverlay = document.body.createEl('div', { cls: 'missions-status-modal-overlay' });",
  "const modal = modalOverlay.createEl('div', { cls: 'missions-status-modal' });",
  "modal.createEl('div', { cls: 'missions-status-modal-title', text: 'Change Status' });",
  "['Started', 'Unstarted'].forEach(function(label) {",
  "  const btn = modal.createEl('button', { cls: 'missions-status-modal-btn', text: label });",
  "  if (label === displayStatus) btn.addClass('active');",
  "  btn.addEventListener('click', async function() {",
  "    modalOverlay.classList.remove('open');",
  "    const file = app.vault.getAbstractFileByPath(filePath);",
  "    if (!file || file.extension !== 'md') return;",
  "    const newStatus = label.toLowerCase();",
  "    await app.fileManager.processFrontMatter(file, function(fm) { fm.status = newStatus; });",
  "    new Notice('Status set to ' + label);",
  "    location.reload();",
  "  });",
  "});",
  "modal.createEl('hr', { cls: 'missions-status-modal-divider' });",
  "function todayIso() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }",
  "async function doArchive(dest, kind) {",
  "  modalOverlay.classList.remove('open');",
  "  const note = app.vault.getAbstractFileByPath(filePath);",
  "  if (note && note.extension === 'md') {",
  "    await app.fileManager.processFrontMatter(note, (fm) => {",
  "      if (kind === 'completed') {",
  "        fm.status = 'completed';",
  "        fm['completed-on'] = todayIso();",
  "      } else if (kind === 'scrapped') {",
  "        fm.status = 'scrapped';",
  "      }",
  "    });",
  "  }",
  "  const folder = app.vault.getAbstractFileByPath(folderPath);",
  "  if (!folder) { new Notice('Folder not found'); return; }",
  "  const name = folderPath.split('/').pop();",
  "  const target = dest + '/' + name;",
  "  async function ensureDestFolder(fullPath) { if (app.vault.getAbstractFileByPath(fullPath)) return; const segs = fullPath.split('/'); let acc = ''; for (const s of segs) { acc = acc ? acc + '/' + s : s; if (!app.vault.getAbstractFileByPath(acc)) await app.vault.createFolder(acc); } }",
  "  await ensureDestFolder(dest);",
  "  await app.vault.rename(folder, target);",
  "  new Notice('Archived to ' + dest.split('/').pop());",
  "  location.reload();",
  "}",
  "const completedBtn = modal.createEl('button', { cls: 'missions-status-modal-btn', text: 'Archive — Completed' });",
  "completedBtn.addEventListener('click', async function() { await doArchive('z_archive/Tools/Projects/Completed', 'completed'); });",
  "const scrappedBtn = modal.createEl('button', { cls: 'missions-status-modal-btn missions-modal-scrap', text: 'Archive — Scrapped' });",
  "scrappedBtn.addEventListener('click', async function() { await doArchive('z_archive/Tools/Projects/Scrapped', 'scrapped'); });",
  "statusBtn.addEventListener('click', function(e) { e.stopPropagation(); modalOverlay.classList.add('open'); });",
  "modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });",
  "const overviewContent = overviewCard.createEl('div', { cls: 'missions-overview-content' });",
  "overviewContent.setAttribute('contenteditable', 'true');",
  "overviewContent.setAttribute('data-placeholder', \"What's the objective?\");",
  "overviewContent.textContent = page.objective || '';",
  "if (!overviewContent.textContent) overviewContent.classList.add('empty');",
  "overviewContent.addEventListener('input', function(){ this.classList.toggle('empty', !this.textContent.trim()); });",
  "overviewContent.addEventListener('blur', async function() {",
  "  const file = app.vault.getAbstractFileByPath(filePath);",
  "  if (!file) return;",
  "  await app.fileManager.processFrontMatter(file, (fm) => { fm.objective = overviewContent.textContent.trim(); });",
  "});",
  "})();",
  "```",
  "",
  "```dataviewjs",
  "(async () => {",
  "const app = this.app;",
  "const container = typeof this.container !== \"undefined\" ? this.container : dv.container;",
  "const page = dv.current();",
  "if (!page || !page.file) return;",
  "let fn = globalThis.__projectAgendaPushWork;",
  "if (typeof fn !== \"function\") {",
  "  try {",
  "    const tp = app.plugins.plugins[\"templater-obsidian\"];",
  "    const usf = tp && tp.templater && tp.templater.functions_generator && tp.templater.functions_generator.user_functions && tp.templater.functions_generator.user_functions.user_script_functions;",
  "    if (usf && typeof usf.generate_user_script_functions === \"function\") {",
  "      await usf.generate_user_script_functions();",
  "    }",
  "    fn = globalThis.__projectAgendaPushWork;",
  "  } catch (e) { console.error(e); }",
  "}",
  "if (typeof fn !== \"function\") {",
  "  container.createEl(\"p\", { text: \"Agenda push: enable Templater, User Scripts folder = Templates, Templates/project_agenda_push.js present. Reload if needed.\", cls: \"mod-warning\" });",
  "  return;",
  "}",
  "const tpStub = { app, file: app.vault.getAbstractFileByPath(page.file.path) };",
  "if (!tpStub.file) return;",
  "void fn(tpStub, { container, page }).catch((e) => console.error(e));",
  "})();",
  "```",
  "",
  "- [ ] Main task description  ",
  "  - [ ] Subtask description  ",
  "",
  "```dataviewjs",
  "(() => {",
  "const app = this.app;",
  "const container = (typeof this.container !== 'undefined' ? this.container : dv.container);",
  "const page = dv.current();",
  "if (!page || !page.file) return;",
  "const filePath = page.file.path;",
  "const folderPath = filePath.replace(/\\/[^/]+$/, '');",
  "",
  "function collectAllFiles(dir, out) {",
  "  const folder = app.vault.getAbstractFileByPath(dir);",
  "  if (!folder || !folder.children) return;",
  "  for (const c of folder.children) {",
  "    if (c.path === filePath) continue;",
  "    if (c.children) collectAllFiles(c.path, out);",
  "    else out.push(c.path);",
  "  }",
  "}",
  "const paths = [];",
  "collectAllFiles(folderPath, paths);",
  "paths.sort((a, b) => a.localeCompare(b));",
  "",
  "const wrap = container.createEl('div', { cls: 'ideas-section' });",
  "const header = wrap.createEl('div', { cls: 'ideas-section-header' });",
  "const headerRow = header.createEl('div', { cls: 'ideas-section-header-row' });",
  "const titleRow = headerRow.createEl('div', { cls: 'project-resources-title-row' });",
  "titleRow.style.display = 'flex';",
  "titleRow.style.alignItems = 'center';",
  "titleRow.style.gap = '0.5em';",
  "titleRow.createEl('h2', { cls: 'ideas-section-title', text: 'Resources' });",
  "const addBtn = titleRow.createEl('button', { type: 'button', text: '+', cls: 'ideas-add-btn ideas-btn' });",
  "addBtn.title = 'New note in this folder';",
  "addBtn.addEventListener('click', async () => {",
  "  let base = 'Untitled';",
  "  let newPath = folderPath + '/' + base + '.md';",
  "  let n = 2;",
  "  while (app.vault.getAbstractFileByPath(newPath)) {",
  "    newPath = folderPath + '/' + base + ' ' + n + '.md';",
  "    n++;",
  "  }",
  "  await app.vault.create(newPath, '---\\n---\\n\\n');",
  "  new Notice('Created: ' + newPath.split('/').pop());",
  "  const f = app.vault.getAbstractFileByPath(newPath);",
  "  if (f) await app.workspace.getLeaf().openFile(f);",
  "});",
  "const list = wrap.createEl('div', { cls: 'project-resources-list' });",
  "",
  "if (paths.length === 0) {",
  "  const empty = list.createEl('span', { cls: 'project-resources-empty' });",
  "  empty.textContent = 'No other files in this project folder yet.';",
  "  empty.style.color = 'var(--text-muted)';",
  "} else {",
  "  paths.forEach((p) => {",
  "    const row = list.createEl('div', { cls: 'project-resources-item' });",
  "    const rel = p.startsWith(folderPath + '/') ? p.slice(folderPath.length + 1) : p;",
  "    const a = row.createEl('a', { text: rel, cls: 'internal-link' });",
  "    a.href = p;",
  "    a.setAttribute('data-href', p);",
  "  });",
  "}",
  "})();",
  "```"
].join("\n");

// Create main note
await tp.file.create_new(mainContent, projectName, false, projectFolder);

// Open the new note
const newFile = app.vault.getAbstractFileByPath(mainNotePath);
if (newFile) {
  await app.workspace.getLeaf().openFile(newFile);
}

new Notice(`Project "${projectName}" created (status: ${status}, metadata only).`);
%>
