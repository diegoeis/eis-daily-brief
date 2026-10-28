---
name: brief-view
description: Open the daily brief page - a local web page that shows the latest daily note as a task dashboard (open, new this week, due today, overdue; filters by topic; sort) and writes every change back to the markdown in the brief's format (mark done, add a comment, add a task). Use when the user says "abre a daily", "mostra minha daily", "abre o painel da daily", "quero ver minhas tarefas", "open my daily brief", "show the daily dashboard", or runs /brief-view. Before opening, runs brief-generate, which creates today's note or updates it when it exists; "--no-generate" only opens the page. Opens the page in the host's preview pane when it has one, otherwise in the default browser. "--config PATH" names the workspace (the chosen folder, .eis-daily-brief/ or its config.json). Copies the page into the workspace (.eis-daily-brief/app/) and opens that copy, so its address never changes. Does not change the config (use brief-setup).
---

# brief-view

Bring today's daily note up to date, then open the user's copy of the daily page, in their workspace (`.eis-daily-brief/app/`). The page reads and writes the latest daily note on disk by itself, so this skill only runs the brief, keeps the copy current, opens it and tells the user what to do the first time.

Write to the user in the language they write in.

## 1. Bring today's note up to date

1. Find the workspace and its config as described in `../../references/config.md` (relative to this skill's folder).
2. **Config found and valid**: go straight to step 2 when `brief-generate` called this skill (it just wrote the note) or when the request has `--no-generate`. Otherwise tell the user in one line that the brief runs first, then follow the `brief-generate` skill (its `SKILL.md` is `../brief-generate/SKILL.md`, relative to this skill's folder) for today: it creates today's note when it doesn't exist and updates it when it does. Pass `--config` along when this run had it, and never `--force`. It must not offer the page at its end: this skill opens it next. Show its chat output, then go to step 2 whatever its `STATUS`. When it ends `BLOCKED`, the page shows the latest note it finds.
3. **Config not found or invalid**: stop. Say so in one line, with the reason, and that `/brief-setup` creates the workspace with the config and the page. Without a workspace there is no page copy to open.

## 2. Get the page ready

Install or update the user's copy in `.eis-daily-brief/app/` and write `.eis-daily-brief/page-settings.js`, as "The page" in `../../references/config.md` says: the copy is left alone when its `VERSION` matches the plugin's, but `page-settings.js` is written every time. The plugin's own `app/` folder (`../../app/`, relative to this skill's folder) is only the source of that copy: never open it. If it is missing, stop and say the plugin install is incomplete.

## 3. Open it

Open `.eis-daily-brief/app/index.html`, at its address as the user's computer sees it (see "The page" in the reference). Use the first option the session has:

1. **A preview pane of the host** that opens local HTML files. In a pane the page runs as a real page: it can pick a folder and read and write files.
2. **The default browser**, through a shell command: `open "<path>"` on macOS, `xdg-open "<path>"` on Linux, `start "" "<path>"` on Windows.
3. Neither (for example the session runs isolated from the user's computer): give the user the `file:///` address to open by hand, and suggest saving it as a bookmark: it never changes.

Never render the page as a chat artifact or inline widget: those run sandboxed, can't reach the user's files and would show only sample data.

## 4. Tell the user, in at most four lines

- The page reads the folder of the daily notes: `output.folder` in the config (name it). The first time, open **Configurações → Escolher pasta** and pick that folder. Until then the page shows sample data.
- Marking a task, adding a comment or adding a task writes to the note at once, in the brief's format. Changes made in the note (by hand or by `brief-generate`) show on the page within 5 seconds, or as soon as the tab comes back to the front.
- It needs a Chromium browser (Chrome, Edge, Arc, Dia, Brave) or the host's preview pane. Safari and Firefox can't pick folders.
- The address never changes, plugin updates included: the copy is updated in place.

## Constraints

- This skill writes only the page copy in `.eis-daily-brief/app/` and `.eis-daily-brief/page-settings.js`. The daily note is written only by `brief-generate`, when step 1 runs it. The page writes only the daily note the user's folder holds, and only what the user does on it.
- Do not copy the page anywhere else, edit it or serve it over the network.
