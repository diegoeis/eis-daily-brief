---
name: brief-view
description: Open the daily brief page - a local web page that shows the latest daily note as a task dashboard (open, new this week, due today, overdue; filters by topic; sort) and writes every change back to the markdown in the brief's format (mark done, add a comment, add a task). Use when the user says "abre a daily", "mostra minha daily", "abre o painel da daily", "quero ver minhas tarefas", "open my daily brief", "show the daily dashboard", or runs /brief-view. Opens the page in the host's preview pane when it has one, otherwise in the default browser. Does not generate the note (use brief-generate) and does not change the config (use brief-setup).
---

# brief-view

Open the page that ships with the plugin. It reads and writes the latest daily note on disk by itself, so this skill only opens it and tells the user what to do the first time.

Write to the user in the language they write in.

## 1. Find the page

The page is `../../app/index.html`, relative to this skill's folder. Resolve it to an absolute path and check that the file exists. If it doesn't, stop and say the plugin install is incomplete (the `app/` folder is missing).

## 2. Open it

Use the first option the session has:

1. **A preview pane of the host** that opens local HTML files. In a pane the page runs as a real page: it can pick a folder and read and write files.
2. **The default browser**, through a shell command: `open "<path>"` on macOS, `xdg-open "<path>"` on Linux, `start "" "<path>"` on Windows.
3. Neither: give the user the `file://` URL to open by hand.

Never render the page as a chat artifact or inline widget: those run sandboxed, can't reach the user's files and would show only sample data.

## 3. Tell the user, in at most four lines

- The page reads the folder of the daily notes: the same folder as `output.folder` in `eis-daily-brief.json` (find the config as `../../references/config.md` says; if found, name the folder). The first time, open **Configurações → Escolher pasta** and pick that folder. Until then the page shows sample data.
- Marking a task, adding a comment or adding a task writes to the note at once, in the brief's format. Changes made in the note (by hand or by `brief-generate`) show on the page in a few seconds.
- It needs a Chromium browser (Chrome, Edge, Arc, Dia, Brave) or the host's preview pane. Safari and Firefox can't pick folders.
- After a plugin update the page may live in a new folder; the browser then asks for the folder again.

## Constraints

- This skill writes nothing. The page writes only the daily note the user's folder holds, and only what the user does on it.
- Do not copy the page elsewhere, edit it or serve it over the network.
