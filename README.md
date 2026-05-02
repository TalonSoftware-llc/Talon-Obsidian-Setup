# Talon Obsidian Setup

Vault template with three dashboards: **Agenda**, **Projects**, and **Repository** (DataviewJS + Templater).

**Repository:** [github.com/TalonSoftware-llc/Talon-Obsidian-Setup](https://github.com/TalonSoftware-llc/Talon-Obsidian-Setup)

| Section | Jump to |
|---------|---------|
| **Full setup (do this first)** | [Setup guide](#setup-guide) |
| **How each tool works** | [Agenda](#agenda) · [Projects](#projects) · [Repository](#repository) |
| **Git & license** | [Git](#git) · [License](#license) |

---

## Setup guide

Follow these steps in order. After this section, you can use the three dashboards.

### What you’re installing

| Dashboard | Open this file |
|-----------|----------------|
| **Agenda** | `Tools/Agenda Dashboard.md` |
| **Projects** | `Tools/Project Dashboard.md` |
| **Repository** | `Tools/Repository.md` |

The vault ships **empty** under `Data/` (only placeholder folders). You add your own notes, missions, and projects.

### Before you start

| You need | Why |
|----------|-----|
| [Obsidian](https://obsidian.md/) (desktop) | Runs the app |
| Internet (first time) | Download community plugins |
| Git *or* a ZIP | Get this folder onto your machine |

---

### Step 1 — Get the vault onto your computer

**Option A — Git clone**

```powershell
cd "C:\path\to\your\vaults"
git clone https://github.com/TalonSoftware-llc/Talon-Obsidian-Setup.git
```

You can rename the folder to anything (e.g. `Work-vault`). **Vault root** means that folder—the one that will contain `Tools/`, `Templates/`, `Data/`, `.obsidian/`.

**Option B — ZIP**

On GitHub: **Code → Download ZIP** → extract → use the extracted folder as the vault root (same as above).

---

### Step 2 — Open it as an Obsidian vault

1. Open **Obsidian**.
2. Choose **Open folder as vault** (from the vault list, or **Add vault → Open folder as vault**).
3. Pick the **vault root** folder (must contain `Tools/`, `Templates/`, `Data/`, `.obsidian/`).

You should see **Tools**, **Templates**, **Data**, and **z_archive** in the sidebar.

---

### Step 3 — Install the two required plugins

Everything in `Tools/` expects **Dataview** and **Templater**.

| Plugin | What it does |
|--------|----------------|
| **Dataview** | Runs the dashboard scripts |
| **Templater** | Creates missions & projects from templates + runs `project_agenda_push.js` |

**Do this:**

1. **Settings** → **Community plugins** → turn **Safe mode** **off** (confirm).
2. **Browse** → install **Dataview** and **Templater**.
3. **Installed plugins** → enable **both**.

This repo may already include `.obsidian/plugins/`. If Obsidian warns about versions, update or reinstall from **Community plugins**.

Other plugins listed in `.obsidian/community-plugins.json` are **optional**—you can turn them off for a minimal setup.

---

### Step 4 — Point Templater at this vault’s folders

1. **Settings** → **Templater**
2. Set **Template folder location** to: `Templates`
3. Set **User script folder** to: `Templates`  
   (same folder as `project_agenda_push.js`)

Reload Obsidian after changing this (**Community plugins → Reload** or restart the app).  
If Templater can’t load the script, project notes may show a short warning until this is fixed.

---

### Step 5 — Enable the CSS snippets

1. **Settings** → **Appearance** → **CSS snippets**
2. Turn **on** every snippet that appears (files live in `.obsidian/snippets/`):

| File | Role |
|------|------|
| `agenda-cards.css` | Agenda layout & week strip |
| `project-cards.css` | Project dashboard cards |
| `ideas-cards.css` | Repository / boards / modals |
| `plus-cards.css` | “+” controls |
| `status-buttons.css` | Status & archive buttons |
| `work-dashboard.css` | Shared dashboard styling |

If something looks plain: toggle snippets off/on or reload Obsidian.

---

### Step 6 — Where files go (quick map)

| Path | Purpose |
|------|---------|
| `Tools/*.md` | The three dashboards |
| `Templates/` | Templates + `project_agenda_push.js` |
| `Data/Tools/Agenda/Unfinished/` | Quick Agenda to-dos |
| `Data/Tools/Agenda/<Mission>/` | Mission folders |
| `Data/Tools/Projects/<Project>/` | Project folders |
| `Data/Tools/Repository/New/` | Capture inbox |
| `Data/` *(outside `Tools/`)* | Your Repository tree & `_board.md` boards |
| `z_archive/` | Archived agenda / projects / repository |

More detail: `Data/README.md` and `Data/Tools/README.md`.

---

### Step 7 — Git (optional)

| Topic | Behavior |
|-------|----------|
| **Committed** | Vault notes, tools, templates, snippets |
| **Ignored** | `.obsidian/workspace*.json`, OS junk, `*Edit conflict*` / `*Name clash*` files |
| **Daily use** | Normal `git add` / `commit` / `push` |

If you mix **Git** with **Obsidian Sync** (or similar), watch for duplicate files named with “Edit conflict”.

---

**Setup is done.** Open `Tools/Agenda Dashboard.md` in **Reading view**, then explore Projects and Repository.  
Below is reference-only detail for each tool.

---

## Agenda

**Entry:** `Tools/Agenda Dashboard.md` (use **Reading view**)

| Item type | Where it lives |
|-----------|----------------|
| Quick to-dos | `Data/Tools/Agenda/Unfinished/*.md` |
| Missions | `Data/Tools/Agenda/<MissionName>/<MissionName>.md` |
| Archived standalones | `z_archive/Tools/Agenda/` |

**Unfinished notes**

- Put **`schedule: YYYY-MM-DD`** in YAML when you want a due day (legacy `due` / `scheduled` still work).
- Checking boxes updates **`completion`** in frontmatter.
- Completed items from **past** days can move to **`z_archive/Tools/Agenda`** when the dashboard loads.

**Missions**

- One folder per mission; main note name = folder name.
- **New mission:** Templater → `Templates/Objective Template.md`.

**Past days**

- Pick a past date on the week UI to see archived items for that day.

---

## Projects

**Entry:** `Tools/Project Dashboard.md`

| Item type | Where it lives |
|-----------|----------------|
| Projects | `Data/Tools/Projects/<ProjectName>/` |
| Completed / scrapped | `z_archive/Tools/Projects/Completed/` or `…/Scrapped/` |

**Active vs backlog**

- Controlled by frontmatter **`status: started`** or **`unstarted`** (not by folder name).

**Main note**

- Example: `Data/Tools/Projects/MyThing/MyThing.md`
- Typical fields: `dashboard-include: true`, `priority`, `tags` (`project`, etc.)

**Tasks**

- Use `- [ ]` / `- [x]` markdown tasks (a **`## Tasks`** section keeps things clear).
- **Agenda push** uses Templater’s **`project_agenda_push.js`** to add items under **`Agenda/Unfinished/`**.

**New project**

- **+ New project** on the dashboard → `Templates/Project Folder Template.md`.

**Archive**

- Use **Archive — Completed** / **Archive — Scrapped** on the project note (moves the whole folder).

---

## Repository

**Entry:** `Tools/Repository.md`

| Slider side | What it does |
|-------------|----------------|
| **New** | Inbox: `Data/Tools/Repository/New/` (plus **Developing** when notes use the `developing` tag) |
| **Repository** | Browse folders under vault-root **`Data/`** (the UI hides **`Data/Tools/`** at the top level) |

**Boards**

- Under `Data/` (not under `Data/Tools/`), use **three folder layers**, then a folder with **`_board.md`** plus your notes. Details live in `Tools/Repository.md` and `Data/README.md`.

**Archive**

- Retired material can go in **`z_archive/Repository/`**.

---

## Git

This matches **Step 7** in the [Setup guide](#setup-guide): commit your vault as usual; `.gitignore` skips workspace JSON and common conflict-file patterns; if you use **Obsidian Sync** plus Git, watch for “Edit conflict” duplicates.

---

## License

See **`LICENSE`** in this repo.

If you use a **parent** vault with its own **`AGENTS.md`**, that file may describe alternate roots (e.g. `Work/Data/...`). This template assumes paths like **`Data/Tools/...`** from **vault root**.
