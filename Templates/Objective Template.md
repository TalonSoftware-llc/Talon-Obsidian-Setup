<%*
const { missionName, objective } = await new Promise((resolve) => {
  const overlay = document.body.createEl("div", { cls: "objective-new-overlay" });
  const modal = overlay.createEl("div", { cls: "objective-new-modal" });
  modal.createEl("h4", { cls: "objective-new-heading", text: "New Objective" });
  const titleWrap = modal.createEl("div", { cls: "objective-new-field" });
  titleWrap.createEl("label", { text: "Title", attr: { for: "objective-new-title" } });
  const titleInput = titleWrap.createEl("input", {
    type: "text",
    cls: "objective-new-input",
    attr: { id: "objective-new-title", placeholder: "e.g. Outreach, Training" }
  });
  const overviewWrap = modal.createEl("div", { cls: "objective-new-field" });
  overviewWrap.createEl("label", { text: "Overview", attr: { for: "objective-new-overview" } });
  const overviewInput = overviewWrap.createEl("textarea", {
    cls: "objective-new-textarea",
    attr: { id: "objective-new-overview", rows: "4", placeholder: "Specific, measurable objective" }
  });
  const btnRow = modal.createEl("div", { cls: "objective-new-actions" });
  const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
  const submitBtn = btnRow.createEl("button", {
    type: "button",
    cls: "missions-status-modal-btn objective-new-submit",
    text: "Submit"
  });
  function finishCancelled() {
    overlay.remove();
    resolve({ missionName: null, objective: "" });
  }
  cancelBtn.addEventListener("click", finishCancelled);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) finishCancelled();
  });
  submitBtn.addEventListener("click", () => {
    const name = titleInput.value.trim();
    if (!name) {
      new Notice("Enter a title.");
      return;
    }
    overlay.remove();
    resolve({ missionName: name, objective: overviewInput.value.trim() });
  });
  overviewInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitBtn.click();
    }
  });
  titleInput.focus();
});

