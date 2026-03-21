# Demo vault (Work layout)

Scaffold matching the **Work** vault: **Tools** dashboards, **Templates**, **`Data/Tools/`**, plus a large **`Data/`** tree for Repository navigation.

Open this folder as an Obsidian vault, or see the parent vault’s **`AGENTS.md`** for how Agenda / Projects / Repository fit together.

| Path | Role |
|------|------|
| `Tools/` | Agenda, Project, Repository dashboards + `REPO_LAYOUT.md` |
| `Templates/` | Agenda + Project Folder templates (+ `fragments/`) |
| `Data/Tools/` | Agenda, Projects, Repository **tool** data |
| `Data/` (outside `Tools`) | **Repository** layer folders — see `Data/README.md` |
| `z_archive/` | Agenda, Projects, Repository, Ideas, Resources archives |

**Plugins (match Work):** Dataview, Templater, Tasks, etc.

## Sample data (filled)

| Area | What’s included |
|------|------------------|
| **Agenda → Unfinished** | Mon–Sat **2026-03-16 … 2026-03-21** completed; **Sun 2026-03-22** left **unchecked** (no completion) so the last day of the week is not “done” ahead of time. Adjust ISO dates if your demo week differs. |
| **Agenda → Missions** | `Demo Q1 Outreach` + `Weekly Team Sync` — mission `completion` matches Mon–Sat; **no Sunday mission completion**. |
| **Projects** | **Eight** folders under `Data/Tools/Projects/`: `Site Revamp`, `Home Lab`, `Onboarding Kit`, `SOC2 Prep`, `Partner Portal`, `Health Score`, `Invoice Flow`, `Release Train` (each with main note + `dashboard-include: true`; **Active** = `status: started`; **Unstarted** = `Home Lab`, `Partner Portal`; some folders have extra notes). |
| **Repository → New** | Capture notes + `#developing` sample; more files can be added under `Data/Tools/Repository/New/`. |
| **Repository → Data** | **Six base** verticals × **six regions** each; **`Commercial Clients` → `Americas East`** holds **six boards** (`Board - …` + `_board.md` + notes). See **`Data/README.md`**. |
