```dataviewjs
(() => {
  const app = this.app;
  const ROOT = "Data/Tools/Projects";
  /** Main notes live at Data/Tools/Projects/[Project]/[any].md (project folder root or nested). */
  function isProjectMainNote(p) {
    const path = p.file.path;
    if (!path.startsWith(ROOT + "/")) return false;
    const parts = path.split("/").filter(Boolean);
    if (parts.length !== 5) return false;
    return path.endsWith(".md");
  }

  let pages = [];
  try {
    pages = Array.from(dv.pages('"' + ROOT + '"'));
  } catch (e) {}
  const candidates = pages.filter(p => p["dashboard-include"] === true && isProjectMainNote(p));
  const byPri = (a, b) => (parseInt(b.priority, 10) || 0) - (parseInt(a.priority, 10) || 0);
  const started = candidates.filter(p => (p.status || "").toLowerCase() === "started").sort(byPri);
  const unstarted = candidates.filter(p => (p.status || "").toLowerCase() === "unstarted").sort(byPri);

  const blockWrapper = dv.container.createEl("div", { cls: "project-cards-block" });

  const headerRow = blockWrapper.createEl("div", { cls: "project-header-row" });
  const toggleWrap = headerRow.createEl("div", { cls: "project-dashboard-toggle" });
  const btnActive = toggleWrap.createEl("button", { type: "button", cls: "project-toggle-btn active", text: "Active" });
  const btnUnstarted = toggleWrap.createEl("button", { type: "button", cls: "project-toggle-btn", text: "Unstarted" });
  const newProjectBtn = headerRow.createEl("button", { cls: "project-new-btn", text: "+ New project" });
  newProjectBtn.addEventListener("click", async () => {
    const templaterPlugin = app.plugins.plugins["templater-obsidian"];
    const templateFile = app.vault.getAbstractFileByPath("Templates/Project Folder Template.md");
    if (templaterPlugin && templaterPlugin.templater && templateFile) {
      await templaterPlugin.templater.create_new_note_from_template(templateFile);
    } else {
      app.commands.executeCommandById("templater-obsidian:create-new-note-from-template");
    }
  });

  const cardsContainer = blockWrapper.createEl("div", { cls: "project-cards-container" });

  /** "active" = started; "unstarted" = unstarted */
  let mode = "active";

  function renderCards(sorted, wrapper) {
    for (let i = 0; i < sorted.length; i += 3) {
      const row = wrapper.createEl("div", { cls: "project-cards-row" });
      const group = sorted.slice(i, i + 3);
      group.forEach(p => {
        const underTasksSection = (t) => {
          if (!t.section) return false;
          const s = t.section.path ?? t.section.link ?? String(t.section);
          return String(s).toLowerCase().includes("#tasks");
        };
        let tasks = p.file.tasks.where(t => underTasksSection(t));
        if (tasks.length === 0) tasks = p.file.tasks;
        const total = tasks.length;
        const completed = tasks.where(t => t.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const cell = row.createEl("div", { cls: "project-card-cell" });
        const card = cell.createEl("div", { cls: "project-card" });

        const title = card.createEl("h3", { cls: "project-title" });
        const link = title.createEl("a", { href: p.file.path, text: p.file.name, cls: "internal-link" });
        link.setAttribute("data-href", p.file.path);

        const cardRow = card.createEl("div", { cls: "project-card-row" });

        const circleContainer = cardRow.createEl("div", { cls: "circle-container" });
        circleContainer.style.setProperty("--fill-percent", String(percent));
        circleContainer.createEl("div", {
          cls: "progress-circle",
          attr: { style: `background: linear-gradient(to top, #2e7d32 0%, #2e7d32 ${percent}%, #ffffff ${percent}%);` }
        });
        circleContainer.createEl("div", { cls: "progress-indicator-line" });
        const indicator = circleContainer.createEl("div", { cls: "progress-indicator" });
        indicator.createEl("div", { cls: "progress-indicator-box", text: `${percent}%` });

        let priorityVal = Math.min(10, Math.max(1, parseInt(p.priority, 10) || 1));
        const filePath = p.file.path;
        const priBadge = card.createEl("button", { cls: "priority-badge", type: "button", text: String(priorityVal) });
        priBadge.title = "Priority";
        const priPopup = card.createEl("div", { cls: "priority-popup" });
        const priLeft = priPopup.createEl("button", { cls: "priority-popup-arrow priority-popup-left", type: "button" });
        const priDisplay = priPopup.createEl("span", { cls: "priority-popup-value", text: String(priorityVal) });
        const priRight = priPopup.createEl("button", { cls: "priority-popup-arrow priority-popup-right", type: "button" });
        const savePriority = async () => {
          priBadge.textContent = String(priorityVal);
          priDisplay.textContent = String(priorityVal);
          const file = app.vault.getAbstractFileByPath(filePath);
          if (file && file.extension === "md") {
            await app.fileManager.processFrontMatter(file, (fm) => { fm.priority = priorityVal; });
          }
        };
        priLeft.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (priorityVal > 1) { priorityVal--; await savePriority(); }
        });
        priRight.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (priorityVal < 10) { priorityVal++; await savePriority(); }
        });
        priBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          priDisplay.textContent = String(priorityVal);
          priPopup.classList.toggle("open");
        });
        document.addEventListener("click", () => priPopup.classList.remove("open"));
        priPopup.addEventListener("click", (e) => e.stopPropagation());
      });
    }
  }

  function refreshList() {
    cardsContainer.empty();
    const list = mode === "active" ? started : unstarted;
    if (list.length === 0) {
      cardsContainer.createEl("p", {
        cls: "project-dashboard-empty",
        text: mode === "active"
          ? "No active projects."
          : "No unstarted projects."
      });
      return;
    }
    renderCards(list, cardsContainer);
  }

  btnActive.addEventListener("click", () => {
    mode = "active";
    btnActive.classList.add("active");
    btnUnstarted.classList.remove("active");
    refreshList();
  });
  btnUnstarted.addEventListener("click", () => {
    mode = "unstarted";
    btnUnstarted.classList.add("active");
    btnActive.classList.remove("active");
    refreshList();
  });

  if (started.length === 0 && unstarted.length === 0) {
    cardsContainer.createEl("p", { text: "No projects found (set status + dashboard-include on main notes under Data/Tools/Projects/)." });
    return;
  }

  refreshList();
})();
```
