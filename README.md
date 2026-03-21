# Talon Obsidian Setup (Demo vault)

**[Talon-Obsidian-Setup on GitHub](https://github.com/TalonSoftware-llc/Talon-Obsidian-Setup)** — a ready-made Obsidian layout: three dashboards in `Tools/`, data under `Data/Tools/`, and a browsable **Repository** tree under `Data/`.

**What you get**

- **Agenda** — quick items + missions, one dashboard.
- **Projects** — cards, priority, tasks, “new project” flow.
- **Repository** — capture inbox + folder/board navigation.

This guide goes in order: get the files → open the vault → turn on plugins → style snippets → use each feature.

---

### Contents

1. [Prerequisites](#prerequisites)
2. [Clone the repository](#clone-the-repository)
3. [Open as an Obsidian vault](#open-as-an-obsidian-vault)
4. [Install Dataview and Templater](#install-dataview-and-templater)
5. [Enable CSS snippets](#enable-css-snippets)
6. [Where everything lives](#where-everything-lives)
7. [Agenda](#agenda)
8. [Projects](#projects)
9. [Repository](#repository)
10. [Sample data in this repo](#sample-data-in-this-repo)
11. [Further reference](#further-reference)

---

## Prerequisites

| Need | Notes |
|------|--------|
| [Obsidian](https://obsidian.md/) | Current public build. |
| Git | Optional; [Windows installer](https://git-scm.com/download/win). Needed to clone and pull updates. |

---

## Clone the repository

Pick a parent folder (where you keep vaults). Then:

```powershell
cd "C:\path\to\your\vaults"
git clone https://github.com/TalonSoftware-llc/Talon-Obsidian-Setup.git
```

- You get a folder named `Talon-Obsidian-Setup`. If you renamed it (e.g. `Demo`), use that path everywhere below.
- **Later updates:** open that folder in a terminal and run `git pull`.

---

## Open as an Obsidian vault

1. Launch **Obsidian**.
2. **Open folder as vault** (from the vault list, or **Add vault** → **Open folder as vault**).
3. Choose the cloned folder — the one that contains `Tools/`, `Data/`, and `.obsidian/`.

In the sidebar you should see **Tools**, **Templates**, **Data**, and **z_archive**.

---

## Install Dataview and Templater

The dashboards need **Dataview** (they use DataviewJS). **Templater** creates new agenda missions and project folders.

| Step | Action |
|------|--------|
| 1 | **Settings** → **Community plugins**. |
| 2 | Turn **Safe mode** off (confirm the prompt). |
| 3 | **Browse** → install **Dataview** and **Templater**. |
| 4 | Enable both under **Installed plugins**. |

**Already have `.obsidian/plugins/` in the clone?**  
You may still need to allow community plugins once, then confirm both plugins are **on**.

**Templater folder**

- **Settings** → **Templater** → **Template folder location** → `Templates`  
- The Project dashboard’s **+ New project** expects this.

---

## Enable CSS snippets

**Settings** → **Appearance** → **CSS snippets** → turn **on** each of these (files are in `.obsidian/snippets/`):

`agenda-cards` · `project-cards` · `ideas-cards` · `plus-cards` · `status-buttons` · `work-dashboard`

If layout looks plain, reload Obsidian or toggle a snippet off and on.

---

## Where everything lives

| Open this | It’s for |
|-----------|----------|
| `Tools/Agenda Dashboard.md` | Agenda (unfinished + missions) |
| `Tools/Project Dashboard.md` | Projects + **+ New project** |
| `Tools/Repository.md` | Capture (**New**) and **Repository** browser |
| `Templates/` | Agenda + Project templates (Templater) |
| `Data/Tools/Agenda/` | Agenda data (`Unfinished/` + mission folders) |
| `Data/Tools/Projects/` | One folder per project |
| `Data/Tools/Repository/New/` | Repository inbox |
| `Data/` (not under `Tools/`) | Repository layers and boards (`_board.md`) |
| `z_archive/` | Archived agenda / projects / repository |
| `Data/README.md` | How the demo Repository tree is laid out |

---

## Agenda

### Open

`Tools/Agenda Dashboard.md` — use **Reading** so Dataview loads fully

### Two item types

**Unfinished** (quick reminders)

- Path: `Data/Tools/Agenda/Unfinished/*.md`
- Often short notes, little frontmatter.
- Due date: YAML `due` or `scheduled`. If both are missing → treated as **due today**.
- Check things off on the dashboard. After **midnight / the next day**, completed items tied to **past** dates can move to `z_archive/Agenda` when the dashboard loads.

**Missions** (larger tracks)

- Path: `Data/Tools/Agenda/[MissionName]/`
- Main note: `[MissionName].md` (same name as the folder).
- Add more `.md` files in that folder anytime.

### New mission

Templater → create from template → **`Templates/Agenda Template.md`** (name, objective, timeframe → folder under `Data/Tools/Agenda/`).

### Habit

Keep **Agenda Dashboard** as the home screen for agenda work; it pulls everything together and runs archive logic on load.

---

## Projects

### Open

`Tools/Project Dashboard.md`

### Where projects live

`Data/Tools/Projects/[ProjectName]/` — flat folders. **Started vs unstarted** is not separate folders; it’s **frontmatter**.

### What appears on the dashboard

Notes that:

- include `dashboard-include: true`, and  
- sit like `Data/Tools/Projects/SomeProject/MainNote.md` (main note at project root in this demo).

### Sections and fields

| Idea | Frontmatter / behavior |
|------|-------------------------|
| Active | `status: started` |
| Unstarted | `status: unstarted` |
| Order on screen | `priority` (e.g. 1–10), higher sorts first |
| Progress ring | Tasks in the file — best under `## Tasks` |

### New project

Click **+ New project** → **`Templates/Project Folder Template.md`** (name, status, priority).

### Archive

Move finished or scrapped project folders to `z_archive/Projects/` when you’re done. The dashboard only lists what’s under `Data/Tools/Projects/`.

---

## Repository

### Open

`Tools/Repository.md`

### The slider

| Side | Purpose |
|------|---------|
| **New** | Capture and triage |
| **Repository** | Browse structured folders under vault-root `Data/` |

### New (capture)

- Inbox: `Data/Tools/Repository/New/`
- Notes show under **New** by default.
- Add tag `developing` (in frontmatter `tags`) → also listed under **Developing** (same folder; tag filter).
- Use the on-page controls to change state where the UI offers them.

### Repository (browse)

- Walks **`Data/`** but **does not** show **`Data/Tools/`** at the top level (that branch holds Agenda / Projects / inbox data).
- Flow: **base folder → subfolder → subfolder → board folder** with **`_board.md`** and notes.
- Boards control tiles, layout, and linking in the UI.

### Demo layout

See **`Data/README.md`** — e.g. **Commercial Clients → Americas East** and `Board - …` folders.

### Archive

`z_archive/Repository` for material you retire from the active tree.

---

## Sample data in this repo

Pre-filled so you can explore without setup:

- **Agenda → Unfinished** — Sample week **2026-03-16 … 2026-03-22**; Mon–Sat completed, **Sun 2026-03-22** open (edit dates if needed).
- **Agenda → Missions** — e.g. **Demo Q1 Outreach**, **Weekly Team Sync**.
- **Projects** — Eight folders under `Data/Tools/Projects/` (mix of started / unstarted).
- **Repository** — Notes in **New**; big `Data/` tree; boards under **Commercial Clients → Americas East**.

---

## Further reference

Using a **parent** vault that describes Work / Maximus / Combined? See **`AGENTS.md`** there for cross-vault paths. This **Demo** vault follows the **Work**-style layout under `Data/Tools/…`.