if (!missionName) {
  new Notice("Cancelled.");
  return;
}

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const todayIso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
const startStr = `${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;

const endDateIso = await new Promise((resolve) => {
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let selectedIso = null;

  const overlay = document.body.createEl("div", { cls: "agenda-date-picker-overlay" });
  const modal = overlay.createEl("div", { cls: "agenda-date-picker-modal mission-calendar-modal" });
  modal.createEl("h4", { text: "Select end date" });
  const header = modal.createEl("div", { cls: "mission-calendar-header" });
  const prevBtn = header.createEl("button", { cls: "mission-calendar-nav", text: "‹" });
  prevBtn.type = "button";
  const titleEl = header.createEl("div", { cls: "mission-calendar-title" });
  const nextBtn = header.createEl("button", { cls: "mission-calendar-nav", text: "›" });
  nextBtn.type = "button";
  const grid = modal.createEl("div", { cls: "mission-calendar-grid" });
  const btnRow = modal.createEl("div", { cls: "agenda-date-picker-actions" });
  btnRow.style.marginTop = "1em";
  btnRow.style.display = "flex";
  btnRow.style.gap = "0.5em";
  const confirmBtn = btnRow.createEl("button", { cls: "missions-status-modal-btn", text: "Confirm" });
  confirmBtn.style.flex = "1";
  confirmBtn.style.background = "var(--interactive-accent)";
  confirmBtn.style.color = "var(--text-on-accent)";
  confirmBtn.addEventListener("click", () => {
    if (!selectedIso) {
      new Notice("Select an end date on the calendar.");
      return;
    }
    resolve(selectedIso);
    overlay.remove();
  });
  const cancelBtn = btnRow.createEl("button", { cls: "missions-status-modal-btn", text: "Cancel" });
  cancelBtn.style.flex = "1";
  cancelBtn.addEventListener("click", () => { resolve(null); overlay.remove(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) { resolve(null); overlay.remove(); } });
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); });

  function render() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDow = firstDay.getDay();
    grid.innerHTML = "";
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => {
      grid.createEl("div", { cls: "mission-calendar-dow", text: d });
    });
    for (let i = 0; i < startDow; i++) {
      grid.createEl("div", { cls: "mission-calendar-day mission-calendar-empty" });
    }
    for (let day = 1; day <= lastDay; day++) {
      const iso = viewYear + "-" + String(viewMonth + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      const isPast = iso < todayIso;
      const isSelected = selectedIso && iso === selectedIso;
      const inRange = selectedIso && !isPast && iso >= todayIso && iso <= selectedIso;
      const cell = grid.createEl("div", { cls: "mission-calendar-day" });
      const btn = cell.createEl("button", { cls: "mission-calendar-day-btn", text: String(day) });
      btn.type = "button";
      if (isPast) {
        btn.addClass("past");
      } else {
        if (inRange) btn.addClass("in-range");
        if (isSelected) btn.addClass("selected");
      }
      if (!isPast) {
        btn.addEventListener("click", () => {
          selectedIso = iso;
          render();
        });
      }
    }
    titleEl.textContent = monthNames[viewMonth] + " " + viewYear;
  }

  render();
});

if (!endDateIso) {
  new Notice("Cancelled.");
  return;
}

const endParts = endDateIso.split("-");
const endStr = `${parseInt(endParts[1],10)}/${parseInt(endParts[2],10)}/${endParts[0].slice(-2)}`;
const timeframe = startStr + " - " + endStr;

const status = "started";
/** Missions live as folders under Agenda/ (sibling to Unfinished/). Use Work/Data/... when the vault root is the parent Obsidian folder, not the Work folder. */
let basePath = "Data/Tools/Agenda/";
if (!(await app.vault.adapter.exists("Data/Tools/Agenda"))) {
  basePath = "Work/Data/Tools/Agenda/";
}
if (!(await app.vault.adapter.exists(basePath))) {
  await app.vault.createFolder(basePath);
}
const folderPath = basePath + missionName + "/";
if (!(await app.vault.adapter.exists(folderPath))) {
  await app.vault.createFolder(folderPath);
}
const addTargetBlock = [
  "```dataviewjs",
  "const app = this.app;",
  "const container = this.container || dv.container;",
  "const page = dv.current();",
  "if (!page || !page.file) { container.createEl('p', { text: 'Could not load page. Open this file directly.' }); return; }",
  "const filePath = page.file.path;",
  "const objectives = Array.isArray(page.objectives) ? page.objectives : (Array.isArray(page.complete) ? page.complete : (Array.isArray(page.targets) ? page.targets : []));",
  "const completion = page.completion || {};",
  "const now = new Date(); const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');",
  "const overviewCard = container.createEl('div', { cls: 'missions-overview-card' });",
  "const overviewHeader = overviewCard.createEl('div', { cls: 'missions-overview-header' });",
  "overviewHeader.createEl('div', { cls: 'missions-overview-label', text: 'Objective' });",
  "const displayStatus = 'Active';",
  "const statusBtnWrap = overviewHeader.createEl('div', { cls: 'missions-status-btn-wrap' });",
  "const statusBtn = statusBtnWrap.createEl('button', { cls: 'missions-status-btn', text: displayStatus });",
  "const modalOverlay = document.body.createEl('div', { cls: 'missions-status-modal-overlay' });",
  "const modal = modalOverlay.createEl('div', { cls: 'missions-status-modal' });",
  "modal.createEl('div', { cls: 'missions-status-modal-title', text: 'Mission folder' });",
  "const archiveBtn = modal.createEl('button', { cls: 'missions-status-modal-btn missions-modal-scrap', text: 'Archive' });",
  "archiveBtn.addEventListener('click', async function() {",
  "  modalOverlay.classList.remove('open');",
  "  const pathParts = filePath.split('/');",
  "  const agendaFolder = pathParts.slice(0, -1).join('/');",
  "  const dest = 'z_archive/Tools/Agenda';",
  "  const folder = app.vault.getAbstractFileByPath(agendaFolder);",
  "  if (!folder) { new Notice('Folder not found'); return; }",
  "  const name = agendaFolder.split('/').pop();",
  "  const target = dest + '/' + name;",
  "  async function ensureDestFolder(fullPath) { if (app.vault.getAbstractFileByPath(fullPath)) return; const segs = fullPath.split('/'); let acc = ''; for (const s of segs) { acc = acc ? acc + '/' + s : s; if (!app.vault.getAbstractFileByPath(acc)) await app.vault.createFolder(acc); } }",
  "  await ensureDestFolder(dest);",
  "  await app.vault.rename(folder, target);",
  "  new Notice('Archived');",
  "  location.reload();",
  "});",
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
  "function parseDateStr(str) { str = String(str).trim(); if (!str) return null; if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(str)) return new Date(str + 'T12:00:00'); const m = str.match(/^([0-9]{1,2})\\/([0-9]{1,2})\\/([0-9]{2,4})$/); if (m) { let y = parseInt(m[3], 10); if (y < 100) y += 2000; return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10)); } return null; }",
  "function getDaysInRange(tf) { if (tf == null || tf === undefined) return []; var s = ''; if (typeof tf === 'number') s = new Date(tf).toISOString().slice(0, 10); else if (typeof tf === 'object') { if (tf.toISODate) s = tf.toISODate(); else if (tf.toISOString) s = tf.toISOString().slice(0, 10); else s = String(tf); } else s = String(tf || '').trim(); if (!s) return []; var parts = s.split(' - ').map(function(x){return x.trim();}); if (parts.length === 1 && s.indexOf('-') >= 0) parts = s.split(/\\\\s*-\\\\s*/).map(function(x){return x.trim();}); var start,end; if (parts.length >= 2) { start = parseDateStr(parts[0]); end = parseDateStr(parts[1]); } else { end = parseDateStr(parts[0]); var td = new Date(today + 'T12:00:00'); start = td <= end ? td : end; end = td <= end ? end : td; } if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return []; if (start > end) { var tmp=start;start=end;end=tmp; } var days=[]; var d=new Date(start); while (d <= end) { days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); d.setDate(d.getDate() + 1); } return days; }",
  "function parseLinks(x) { if (Array.isArray(x.links) && x.links.length) return x.links.map(function(l){ return { name: String(l.name || 'Link').trim() || 'Link', url: String(l.url || '').trim() }; }).filter(function(l){ return l.url; }); if (x.link && String(x.link).trim()) return [{ name: 'Link', url: String(x.link).trim() }]; return []; }",
  "function getObjectives(p) { const t = p.objectives || p.complete || p.targets; if (!t) return []; if (Array.isArray(t)) return t.map(x => { if (typeof x === 'object' && x && x.item) { var o = { item: String(x.item).trim(), frequency: (x.frequency || 'daily').toLowerCase() }; o.startDate = x.startDate || x.startingOn || ''; o.days = Array.isArray(x.days) ? x.days : []; o.links = parseLinks(x); return o; } return { item: String(x).trim(), frequency: 'daily', startDate: '', days: [], links: [] }; }).filter(x => x.item); if (typeof t === 'string') return t.trim() ? [{ item: t.trim(), frequency: 'daily', startDate: '', days: [], links: [] }] : []; return []; }",
  "function getWeekDatesMonSun(dateStr) { var d = new Date(dateStr + 'T12:00:00'); var day = d.getDay(); var monOffset = day === 0 ? -6 : 1 - day; var mon = new Date(d); mon.setDate(d.getDate() + monOffset); var dates = []; for (var i = 0; i < 7; i++) { var x = new Date(mon); x.setDate(mon.getDate() + i); dates.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); } return dates; }",
  "function getMonthDates(dateStr) { var d = new Date(dateStr + 'T12:00:00'); var year = d.getFullYear(); var month = d.getMonth(); var last = new Date(year, month + 1, 0).getDate(); var dates = []; for (var i = 1; i <= last; i++) { dates.push(year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0')); } return dates; }",
  "function toIso(dateStr) { if (!dateStr) return ''; if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(dateStr))) return isValidDate(dateStr) ? dateStr : ''; var m = String(dateStr).match(/^([0-9]{1,2})\\/([0-9]{1,2})\\/([0-9]{2,4})$/); if (m) { var y = parseInt(m[3],10); if (y < 100) y += 2000; var iso = y + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0'); return isValidDate(iso) ? iso : ''; } return ''; }",
  "function isValidDate(dateStr) { if (!dateStr || typeof dateStr !== 'string') return false; var d = new Date(dateStr + 'T12:00:00'); if (isNaN(d.getTime())) return false; var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(); var reformed = y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0'); return reformed === dateStr.trim(); }",
  "function shouldShowObjectiveOnDate(obj, dateStr, missionStart) { var freq = (obj.frequency || 'daily').toLowerCase(); var start = (obj.startDate && toIso(obj.startDate)) || missionStart; if (!start) start = dateStr; if (dateStr < start) return false; if (freq === 'daily') return true; if (freq === 'weekly') { var s = new Date(start + 'T12:00:00').getTime(); var d = new Date(dateStr + 'T12:00:00').getTime(); var diff = Math.round((d - s) / 86400000); return diff >= 0 && diff % 7 === 0; } if (freq === 'monthly') { var ds = new Date(start + 'T12:00:00'); var dd = new Date(dateStr + 'T12:00:00'); return ds.getDate() === dd.getDate() && dateStr >= start; } if (freq === 'custom' && obj.days && obj.days.length) { var dow = new Date(dateStr + 'T12:00:00').getDay(); return obj.days.indexOf(dow) >= 0; } return false; }",
  "function isItemCompletedForDate(p, dateStr, obj) { var completion = p.completion || {}; var freq = (obj.frequency || 'daily').toLowerCase(); if (freq === 'daily') { var c = completion[dateStr]; return Array.isArray(c) && c.includes(obj.item); } if (freq === 'weekly') { var weekDates = getWeekDatesMonSun(dateStr); return weekDates.some(function(d){ var c = completion[d]; return Array.isArray(c) && c.includes(obj.item); }); } if (freq === 'monthly') { var monthDates = getMonthDates(dateStr); return monthDates.some(function(d){ var c = completion[d]; return Array.isArray(c) && c.includes(obj.item); }); } if (freq === 'custom') { var c = completion[dateStr]; return Array.isArray(c) && c.includes(obj.item); } return false; }",
  "function isDayComplete(p, dateStr, missionStart) { var items = getObjectives(p).filter(function(t){ var f = (t.frequency || 'daily').toLowerCase(); return ['daily','weekly','monthly','custom'].indexOf(f) >= 0; }); var applicable = items.filter(function(t){ return shouldShowObjectiveOnDate(t, dateStr, missionStart); }); if (applicable.length === 0) return true; return applicable.every(function(t){ return isItemCompletedForDate(p, dateStr, t); }); }",
  "const dayList = getDaysInRange(page.timeframe);",
  "const missionStart = dayList.length ? dayList[0] : today;",
  "const missionDaysSet = new Set(dayList);",
  "function showCompleteModal(editIndex, editItem, editFreq, editLinks, editStartDate, editDays) {",
  "  const isEdit = editIndex >= 0;",
  "  const isCustom = (editFreq || '').toLowerCase() === 'custom';",
  "  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];",
  "  var startDateVal = editStartDate || today;",
  "  if (typeof startDateVal === 'object' && startDateVal && startDateVal.toISOString) startDateVal = startDateVal.toISOString().slice(0,10);",
  "  else if (typeof startDateVal !== 'string') startDateVal = today;",
  "  const itemEsc = (editItem || '').replace(/&/g, '&amp;').replace(/\\\"/g, '&quot;').replace(/</g, '&lt;');",
  "  const overlay = document.createElement('div');",
  "  overlay.className = 'missions-add-target-overlay';",
  "  var dl = getDaysInRange(page.timeframe);",
  "  var minDate = dl.length ? dl[0] : today;",
  "  var maxDate = dl.length ? dl[dl.length-1] : (function(){ var d = new Date(); d.setFullYear(d.getFullYear()+1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();",
  "  overlay.innerHTML = '<div class=\"missions-add-target-modal\"><h4>' + (isEdit ? 'Edit item' : 'Add item') + '</h4><input type=\"text\" placeholder=\"What to complete\" class=\"missions-add-target-input\" value=\"' + itemEsc + '\" /><div class=\"missions-add-target-links\"><span>Links:</span><div class=\"missions-add-target-links-list\"></div><button type=\"button\" class=\"missions-add-target-add-link\">+ Add link</button></div><div class=\"missions-add-target-start\"><span>Starting on:</span><input type=\"date\" class=\"missions-add-target-start-input\" value=\"' + startDateVal + '\" min=\"' + minDate + '\" max=\"' + maxDate + '\" /></div><div class=\"missions-add-target-freq\"><span>Frequency:</span><button data-freq=\"daily\">Daily</button><button data-freq=\"weekly\">Weekly</button><button data-freq=\"monthly\">Monthly</button><button data-freq=\"custom\">Custom</button></div><div class=\"missions-add-target-custom\" style=\"display:none\"><span>Days:</span><div class=\"missions-add-target-days\"></div></div><div class=\"missions-add-target-actions\"><button class=\"missions-add-target-cancel\">Cancel</button><button class=\"missions-add-target-save\">' + (isEdit ? 'Save' : 'Add') + '</button></div></div>';",
  "  document.body.appendChild(overlay);",
  "  const input = overlay.querySelector('.missions-add-target-input');",
  "  const linksList = overlay.querySelector('.missions-add-target-links-list');",
  "  const addLinkBtn = overlay.querySelector('.missions-add-target-add-link');",
  "  function addLinkRow(name, url) {",
  "    const row = document.createElement('div');",
  "    row.className = 'missions-add-target-link-row';",
  "    row.innerHTML = '<input type=\"text\" placeholder=\"Name\" class=\"missions-add-target-link-name\" value=\"' + (name || '').replace(/\"/g, '&quot;') + '\" /><input type=\"text\" placeholder=\"URL\" class=\"missions-add-target-link-url\" value=\"' + (url || '').replace(/\"/g, '&quot;') + '\" /><button type=\"button\" class=\"missions-add-target-remove-link\">×</button>';",
  "    row.querySelector('.missions-add-target-remove-link').addEventListener('click', function(){ row.remove(); });",
  "    linksList.appendChild(row);",
  "  }",
  "  (Array.isArray(editLinks) ? editLinks : []).forEach(function(l){ addLinkRow(l.name, l.url); });",
  "  if (linksList.children.length === 0) addLinkRow('', '');",
  "  addLinkBtn.addEventListener('click', function(){ addLinkRow('', ''); });",
  "  const startInput = overlay.querySelector('.missions-add-target-start-input');",
  "  const customWrap = overlay.querySelector('.missions-add-target-custom');",
  "  const daysWrap = overlay.querySelector('.missions-add-target-days');",
  "  const saveBtn = overlay.querySelector('.missions-add-target-save');",
  "  let frequency = (editFreq || 'daily').toLowerCase();",
  "  if (!['daily','weekly','monthly','custom'].includes(frequency)) frequency = 'daily';",
  "  let selectedDays = Array.isArray(editDays) ? editDays.slice() : [];",
  "  dayNames.forEach(function(name, i) {",
  "    var btn = document.createElement('button');",
  "    btn.type = 'button';",
  "    btn.className = 'missions-add-target-day-btn';",
  "    btn.dataset.day = i;",
  "    btn.textContent = name;",
  "    if (selectedDays.indexOf(i) >= 0) btn.classList.add('active');",
  "    btn.addEventListener('click', function() {",
  "      var d = parseInt(btn.dataset.day, 10);",
  "      var idx = selectedDays.indexOf(d);",
  "      if (idx >= 0) selectedDays.splice(idx, 1);",
  "      else selectedDays.push(d);",
  "      selectedDays.sort();",
  "      btn.classList.toggle('active', selectedDays.indexOf(d) >= 0);",
  "    });",
  "    daysWrap.appendChild(btn);",
  "  });",
  "  overlay.querySelectorAll('.missions-add-target-freq button').forEach(function(b) {",
  "    if (b.dataset.freq === frequency) b.classList.add('active');",
  "    b.addEventListener('click', function() {",
  "      overlay.querySelectorAll('.missions-add-target-freq button').forEach(function(x){ x.classList.remove('active'); });",
  "      b.classList.add('active');",
  "      frequency = b.dataset.freq;",
  "      customWrap.style.display = frequency === 'custom' ? 'block' : 'none';",
  "    });",
  "  });",
  "  saveBtn.addEventListener('click', async function() {",
  "    const item = input.value.trim();",
  "    if (!item) { new Notice('Enter what to complete'); return; }",
  "    const startDate = (startInput && startInput.value) ? startInput.value : today;",
  "    if (!isValidDate(startDate)) { new Notice('Invalid date (e.g. Feb 29 does not exist in 2026). Pick a valid date.'); return; }",
  "    var links = [];",
  "    overlay.querySelectorAll('.missions-add-target-link-row').forEach(function(row){",
  "      var url = (row.querySelector('.missions-add-target-link-url') && row.querySelector('.missions-add-target-link-url').value || '').trim();",
  "      if (url) links.push({ name: (row.querySelector('.missions-add-target-link-name') && row.querySelector('.missions-add-target-link-name').value || 'Link').trim() || 'Link', url: url });",
  "    });",
  "    const file = app.vault.getAbstractFileByPath(filePath);",
  "    if (!file || file.extension !== 'md') { overlay.remove(); return; }",
  "    var newObj = { item: item, frequency: frequency, startDate: startDate };",
  "    if (links.length) newObj.links = links;",
  "    if (frequency === 'custom' && selectedDays.length) newObj.days = selectedDays;",
  "    await app.fileManager.processFrontMatter(file, function(fm) {",
  "      var existing = fm.objectives || fm.complete || fm.targets;",
  "      var arr = Array.isArray(existing) ? existing : [];",
  "      var objectives = arr.map(function(t){ if (typeof t === 'object' && t && t.item) { var o = { item: String(t.item), frequency: (t.frequency || 'daily'), startDate: t.startDate || t.startingOn || '', days: Array.isArray(t.days) ? t.days : [] }; o.links = parseLinks(t); return o; } return { item: String(t || ''), frequency: 'daily', startDate: '', days: [], links: [] }; }).filter(function(t){ return t.item; });",
  "      if (isEdit && editIndex >= 0 && editIndex < objectives.length) objectives[editIndex] = newObj; else objectives.push(newObj);",
  "      fm.objectives = objectives;",
  "      if (fm.targets) delete fm.targets; if (fm.complete) delete fm.complete;",
  "    });",
  "    new Notice(isEdit ? 'Item updated' : 'Item added');",
  "    overlay.remove();",
  "    location.reload();",
  "  });",
  "  overlay.querySelector('.missions-add-target-cancel').addEventListener('click', function(){ overlay.remove(); });",
  "  overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });",
  "  customWrap.style.display = frequency === 'custom' ? 'block' : 'none';",
  "  input.focus();",
  "}",
  "const section = container.createEl('div', { cls: 'missions-targets-section' });",
  "const headerRow = section.createEl('div', { cls: 'missions-targets-header' });",
  "headerRow.createEl('h2', { cls: 'missions-targets-title', text: 'Tasks' });",
  "const btn = headerRow.createEl('button', { cls: 'missions-add-target-btn', text: '+ Add task' });",
  "btn.addEventListener('click', function(){ showCompleteModal(-1, null, null, null, null, null); });",
  "const cardsWrap = section.createEl('div', { cls: 'missions-target-cards' });",
  "if (objectives.length === 0) {",
  "  const empty = cardsWrap.createEl('div', { cls: 'missions-target-empty-msg' });",
  "  empty.textContent = 'No tasks yet. Click + Add task to add one.';",
  "} else {",
  "  objectives.forEach(function(t, i) {",
  "    const item = typeof t === 'object' && t.item ? t.item : String(t || '');",
  "    const freq = typeof t === 'object' && t.frequency ? t.frequency : 'daily';",
  "    const links = parseLinks(typeof t === 'object' ? t : {});",
  "    const startDate = typeof t === 'object' && (t.startDate || t.startingOn) ? (t.startDate || t.startingOn) : null;",
  "    const days = typeof t === 'object' && Array.isArray(t.days) ? t.days : null;",
  "    if (!item) return;",
  "    const card = cardsWrap.createEl('div', { cls: 'missions-target-card' });",
  "    const content = card.createEl('div', { cls: 'missions-target-card-content' });",
  "    const itemEl = content.createEl('div', { cls: 'missions-target-card-item' });",
  "    itemEl.textContent = item;",
  "    var freqLabel = freq;",
  "    if (freq === 'custom' && days && days.length) freqLabel = days.map(function(d){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }).join(', ');",
  "    content.createEl('span', { cls: 'missions-target-card-freq', text: freqLabel });",
  "    const actions = card.createEl('div', { cls: 'missions-target-card-actions' });",
  "    if (links.length === 1) {",
  "      const l = links[0];",
  "      const linkEl = actions.createEl('a', { text: l.name || 'linked', cls: 'missions-target-linked' });",
  "      linkEl.href = l.url; linkEl.setAttribute('data-href', l.url);",
  "      if (l.url.startsWith('http://') || l.url.startsWith('https://')) { linkEl.target = '_blank'; linkEl.rel = 'noopener'; } else { linkEl.classList.add('internal-link'); }",
  "    } else if (links.length > 1) {",
  "      const btnWrap = actions.createEl('div', { cls: 'missions-target-links-wrap' });",
  "      const btn = btnWrap.createEl('button', { type: 'button', text: 'Links', cls: 'missions-target-linked missions-target-links-btn' });",
  "      const dropdown = btnWrap.createEl('div', { cls: 'missions-target-links-dropdown' });",
  "      links.forEach(function(l){ var a = dropdown.createEl('a', { text: l.name || 'Link', cls: 'missions-target-linked-item' }); a.href = l.url; a.setAttribute('data-href', l.url); if (l.url.startsWith('http://') || l.url.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener'; } else a.classList.add('internal-link'); });",
  "      btn.addEventListener('click', function(e){ e.stopPropagation(); dropdown.classList.toggle('open'); });",
  "      document.addEventListener('click', function(e){ if (!btnWrap.contains(e.target)) dropdown.classList.remove('open'); });",
  "    }",
  "    const editBtn = actions.createEl('button', { cls: 'missions-target-edit-btn', text: 'Edit' });",
  "    const delBtn = actions.createEl('button', { cls: 'missions-target-del-btn', text: 'Delete' });",
  "    editBtn.addEventListener('click', function(){ showCompleteModal(i, item, freq, links, startDate, days); });",
  "    delBtn.addEventListener('click', async () => {",
  "      const file = app.vault.getAbstractFileByPath(filePath);",
  "      if (!file) return;",
  "      await app.fileManager.processFrontMatter(file, (fm) => { fm.objectives = (fm.objectives || []).filter(function(_, idx){ return idx !== i; }); });",
  "      new Notice('Item removed');",
  "      location.reload();",
  "    });",
  "  });",
  "}",
  "container.createEl('hr', { cls: 'missions-tasks-activity-separator' });",
  "const activitySection = container.createEl('div', { cls: 'missions-activity-section' });",
  "activitySection.createEl('h3', { cls: 'missions-activity-title', text: 'Activity' });",
  "const contribOuter = activitySection.createEl('div', { cls: 'missions-contrib-outer' });",
  "const combinedWrap = contribOuter.createEl('div', { cls: 'missions-contrib-combined' });",
  "function renderContrib() {",
  "  while (combinedWrap.firstChild) combinedWrap.removeChild(combinedWrap.firstChild);",
  "  if (dayList.length === 0) { combinedWrap.createEl('p', { cls: 'missions-contrib-empty', text: 'Set timeframe (e.g. 1/15/26 - 4/30/26) in YAML.' }); return; }",
  "  var firstMission = new Date(dayList[0] + 'T12:00:00');",
  "  var lastMission = new Date(dayList[dayList.length - 1] + 'T12:00:00');",
  "  var displayStart = new Date(firstMission.getFullYear(), firstMission.getMonth(), 1);",
  "  var endOfMonthAfterStart = new Date(firstMission.getFullYear(), firstMission.getMonth() + 2, 0);",
  "  var endOfMissionEndMonth = new Date(lastMission.getFullYear(), lastMission.getMonth() + 1, 0);",
  "  var displayEnd = new Date(Math.max(endOfMonthAfterStart.getTime(), endOfMissionEndMonth.getTime()));",
  "  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];",
  "  var block = combinedWrap.createEl('div', { cls: 'missions-contrib-combined-block' });",
  "  var body = block.createEl('div', { cls: 'missions-contrib-month-body' });",
  "  var dowBlock = body.createEl('div', { cls: 'missions-contrib-dow-block' });",
  "  dowBlock.createEl('div', { cls: 'missions-contrib-dow-marker-gutter' });",
  "  var dowCol = dowBlock.createEl('div', { cls: 'missions-contrib-month-dow-col' });",
  "  ['S','M','T','W','T','F','S'].forEach(function(d) { dowCol.createEl('span', { cls: 'missions-contrib-month-dow-lbl', text: d }); });",
  "  var scan = new Date(displayStart); while (scan.getDay() !== 0) scan.setDate(scan.getDate() - 1);",
  "  var endScan = new Date(displayEnd); while (endScan.getDay() !== 6) endScan.setDate(endScan.getDate() + 1);",
  "  var weekStarts = []; var wk = new Date(scan); while (wk <= endScan) { weekStarts.push(new Date(wk)); wk.setDate(wk.getDate() + 7); }",
  "  var weeksCol = body.createEl('div', { cls: 'missions-contrib-weeks-column' });",
  "  var markersRow = weeksCol.createEl('div', { cls: 'missions-contrib-markers-row' });",
  "  var weeksWrap = weeksCol.createEl('div', { cls: 'missions-contrib-month-weeks' });",
  "  weekStarts.forEach(function(weekStart) {",
  "    var tmp = new Date(weekStart); var monthLabelText = '';",
  "    for (var wi = 0; wi < 7; wi++) {",
  "      if (tmp.getTime() >= displayStart.getTime() && tmp.getTime() <= displayEnd.getTime() && tmp.getDate() === 1) { monthLabelText = monthNames[tmp.getMonth()]; break; }",
  "      tmp.setDate(tmp.getDate() + 1);",
  "    }",
  "    var markerCell = markersRow.createEl('div', { cls: 'missions-contrib-month-marker-cell' });",
  "    if (monthLabelText) markerCell.createEl('span', { cls: 'missions-contrib-month-marker', text: monthLabelText, attr: { title: monthLabelText } });",
  "  });",
  "  weekStarts.forEach(function(weekStart) {",
  "    var cur = new Date(weekStart);",
  "    var weekCol = weeksWrap.createEl('div', { cls: 'missions-contrib-week-col' });",
  "    for (var wi = 0; wi < 7; wi++) {",
  "      var iso = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');",
  "      var cell = weekCol.createEl('div', { cls: 'missions-contrib-cell', attr: { title: iso } });",
  "      if (!missionDaysSet.has(iso)) cell.classList.add('missions-contrib-pad');",
  "      else { cell.classList.add('missions-contrib-in-range'); if (iso === today) cell.classList.add('missions-contrib-today'); if (iso <= today) { if (isDayComplete(page, iso, missionStart)) cell.classList.add('missions-contrib-done'); else if (iso < today) cell.classList.add('missions-contrib-missed'); } }",
  "      cur.setDate(cur.getDate() + 1);",
  "    }",
  "  });",
  "}",
  "renderContrib();",
  "```",
  ""
].join("\n");

const mainContent = [
  "---",
  "objective: " + (objective || ""),
  "timeframe: " + timeframe,
  "status: " + status,
  "objectives: []",
  "---",
  addTargetBlock,
  ""
].join("\n");

await tp.file.create_new(mainContent, missionName, false, folderPath);

const mainNotePath = folderPath + missionName + ".md";
const newFile = app.vault.getAbstractFileByPath(mainNotePath);
if (newFile) {
  await app.workspace.getLeaf("tab").openFile(newFile);
}

new Notice("Created under " + basePath.replace(/\/$/, ""));
%>
