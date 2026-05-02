/**
 * Project → Agenda: one note per task directly in Unfinished/ (tagged from-project).
 * Loaded by Templater as a user script. Also registered on globalThis for the thin DataviewJS bridge in project notes.
 *
 * Templater evaluates user scripts lazily. Project notes call
 * `user_script_functions.generate_user_script_functions()` first (see Project Folder Template DataviewJS)
 * so `globalThis.__projectAgendaPushWork` exists before the bridge runs.
 */
async function projectAgendaPush(tp, mountCtx) {
  const app = tp.app;
  const file = tp.file;
  if (!file) {
    new Notice("No active file");
    return;
  }
  const filePath = file.path;
  const projectLinkName = file.basename;
  const dvApi = app.plugins.plugins.dataview?.api;

  let page = mountCtx && mountCtx.page;
  if (!page) {
    if (!dvApi) {
      new Notice("Dataview is required for project agenda push.");
      return;
    }
    page = dvApi.page(filePath);
  }
  if (!page || !page.file) {
    new Notice("Could not load this note in Dataview.");
    return;
  }

  /** Tasks at click time — the `page` from the Dataview block can be stale or lack `tasks` until indexed. */
  function getOpenTasksFromIndex() {
    let p = page;
    if (dvApi && typeof dvApi.page === "function") {
      try {
        const fresh = dvApi.page(filePath);
        if (fresh) p = fresh;
      } catch (_e) {}
    }
    const raw = p && p.file && p.file.tasks;
    const list = Array.isArray(raw) ? raw : [];
    return list.filter((t) => !t.completed);
  }

  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  function formatShortUsDate(iso) {
    const d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.getMonth() + 1 + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(-2);
  }

  const UNFINISHED_ROOTS = ["Data/Tools/Agenda/Unfinished", "Work/Data/Tools/Agenda/Unfinished"];
  function getUnfinishedRoot() {
    for (const root of UNFINISHED_ROOTS) {
      if (app.vault.getAbstractFileByPath(root)) return root;
    }
    return UNFINISHED_ROOTS[0];
  }
  async function ensureFolderExists(fullPath) {
    if (app.vault.getAbstractFileByPath(fullPath)) return;
    const parts = fullPath.split("/").filter(Boolean);
    let acc = "";
    for (const p of parts) {
      acc = acc ? acc + "/" + p : p;
      if (!app.vault.getAbstractFileByPath(acc)) await app.vault.createFolder(acc);
    }
  }
  function taskToStem(text) {
    const oneLine = String(text || "").trim().split(/\r?\n/)[0] || "Todo";
    let stem = oneLine.replace(/[\\/:*?"<>|#\[\]]/g, "").replace(/\s+/g, " ").trim();
    if (stem.length > 60) stem = stem.slice(0, 60).trim();
    return stem || "Todo";
  }

  async function appendMarkerOnProjectTaskLine(task, dueIso) {
    const tfile = app.vault.getAbstractFileByPath(filePath);
    if (!tfile || tfile.extension !== "md") return;
    let idx = -1;
    if (task.position?.start?.line != null && typeof task.position.start.line === "number") {
      idx = task.position.start.line;
    } else if (typeof task.line === "number" && task.line >= 0) {
      idx = task.line;
    }
    if (idx < 0) return;
    const raw = await app.vault.read(tfile);
    const lines = raw.split(/\r?\n/);
    if (idx >= lines.length) return;
    const tag = " *[Added to agenda " + formatShortUsDate(dueIso) + "]*";
    if (/\[Added to agenda /.test(lines[idx])) return;
    lines[idx] = lines[idx].replace(/\s*$/, "") + tag;
    await app.vault.modify(tfile, lines.join("\n"));
  }

  async function createAgendaNoteForTask(taskBody, due) {
    const body = String(taskBody || "").trim();
    if (!body) return { ok: false, err: "empty" };
    const baseRoot = getUnfinishedRoot();
    await ensureFolderExists(baseRoot);
    const stem = taskToStem(body);
    let notePath = baseRoot + "/" + stem + ".md";
    let n = 2;
    while (app.vault.getAbstractFileByPath(notePath)) {
      notePath = baseRoot + "/" + stem + " " + n + ".md";
      n++;
    }
    const linkPath = filePath.replace(/\.md$/, "");
    const linkLine = "[[" + linkPath + "|" + projectLinkName + "]]";
    const yaml = [
      "---",
      "schedule: " + due,
      "agenda-added: " + due,
      "tags:",
      "  - added-to-agenda",
      "  - from-project",
      "project: " + JSON.stringify(filePath),
      "---",
      "",
      body,
      "",
      "*Added to agenda · " + formatShortUsDate(due) + "*",
      "",
      "Project: " + linkLine,
      ""
    ].join("\n");
    await app.vault.create(notePath, yaml);
    return { ok: true, name: notePath.split("/").pop() };
  }

  function openModal() {
    const openTasks = getOpenTasksFromIndex();
    const overlay = document.body.createEl("div", { cls: "missions-add-standalone-overlay" });
    const modal = overlay.createEl("div", { cls: "missions-add-standalone-modal project-agenda-multi-modal" });
    modal.addEventListener("click", (e) => e.stopPropagation());
    modal.createEl("h4", { cls: "missions-add-standalone-title", text: "Add to Agenda" });

    const listWrap = modal.createEl("div", { cls: "project-agenda-modal-list" });
    const checkRows = [];
    if (openTasks.length === 0) {
      listWrap.createEl("p", { cls: "project-agenda-modal-empty", text: "No open tasks in this project." });
    } else {
      openTasks.forEach((t) => {
        const row = listWrap.createEl("label", { cls: "project-agenda-modal-task-row" });
        const cb = row.createEl("input", { type: "checkbox", cls: "project-agenda-modal-cb" });
        row.createEl("span", { cls: "project-agenda-modal-task-label", text: t.text || "Task" });
        checkRows.push({ cb, task: t });
      });
    }

    const dueWrap = modal.createEl("div", { cls: "missions-add-standalone-field" });
    dueWrap.createEl("label", { text: "Due date", attr: { for: "proj-agenda-multi-due" } });
    const dueInput = dueWrap.createEl("input", {
      type: "date",
      cls: "missions-add-standalone-date",
      attr: { id: "proj-agenda-multi-due", value: today, min: today }
    });

    const btnRow = modal.createEl("div", { cls: "missions-add-standalone-actions" });
    const cancelBtn = btnRow.createEl("button", { type: "button", cls: "missions-status-modal-btn", text: "Cancel" });
    const confirmBtn = btnRow.createEl("button", {
      type: "button",
      cls: "missions-status-modal-btn missions-add-standalone-create",
      text: "Add to agenda"
    });

    function close() {
      overlay.remove();
    }
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    confirmBtn.addEventListener("click", async () => {
      let due = dueInput.value && /^\d{4}-\d{2}-\d{2}$/.test(dueInput.value) ? dueInput.value : today;
      if (due < today) {
        new Notice("Due date must be today or later.");
        return;
      }
      const selected = checkRows.filter((r) => r.cb.checked).map((r) => r.task);
      if (selected.length === 0) {
        new Notice("Select at least one task.");
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const t of selected) {
        try {
          const r = await createAgendaNoteForTask(t.text, due);
          if (r.ok) {
            ok++;
            await appendMarkerOnProjectTaskLine(t, due);
          } else fail++;
        } catch (_e) {
          fail++;
        }
      }
      if (ok > 0) {
        new Notice("Added " + ok + " item(s) to Agenda." + (fail ? " " + fail + " failed." : ""));
        close();
      } else {
        new Notice("Could not add agenda items.");
      }
    });
  }

  const container = mountCtx && mountCtx.container;
  if (container) {
    const headerRow = container.createEl("div", { cls: "project-tasks-header-row" });
    headerRow.createEl("span", { cls: "project-tasks-header-title", text: "Tasks" });
    const addBtn = headerRow.createEl("button", {
      type: "button",
      cls: "project-agenda-header-btn",
      text: "Add to agenda"
    });
    addBtn.title = "Choose tasks and due date to add to Agenda";
    addBtn.setAttribute("aria-label", "Add to agenda");
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        openModal();
      } catch (err) {
        console.error(err);
        new Notice("Add to agenda failed: " + (err && err.message ? err.message : String(err)));
      }
    });
  } else {
    try {
      openModal();
    } catch (err) {
      console.error(err);
      new Notice("Add to agenda failed: " + (err && err.message ? err.message : String(err)));
    }
  }
}

module.exports = projectAgendaPush;
if (typeof globalThis !== "undefined") globalThis.__projectAgendaPushWork = projectAgendaPush;
