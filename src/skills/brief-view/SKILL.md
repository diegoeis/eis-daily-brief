---
name: brief-view
description: Open the daily brief page - a local web page that shows the latest daily note as a task dashboard (open, new this week, due today, overdue; filters by topic; sort) and writes every change back to the markdown in the brief's format (mark done, add a comment, add a task). Use when the user says "abre a daily", "mostra minha daily", "abre o painel da daily", "quero ver minhas tarefas", "open my daily brief", "show the daily dashboard", or runs /brief-view. Before opening, checks that today's note exists; when it doesn't, runs brief-generate first. Opens the page in the host's preview pane when it has one, otherwise in the default browser. "--config PATH" names the folder or file of the config. Does not change the config (use brief-setup).
---

# brief-view

Make sure today's daily note exists, then open the page that ships with the plugin. The page reads and writes the latest daily note on disk by itself, so this skill only checks the note, opens the page and tells the user what to do the first time.

Write to the user in the language they write in.

## 1. Make sure today's note exists

Skip this step when `brief-generate` called this skill: it just wrote the note.

1. Find `eis-daily-brief.json` as described in `../../references/config.md` (relative to this skill's folder).
2. **Config found and valid**: today's note is `output.folder` + `output.pattern`, with `YYYY`, `MM` and `DD` replaced by today's local date.
   - **The file exists**: go to step 2.
   - **It doesn't**: tell the user in one line that today's note is missing and will be generated first. Then follow the `brief-generate` skill (its `SKILL.md` is `../brief-generate/SKILL.md`, relative to this skill's folder) for today, passing `--config` along when this run had it, and never `--force`. It must not offer the page at its end: this skill opens it next. Show its chat output, then go to step 2 whatever its `STATUS`. When it ends `BLOCKED`, the page shows the latest earlier note.
3. **Config not found or invalid**: today's note can't be checked or generated. Say so in one line, with the reason and that `brief-setup` creates the config, then go to step 2 anyway.

## 2. Find the page

The page is `../../app/index.html`, relative to this skill's folder. Resolve it to an absolute path and check that the file exists. If it doesn't, stop and say the plugin install is incomplete (the `app/` folder is missing).

## 3. Open it

Use the first option the session has:

1. **A preview pane of the host** that opens local HTML files. In a pane the page runs as a real page: it can pick a folder and read and write files.
2. **The default browser**, through a shell command: `open "<path>"` on macOS, `xdg-open "<path>"` on Linux, `start "" "<path>"` on Windows.
3. Neither: give the user the `file://` URL to open by hand.

Never render the page as a chat artifact or inline widget: those run sandboxed, can't reach the user's files and would show only sample data.

## 4. Tell the user, in at most four lines

- The page reads the folder of the daily notes: the same folder as `output.folder` in `eis-daily-brief.json` (find the config as `../../references/config.md` says; if found, name the folder). The first time, open **Configurações → Escolher pasta** and pick that folder. Until then the page shows sample data.
- Marking a task, adding a comment or adding a task writes to the note at once, in the brief's format. Changes made in the note (by hand or by `brief-generate`) show on the page in a few seconds.
- It needs a Chromium browser (Chrome, Edge, Arc, Dia, Brave) or the host's preview pane. Safari and Firefox can't pick folders.
- After a plugin update the page may live in a new folder; the browser then asks for the folder again.

## Constraints

- This skill writes nothing itself. The daily note is written only by `brief-generate`, when step 1 runs it. The page writes only the daily note the user's folder holds, and only what the user does on it.
- Do not copy the page elsewhere, edit it or serve it over the network.
