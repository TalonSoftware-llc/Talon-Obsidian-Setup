---
objective: Keep the squad aligned on priorities, blockers, and customer feedback.
timeframe: 3/1/26 - 12/31/26
status: started
objectives:
  - item: Capture action items
    frequency: daily
    startDate: 2026-01-01
linked-notes: []
completion:
  2026-03-16:
    - Capture action items
  2026-03-17:
    - Capture action items
  2026-03-18:
    - Capture action items
  2026-03-19:
    - Capture action items
  2026-03-20:
    - Capture action items
---
```dataviewjs
const app = this.app;
const container = this.container || dv.container;
const page = dv.current();
if (!page || !page.file) { container.createEl('p', { text: 'Could not load page. Open this file directly.' }); return; }
const filePath = page.file.path;
const objectives = Array.isArray(page.objectives) ? page.objectives : (Array.isArray(page.complete) ? page.complete : (Array.isArray(page.targets) ? page.targets : []));
const completion = page.completion || {};
const now = new Date(); const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const overviewCard = container.createEl('div', { cls: 'missions-overview-card' });
const overviewHeader = overviewCard.createEl('div', { cls: 'missions-overview-header' });
overviewHeader.createEl('div', { cls: 'missions-overview-label', text: 'Objective' });
const displayStatus = 'Active';
const statusBtnWrap = overviewHeader.createEl('div', { cls: 'missions-status-btn-wrap' });
const statusBtn = statusBtnWrap.createEl('button', { cls: 'missions-status-btn', text: displayStatus });
const modalOverlay = document.body.createEl('div', { cls: 'missions-status-modal-overlay' });
const modal = modalOverlay.createEl('div', { cls: 'missions-status-modal' });
modal.createEl('div', { cls: 'missions-status-modal-title', text: 'Mission folder' });
const archiveBtn = modal.createEl('button', { cls: 'missions-status-modal-btn missions-modal-scrap', text: 'Archive' });
archiveBtn.addEventListener('click', async function() {
  modalOverlay.classList.remove('open');
  const pathParts = filePath.split('/');
  const agendaFolder = pathParts.slice(0, -1).join('/');
  const dest = 'z_archive/Agenda';
  const folder = app.vault.getAbstractFileByPath(agendaFolder);
  if (!folder) { new Notice('Folder not found'); return; }
  const name = agendaFolder.split('/').pop();
  const target = dest + '/' + name;
  if (!app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);
  await app.vault.rename(folder, target);
  new Notice('Archived');
  location.reload();
});
statusBtn.addEventListener('click', function(e) { e.stopPropagation(); modalOverlay.classList.add('open'); });
modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });
const overviewContent = overviewCard.createEl('div', { cls: 'missions-overview-content' });
overviewContent.setAttribute('contenteditable', 'true');
overviewContent.setAttribute('data-placeholder', "What's the objective?");
overviewContent.textContent = page.objective || '';
if (!overviewContent.textContent) overviewContent.classList.add('empty');
overviewContent.addEventListener('input', function(){ this.classList.toggle('empty', !this.textContent.trim()); });
overviewContent.addEventListener('blur', async function() {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return;
  await app.fileManager.processFrontMatter(file, (fm) => { fm.objective = overviewContent.textContent.trim(); });
});
const statusSection = container.createEl('div', { cls: 'missions-status-section' });
const weekDates = getWeekDatesMonSun(today);
function parseDateStr(str) { str = String(str).trim(); if (!str) return null; if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(str)) return new Date(str + 'T12:00:00'); const m = str.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{2,4})$/); if (m) { let y = parseInt(m[3], 10); if (y < 100) y += 2000; return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10)); } return null; }
function getDaysInRange(tf) { if (tf == null || tf === undefined) return []; var s = ''; if (typeof tf === 'number') s = new Date(tf).toISOString().slice(0, 10); else if (typeof tf === 'object') { if (tf.toISODate) s = tf.toISODate(); else if (tf.toISOString) s = tf.toISOString().slice(0, 10); else s = String(tf); } else s = String(tf || '').trim(); if (!s) return []; var parts = s.split(' - ').map(function(x){return x.trim();}); if (parts.length === 1 && s.indexOf('-') >= 0) parts = s.split(/\\s*-\\s*/).map(function(x){return x.trim();}); var start,end; if (parts.length >= 2) { start = parseDateStr(parts[0]); end = parseDateStr(parts[1]); } else { end = parseDateStr(parts[0]); var td = new Date(today + 'T12:00:00'); start = td <= end ? td : end; end = td <= end ? end : td; } if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return []; if (start > end) { var tmp=start;start=end;end=tmp; } var days=[]; var d=new Date(start); while (d <= end) { days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); d.setDate(d.getDate() + 1); } return days; }
function parseLinks(t) { if (!t) return []; if (Array.isArray(t.links) && t.links.length) return t.links.map(function(l){ return { name: (l && l.name) ? String(l.name).trim() : 'Link', url: (l && l.url) ? String(l.url).trim() : '' }; }).filter(function(l){ return l.url; }); if (t.link && String(t.link).trim()) return [{ name: 'Link', url: String(t.link).trim() }]; return []; }
function getObjectives(p) { const t = p.objectives || p.complete || p.targets; if (!t) return []; if (Array.isArray(t)) return t.map(x => { if (typeof x === 'object' && x && x.item) { var o = { item: String(x.item).trim(), frequency: (x.frequency || 'daily').toLowerCase(), startDate: x.startDate || x.startingOn || '', days: Array.isArray(x.days) ? x.days : [] }; o.links = parseLinks(x); return o; } return { item: String(x).trim(), frequency: 'daily', startDate: '', days: [], links: [] }; }).filter(x => x.item); if (typeof t === 'string') return t.trim() ? [{ item: t.trim(), frequency: 'daily', startDate: '', days: [], links: [] }] : []; return []; }
function getWeekDates(dateStr) { var d = new Date(dateStr + 'T12:00:00'); var day = d.getDay(); var start = new Date(d); start.setDate(d.getDate() - day); var dates = []; for (var i = 0; i < 7; i++) { var x = new Date(start); x.setDate(start.getDate() + i); dates.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); } return dates; }
function getWeekDatesMonSun(dateStr) { var d = new Date(dateStr + 'T12:00:00'); var day = d.getDay(); var monOffset = day === 0 ? -6 : 1 - day; var mon = new Date(d); mon.setDate(d.getDate() + monOffset); var dates = []; for (var i = 0; i < 5; i++) { var x = new Date(mon); x.setDate(mon.getDate() + i); dates.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); } return dates; }
function getMonthDates(dateStr) { var d = new Date(dateStr + 'T12:00:00'); var year = d.getFullYear(); var month = d.getMonth(); var last = new Date(year, month + 1, 0).getDate(); var dates = []; for (var i = 1; i <= last; i++) { dates.push(year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0')); } return dates; }
function toIso(dateStr) { if (!dateStr) return ''; if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(dateStr))) return isValidDate(dateStr) ? dateStr : ''; var m = String(dateStr).match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{2,4})$/); if (m) { var y = parseInt(m[3],10); if (y < 100) y += 2000; var iso = y + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0'); return isValidDate(iso) ? iso : ''; } return ''; }
function isValidDate(dateStr) { if (!dateStr || typeof dateStr !== 'string') return false; var d = new Date(dateStr + 'T12:00:00'); if (isNaN(d.getTime())) return false; var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(); var reformed = y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0'); return reformed === dateStr.trim(); }
function shouldShowObjectiveOnDate(obj, dateStr, missionStart) { var freq = (obj.frequency || 'daily').toLowerCase(); var start = (obj.startDate && toIso(obj.startDate)) || missionStart; if (!start) start = dateStr; if (dateStr < start) return false; if (freq === 'daily') return true; if (freq === 'weekly') { var s = new Date(start + 'T12:00:00').getTime(); var d = new Date(dateStr + 'T12:00:00').getTime(); var diff = Math.round((d - s) / 86400000); return diff >= 0 && diff % 7 === 0; } if (freq === 'monthly') { var ds = new Date(start + 'T12:00:00'); var dd = new Date(dateStr + 'T12:00:00'); return ds.getDate() === dd.getDate() && dateStr >= start; } if (freq === 'custom' && obj.days && obj.days.length) { var dow = new Date(dateStr + 'T12:00:00').getDay(); return obj.days.indexOf(dow) >= 0; } return false; }
function isItemCompletedForDate(p, dateStr, obj) { var completion = p.completion || {}; var freq = (obj.frequency || 'daily').toLowerCase(); if (freq === 'daily') { var c = completion[dateStr]; return Array.isArray(c) && c.includes(obj.item); } if (freq === 'weekly') { var weekDates = getWeekDates(dateStr); return weekDates.some(function(d){ var c = completion[d]; return Array.isArray(c) && c.includes(obj.item); }); } if (freq === 'monthly') { var monthDates = getMonthDates(dateStr); return monthDates.some(function(d){ var c = completion[d]; return Array.isArray(c) && c.includes(obj.item); }); } if (freq === 'custom') { var c = completion[dateStr]; return Array.isArray(c) && c.includes(obj.item); } return false; }
function isDayComplete(p, dateStr, missionStart) { var items = getObjectives(p).filter(function(t){ var f = (t.frequency || 'daily').toLowerCase(); return ['daily','weekly','monthly','custom'].indexOf(f) >= 0; }); var applicable = items.filter(function(t){ return shouldShowObjectiveOnDate(t, dateStr, missionStart); }); if (applicable.length === 0) return true; return applicable.every(function(t){ return isItemCompletedForDate(p, dateStr, t); }); }
const dayList = getDaysInRange(page.timeframe);
const missionStart = dayList.length ? dayList[0] : today;
const missionDaysSet = new Set(dayList);
const allItems = getObjectives(page).filter(function(t){ var f = (t.frequency || 'daily').toLowerCase(); return ['daily','weekly','monthly','custom'].indexOf(f) >= 0; });
const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
if (dayList.length === 0) {
  const empty = statusSection.createEl('div', { cls: 'missions-status-cal-empty-msg' });
  empty.textContent = 'Set timeframe (e.g. 2/28/26 - 3/20/26)';
} else {
  const weekSection = statusSection.createEl('div', { cls: 'missions-week-section' });
  const weekGrid = weekSection.createEl('div', { cls: 'missions-week-grid' });
  weekDates.forEach(function(dateStr, i) {
    const col = weekGrid.createEl('div', { cls: 'missions-week-day-col' });
    col.createEl('div', { cls: 'missions-week-day-name', text: dayNames[i] });
    const tasksWrap = col.createEl('div', { cls: 'missions-week-day-tasks' });
    const shownItems = allItems.filter(function(obj){ return shouldShowObjectiveOnDate(obj, dateStr, missionStart); });
    const dayComplete = shownItems.length === 0 ? true : shownItems.every(function(obj){ return isItemCompletedForDate(page, dateStr, obj); });
    const isPast = dateStr < today;
    if (dateStr === today) col.addClass('missions-week-day-today');
    else if (shownItems.length > 0) col.addClass('missions-week-day-mission');
    if (isPast && shownItems.length > 0) col.addClass(dayComplete ? 'missions-week-day-done' : 'missions-week-day-not-done');
    if (shownItems.length === 0) { tasksWrap.createEl('div', { cls: 'missions-week-task missions-week-task-empty', text: '—' }); }
    else { shownItems.forEach(function(obj) { const taskEl = tasksWrap.createEl('div', { cls: 'missions-week-task' }); const done = isItemCompletedForDate(page, dateStr, obj); const cb = taskEl.createEl('input', { type: 'checkbox', cls: 'missions-week-task-cb' }); cb.checked = done; cb.title = done ? 'Mark incomplete' : 'Mark complete'; const label = taskEl.createEl('label', { cls: 'missions-week-task-label', text: (obj.item || '').trim() }); label.htmlFor = cb.id = 'wk-' + dateStr + '-' + (obj.item || '').replace(/\\s/g, '-') + '-' + Math.random().toString(36).slice(2); cb.addEventListener('change', async function() { const file = app.vault.getAbstractFileByPath(filePath); if (!file || file.extension !== 'md') return; await app.fileManager.processFrontMatter(file, function(fm) { if (!fm.completion) fm.completion = {}; if (!fm.completion[dateStr]) fm.completion[dateStr] = []; var arr = fm.completion[dateStr]; if (cb.checked) { if (arr.indexOf(obj.item) < 0) arr.push(obj.item); } else { fm.completion[dateStr] = arr.filter(function(x) { return x !== obj.item; }); } }); location.reload(); }); }); }
  });
  const profileSection = statusSection.createEl('div', { cls: 'missions-profile-section' });
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthsSeen = {};
  dayList.forEach(function(d) { var parts = d.split('-'); var key = parts[0] + '-' + parts[1]; if (!monthsSeen[key]) monthsSeen[key] = { year: parseInt(parts[0],10), month: parseInt(parts[1],10) - 1 }; });
  const monthKeys = Object.keys(monthsSeen).sort();
  monthKeys.forEach(function(key) {
    const m = monthsSeen[key];
    const monthWrap = profileSection.createEl('div', { cls: 'missions-month-wrap' });
    monthWrap.createEl('h4', { cls: 'missions-month-title', text: monthNames[m.month] });
    const firstDay = new Date(m.year, m.month, 1);
    const lastDay = new Date(m.year, m.month + 1, 0).getDate();
    const startDow = firstDay.getDay();
    const calGrid = monthWrap.createEl('div', { cls: 'missions-month-grid' });
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(dn) { calGrid.createEl('div', { cls: 'missions-month-dow', text: dn }); });
    for (var i = 0; i < startDow; i++) calGrid.createEl('div', { cls: 'missions-month-cell missions-month-empty' });
    for (var day = 1; day <= lastDay; day++) {
      const dateStr = m.year + '-' + String(m.month + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
      const cell = calGrid.createEl('div', { cls: 'missions-month-cell' });
      cell.textContent = day;
      if (missionDaysSet.has(dateStr)) { cell.addClass('missions-month-mission-day'); if (dateStr === today) cell.addClass('missions-month-today'); else if (dateStr < today) { const done = isDayComplete(page, dateStr, missionStart); cell.addClass(done ? 'missions-month-done' : 'missions-month-not-done'); } }
    }
  });
}
function showCompleteModal(editIndex, editItem, editFreq, editLinks, editStartDate, editDays) {
  const isEdit = editIndex >= 0;
  const isCustom = (editFreq || '').toLowerCase() === 'custom';
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var startDateVal = editStartDate || today;
  if (typeof startDateVal === 'object' && startDateVal && startDateVal.toISOString) startDateVal = startDateVal.toISOString().slice(0,10);
  else if (typeof startDateVal !== 'string') startDateVal = today;
  const itemEsc = (editItem || '').replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;');
  const overlay = document.createElement('div');
  overlay.className = 'missions-add-target-overlay';
  var dl = getDaysInRange(page.timeframe);
  var minDate = dl.length ? dl[0] : today;
  var maxDate = dl.length ? dl[dl.length-1] : (function(){ var d = new Date(); d.setFullYear(d.getFullYear()+1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  overlay.innerHTML = '<div class="missions-add-target-modal"><h4>' + (isEdit ? 'Edit item' : 'Add item') + '</h4><input type="text" placeholder="What to complete" class="missions-add-target-input" value="' + itemEsc + '" /><div class="missions-add-target-links"><span>Links:</span><div class="missions-add-target-links-list"></div><button type="button" class="missions-add-target-add-link">+ Add link</button></div><div class="missions-add-target-start"><span>Starting on:</span><input type="date" class="missions-add-target-start-input" value="' + startDateVal + '" min="' + minDate + '" max="' + maxDate + '" /></div><div class="missions-add-target-freq"><span>Frequency:</span><button data-freq="daily">Daily</button><button data-freq="weekly">Weekly</button><button data-freq="monthly">Monthly</button><button data-freq="custom">Custom</button></div><div class="missions-add-target-custom" style="display:none"><span>Days:</span><div class="missions-add-target-days"></div></div><div class="missions-add-target-actions"><button class="missions-add-target-cancel">Cancel</button><button class="missions-add-target-save">' + (isEdit ? 'Save' : 'Add') + '</button></div></div>';
  document.body.appendChild(overlay);
  const input = overlay.querySelector('.missions-add-target-input');
  const linksList = overlay.querySelector('.missions-add-target-links-list');
  const addLinkBtn = overlay.querySelector('.missions-add-target-add-link');
  function addLinkRow(name, url) {
    const row = document.createElement('div');
    row.className = 'missions-add-target-link-row';
    row.innerHTML = '<input type="text" placeholder="Name" class="missions-add-target-link-name" value="' + (name || '').replace(/"/g, '&quot;') + '" /><input type="text" placeholder="URL" class="missions-add-target-link-url" value="' + (url || '').replace(/"/g, '&quot;') + '" /><button type="button" class="missions-add-target-remove-link">×</button>';
    row.querySelector('.missions-add-target-remove-link').addEventListener('click', function(){ row.remove(); });
    linksList.appendChild(row);
  }
  (Array.isArray(editLinks) ? editLinks : []).forEach(function(l){ addLinkRow(l.name, l.url); });
  if (linksList.children.length === 0) addLinkRow('', '');
  addLinkBtn.addEventListener('click', function(){ addLinkRow('', ''); });
  const startInput = overlay.querySelector('.missions-add-target-start-input');
  const customWrap = overlay.querySelector('.missions-add-target-custom');
  const daysWrap = overlay.querySelector('.missions-add-target-days');
  const saveBtn = overlay.querySelector('.missions-add-target-save');
  let frequency = (editFreq || 'daily').toLowerCase();
  if (!['daily','weekly','monthly','custom'].includes(frequency)) frequency = 'daily';
  let selectedDays = Array.isArray(editDays) ? editDays.slice() : [];
  dayNames.forEach(function(name, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'missions-add-target-day-btn';
    btn.dataset.day = i;
    btn.textContent = name;
    if (selectedDays.indexOf(i) >= 0) btn.classList.add('active');
    btn.addEventListener('click', function() {
      var d = parseInt(btn.dataset.day, 10);
      var idx = selectedDays.indexOf(d);
      if (idx >= 0) selectedDays.splice(idx, 1);
      else selectedDays.push(d);
      selectedDays.sort();
      btn.classList.toggle('active', selectedDays.indexOf(d) >= 0);
    });
    daysWrap.appendChild(btn);
  });
  overlay.querySelectorAll('.missions-add-target-freq button').forEach(function(b) {
    if (b.dataset.freq === frequency) b.classList.add('active');
    b.addEventListener('click', function() {
      overlay.querySelectorAll('.missions-add-target-freq button').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      frequency = b.dataset.freq;
      customWrap.style.display = frequency === 'custom' ? 'block' : 'none';
    });
  });
  saveBtn.addEventListener('click', async function() {
    const item = input.value.trim();
    if (!item) { new Notice('Enter what to complete'); return; }
    const startDate = (startInput && startInput.value) ? startInput.value : today;
    if (!isValidDate(startDate)) { new Notice('Invalid date (e.g. Feb 29 does not exist in 2026). Pick a valid date.'); return; }
    var links = [];
    overlay.querySelectorAll('.missions-add-target-link-row').forEach(function(row){
      var url = (row.querySelector('.missions-add-target-link-url') && row.querySelector('.missions-add-target-link-url').value || '').trim();
      if (url) links.push({ name: (row.querySelector('.missions-add-target-link-name') && row.querySelector('.missions-add-target-link-name').value || 'Link').trim() || 'Link', url: url });
    });
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || file.extension !== 'md') { overlay.remove(); return; }
    var newObj = { item: item, frequency: frequency, startDate: startDate };
    if (links.length) newObj.links = links;
    if (frequency === 'custom' && selectedDays.length) newObj.days = selectedDays;
    await app.fileManager.processFrontMatter(file, function(fm) {
      var existing = fm.objectives || fm.complete || fm.targets;
      var arr = Array.isArray(existing) ? existing : [];
      var objectives = arr.map(function(t){ if (typeof t === 'object' && t && t.item) { var o = { item: String(t.item), frequency: (t.frequency || 'daily'), startDate: t.startDate || t.startingOn || '', days: Array.isArray(t.days) ? t.days : [] }; o.links = parseLinks(t); return o; } return { item: String(t || ''), frequency: 'daily', startDate: '', days: [], links: [] }; }).filter(function(t){ return t.item; });
      if (isEdit && editIndex >= 0 && editIndex < objectives.length) objectives[editIndex] = newObj; else objectives.push(newObj);
      fm.objectives = objectives;
      if (fm.targets) delete fm.targets; if (fm.complete) delete fm.complete;
    });
    new Notice(isEdit ? 'Item updated' : 'Item added');
    overlay.remove();
    location.reload();
  });
  overlay.querySelector('.missions-add-target-cancel').addEventListener('click', function(){ overlay.remove(); });
  overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
  customWrap.style.display = frequency === 'custom' ? 'block' : 'none';
  input.focus();
}
const section = container.createEl('div', { cls: 'missions-targets-section' });
const headerRow = section.createEl('div', { cls: 'missions-targets-header' });
headerRow.createEl('h2', { cls: 'missions-targets-title', text: 'Objectives' });
const btn = headerRow.createEl('button', { cls: 'missions-add-target-btn', text: '+ Add objective' });
btn.addEventListener('click', function(){ showCompleteModal(-1, null, null, null, null, null); });
const cardsWrap = section.createEl('div', { cls: 'missions-target-cards' });
if (objectives.length === 0) {
  const empty = cardsWrap.createEl('div', { cls: 'missions-target-empty-msg' });
  empty.textContent = 'No objectives yet. Click + Add objective to add one.';
} else {
  objectives.forEach(function(t, i) {
    const item = typeof t === 'object' && t.item ? t.item : String(t || '');
    const freq = typeof t === 'object' && t.frequency ? t.frequency : 'daily';
    const links = parseLinks(typeof t === 'object' ? t : {});
    const startDate = typeof t === 'object' && (t.startDate || t.startingOn) ? (t.startDate || t.startingOn) : null;
    const days = typeof t === 'object' && Array.isArray(t.days) ? t.days : null;
    if (!item) return;
    const card = cardsWrap.createEl('div', { cls: 'missions-target-card' });
    const content = card.createEl('div', { cls: 'missions-target-card-content' });
    const itemEl = content.createEl('div', { cls: 'missions-target-card-item' });
    itemEl.textContent = item;
    var freqLabel = freq;
    if (freq === 'custom' && days && days.length) freqLabel = days.map(function(d){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }).join(', ');
    content.createEl('span', { cls: 'missions-target-card-freq', text: freqLabel });
    const actions = card.createEl('div', { cls: 'missions-target-card-actions' });
    if (links.length === 1) {
      const l = links[0];
      const linkEl = actions.createEl('a', { text: l.name || 'linked', cls: 'missions-target-linked' });
      linkEl.href = l.url; linkEl.setAttribute('data-href', l.url);
      if (l.url.startsWith('http://') || l.url.startsWith('https://')) { linkEl.target = '_blank'; linkEl.rel = 'noopener'; } else { linkEl.classList.add('internal-link'); }
    } else if (links.length > 1) {
      const btnWrap = actions.createEl('div', { cls: 'missions-target-links-wrap' });
      const btn = btnWrap.createEl('button', { type: 'button', text: 'Links', cls: 'missions-target-linked missions-target-links-btn' });
      const dropdown = btnWrap.createEl('div', { cls: 'missions-target-links-dropdown' });
      links.forEach(function(l){ var a = dropdown.createEl('a', { text: l.name || 'Link', cls: 'missions-target-linked-item' }); a.href = l.url; a.setAttribute('data-href', l.url); if (l.url.startsWith('http://') || l.url.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener'; } else a.classList.add('internal-link'); });
      btn.addEventListener('click', function(e){ e.stopPropagation(); dropdown.classList.toggle('open'); });
      document.addEventListener('click', function(e){ if (!btnWrap.contains(e.target)) dropdown.classList.remove('open'); });
    }
    const editBtn = actions.createEl('button', { cls: 'missions-target-edit-btn', text: 'Edit' });
    const delBtn = actions.createEl('button', { cls: 'missions-target-del-btn', text: 'Delete' });
    editBtn.addEventListener('click', function(){ showCompleteModal(i, item, freq, links, startDate, days); });
    delBtn.addEventListener('click', async () => {
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!file) return;
      await app.fileManager.processFrontMatter(file, (fm) => { fm.objectives = (fm.objectives || []).filter(function(_, idx){ return idx !== i; }); });
      new Notice('Item removed');
      location.reload();
    });
  });
}
```


