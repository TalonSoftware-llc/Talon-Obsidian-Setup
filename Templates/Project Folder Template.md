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
  "async function doArchive(dest) {",
  "  modalOverlay.classList.remove('open');",
  "  const folder = app.vault.getAbstractFileByPath(folderPath);",
  "  if (!folder) { new Notice('Folder not found'); return; }",
  "  const name = folderPath.split('/').pop();",
  "  const target = dest + '/' + name;",
  "  if (!app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);",
  "  await app.vault.rename(folder, target);",
  "  new Notice('Archived to ' + dest.split('/').pop());",
  "  location.reload();",
  "}",
  "const completedBtn = modal.createEl('button', { cls: 'missions-status-modal-btn', text: 'Archive — Completed' });",
  "completedBtn.addEventListener('click', async function() { await doArchive('z_archive/Projects/Completed'); });",
  "const scrappedBtn = modal.createEl('button', { cls: 'missions-status-modal-btn missions-modal-scrap', text: 'Archive — Scrapped' });",
  "scrappedBtn.addEventListener('click', async function() { await doArchive('z_archive/Projects/Scrapped'); });",
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
  "## Tasks",
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