## Links

```dataviewjs
(() => {
const app = this.app;
const page = dv.current();
if (!page || !page.file) return;
const filePath = page.file.path;
const folderPath = filePath.replace(/\/[^/]+$/, '');

const linkSection = dv.container.createEl('div', { cls: 'links-header-row' });
const linkBtn = linkSection.createEl('button', { cls: 'links-link-btn', text: '+ Link note' });
linkBtn.addEventListener('click', () => {
  const allFiles = app.vault.getMarkdownFiles().filter(f => !f.path.startsWith(folderPath)).sort((a,b) => a.path.localeCompare(b.path));
  const overlay = document.createElement('div');
  overlay.className = 'links-search-overlay';
  const modal = document.createElement('div');
  modal.className = 'links-search-modal';
  modal.innerHTML = '<h4>Link a note</h4><input type="text" class="links-search-input" placeholder="Search notes..." /><div class="links-search-results"></div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const input = modal.querySelector('.links-search-input');
  const results = modal.querySelector('.links-search-results');
  function render(filter) {
    results.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const matches = q ? allFiles.filter(f => f.path.toLowerCase().includes(q)) : allFiles.slice(0, 30);
    matches.slice(0, 30).forEach(f => {
      const item = document.createElement('div');
      item.className = 'links-search-item';
      item.textContent = f.path;
      item.addEventListener('click', async () => {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) return;
        await app.fileManager.processFrontMatter(file, fm => {
          if (!Array.isArray(fm['linked-notes'])) fm['linked-notes'] = [];
          if (!fm['linked-notes'].includes(f.path)) fm['linked-notes'].push(f.path);
        });
        overlay.remove();
        new Notice('Linked: ' + f.name);
        location.reload();
      });
      results.appendChild(item);
    });
  }
  render('');
  input.addEventListener('input', () => render(input.value));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  input.focus();
});

const linkedNotes = Array.isArray(page['linked-notes']) ? page['linked-notes'] : [];
if (linkedNotes.length > 0) {
  const lnWrap = dv.container.createEl('div', { cls: 'links-linked-section' });
  lnWrap.createEl('h4', { cls: 'links-subheading', text: 'Linked Notes' });
  for (const np of linkedNotes) {
    const row = lnWrap.createEl('div', { cls: 'links-linked-row' });
    const a = row.createEl('a', { text: np.split('/').pop().replace(/\.md$/, ''), cls: 'internal-link links-linked-name' });
    a.setAttribute('data-href', np); a.href = np;
    const unlinkBtn = row.createEl('button', { cls: 'links-unlink-btn', text: '×' });
    unlinkBtn.addEventListener('click', async () => {
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!file) return;
      await app.fileManager.processFrontMatter(file, fm => {
        fm['linked-notes'] = (fm['linked-notes'] || []).filter(x => x !== np);
      });
      row.remove();
    });
  }
}

dv.container.createEl('h4', { cls: 'links-subheading', text: 'Vault' });
const container = dv.container;
function collectAllFiles(dir, out) {
  const folder = app.vault.getAbstractFileByPath(dir);
  if (!folder || !folder.children) return;
  for (const c of folder.children) {
    if (c.path === filePath) continue;
    if (c.children) collectAllFiles(c.path, out);
    else out.push(c.path);
  }
}
const paths = [];
collectAllFiles(folderPath, paths);
paths.sort((a, b) => a.localeCompare(b));
const wrap = container.createEl('div', { cls: 'ideas-section' });
const header = wrap.createEl('div', { cls: 'ideas-section-header' });
const headerRow = header.createEl('div', { cls: 'ideas-section-header-row' });
const titleRow = headerRow.createEl('div', { cls: 'project-resources-title-row' });
titleRow.style.display = 'flex';
titleRow.style.alignItems = 'center';
titleRow.style.gap = '0.5em';
titleRow.createEl('h2', { cls: 'ideas-section-title', text: 'Resources' });
const addBtn = titleRow.createEl('button', { type: 'button', text: '+', cls: 'ideas-add-btn ideas-btn' });
addBtn.title = 'New note in this mission folder';
addBtn.addEventListener('click', async () => {
  let base = 'Untitled';
  let newPath = folderPath + '/' + base + '.md';
  let n = 2;
  while (app.vault.getAbstractFileByPath(newPath)) {
    newPath = folderPath + '/' + base + ' ' + n + '.md';
    n++;
  }
  await app.vault.create(newPath, '---\n---\n\n');
  new Notice('Created: ' + newPath.split('/').pop());
  const f = app.vault.getAbstractFileByPath(newPath);
  if (f) await app.workspace.getLeaf().openFile(f);
});
const list = wrap.createEl('div', { cls: 'project-resources-list' });
if (paths.length === 0) {
  const empty = list.createEl('span', { cls: 'project-resources-empty' });
  empty.textContent = 'No supporting files in this mission folder yet.';
  empty.style.color = 'var(--text-muted)';
} else {
  paths.forEach((p) => {
    const row = list.createEl('div', { cls: 'project-resources-item' });
    const rel = p.startsWith(folderPath + '/') ? p.slice(folderPath.length + 1) : p;
    const a = row.createEl('a', { text: rel, cls: 'internal-link' });
    a.href = p;
    a.setAttribute('data-href', p);
  });
}
})();
```

