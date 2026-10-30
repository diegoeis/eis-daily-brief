# eis-task-manager

A task manager for your tasks and obligations: it builds a daily note with the tasks and replies you need to act on. It groups them by topic and by person, and closes tasks by itself when the daily update finds evidence that they were done.

It works in Claude Code, Cowork and Hermes.

## Skills

- `tasks-setup`: creates, shows (`--show`) or edits your workspace, `eis-ops/task-manager/`, with the config and your copy of the daily page. Interactive. The first question is the folder where the workspace will live.
- `tasks-update`: writes the note for the day from the config, or updates it when it already exists. Runs unattended, so it can be scheduled, also several times a day. Without a config it stops with `STATUS: BLOCKED` and says how to make the file reachable. When you run it yourself, it ends by offering to open the daily page; scheduled runs never ask. Flags: `--date YYYY-MM-DD`, `--config PATH`, `--force` (rebuild the day's note from the previous one, dropping edits), `--no-view`.
- `tasks-view`: opens your copy of the daily page (below) in the host's preview pane or in the default browser, or gives you its address when the session can't open it. Before opening, it runs `tasks-update`, which creates today's note or updates it, so one scheduled `tasks-view` does both. Flags: `--config PATH`, `--no-generate` (only open the page).

- `tasks-act`: runs the actions you left for the AI in the daily note: comments under a task that start with 🤖 (the page's 🤖 button in the comment field puts it there), like `🤖 /prod-specs-story Write the story and the mock for …` or `🤖 create a cron that watches this thread`. It uses whatever the session has (skills, plugins, connectors, scheduled jobs), marks each one 🤖✅ or 🤖⚠️ and adds a result comment below it with what was done and the links. Before running an action it marks it 🤖⏳, so two runs never do the same one; a run that stopped midway leaves it 🤖⚠️ for you to check. `skills/tasks-act/scripts/pending.py` lists the pending actions without an LLM, so a schedule can skip the agent when there are none. Run it yourself or schedule it. Flags: `--config PATH`, `--dry-run` (only list the pending actions).

## What the note has

Agenda (today and tomorrow, with conflicts), tasks grouped by topic (new ones and open ones migrated from the previous note; inside each group, nearest due date first, then most recently created, then highest priority), pending issues by person, important topics and concluded items. Every line cites its source: a message permalink, an e-mail thread, an issue link or a note in your vault.

Sources, each one optional: calendar, messenger, e-mail, meeting notes, status reports, a tracker, and the previous daily note. Any tool the session has for a source works (connector, MCP server, skill or CLI). A source that is on but has no tool is skipped and reported as a warning.

## The daily page

The plugin ships a local web page, `src/app/`, that shows the latest daily note as a task dashboard: open tasks, new this week, due today and overdue; tasks grouped by topic, with filters and sorting. Tabs for open, due today, done, cancelled and all tasks. Marking a task done or cancelled (`- [-]`), adding a task or a comment, and editing by double click (task text and priority with the Obsidian Tasks marks 🔺 ⏫ 🔼 🔽 ⏬, comment, due date) write to the note at once, in the brief's format, and changes made in the note show on the page within 5 seconds (one file check while the tab is visible; nothing runs while it is hidden).

- No server and no install: plain HTML, CSS and JavaScript, opened straight from disk.
- You open your copy, `eis-ops/task-manager/app/index.html` in your workspace, never the plugin's folder: the plugin folder moves on every update (in some hosts it lives in a temporary folder), and the browser keeps your choices per page address. `tasks-setup` and `tasks-view` keep the copy current, so its address never changes.
- The first time, pick the folder of the daily notes in **Settings** (the same folder as `output.folder`). Until then it shows sample data.
- It needs a Chromium browser (Chrome, Edge, Arc, Dia, Brave) or a host preview pane that opens local files (Hermes desktop does). Safari and Firefox can't pick folders. Chat artifacts and inline widgets run sandboxed and can't reach your files.
- Filters, sorting and the chosen folder stay in the browser. The page never writes anything but the note.
- The interface text is in Portuguese for now.

## Install

### Claude Code

```
/plugin marketplace add diegoeis/eis-plugins
/plugin install eis-task-manager@eis-plugins
```

### Cowork / Claude Desktop (zip)

The `src/` folder is the whole plugin. Zip its contents, not the folder itself, so `.claude-plugin/plugin.json` sits at the root of the zip:

```
git clone https://github.com/diegoeis/eis-task-manager.git
cd eis-task-manager/src
zip -r ../eis-task-manager.zip . -x '*.DS_Store'
```

Then upload `eis-task-manager.zip` in Claude Desktop > Skills > Personal plugins > +. If you have the repo checked out, `./scripts/pack.sh` builds the same zip in `dist/` and validates it first.

### Hermes

```
hermes plugins install diegoeis/eis-task-manager/src --enable
```

The skills show up as `eis-task-manager:tasks-setup`, `eis-task-manager:tasks-update` and `eis-task-manager:tasks-view`. Update with `hermes plugins update eis-task-manager`.

## Configuration

Everything the plugin keeps for you lives in one folder, `eis-ops/task-manager/`, that `tasks-setup` creates inside a folder you choose (the root of your notes vault works well). `eis-ops/` is shared with your other assistant plugins; each keeps its own subfolder:

```
<your folder>/eis-ops/task-manager/
├── config.json         who you are, language, notes folder, sources, priority people and channels, meeting and report folders
├── daily-format.json   optional: how you write tasks, when it isn't the plugin's default
├── page-settings.js    what the page needs from the two files above (written by the skills)
├── state.json          when tasks-update last ran; the next run only reads what came after
└── app/                your copy of the daily page
```

You can edit `config.json` by hand; the skills read it again before every run. The plugin never writes to `~/.claude/`, `${CLAUDE_PLUGIN_DATA}` or its own folder. Schema in [`src/references/config.md`](src/references/config.md). **Daily format.** How tasks are written (section heading, groups, task lines, date marks, comments) is data, not code: [`src/references/daily-format.json`](src/references/daily-format.json) is the default, described in [`daily-format.md`](src/references/daily-format.md) with a JSON Schema. If you already write daily notes your own way, `tasks-setup` reads a few of them and proposes a `daily-format.json` for your workspace; `tasks-update` writes and the page reads and edits by it. The page also finds your notes by `output.pattern` (for example `YYYY/MM/DD.md`).

An older workspace still works: `.eis-task-manager/` (v0.9.0 to v0.12), or from when the plugin was named `eis-daily-brief` (`.eis-daily-brief/`, or `eis-daily-brief.json` straight in the folder before v0.5.0); `tasks-setup` offers to move it to `eis-ops/task-manager/`.

The skills look for the file in this order:

1. `--config PATH` in the request (a folder or the file itself).
2. The root of a folder connected to the session, or one level below. In Cowork, connect the folder. In Hermes and other hosts without folder connection, the working directory counts.
3. A path the host keeps for you: persistent memory, your instructions file, or the `EIS_TASK_MANAGER_CONFIG` environment variable (the older `EIS_DAILY_BRIEF_CONFIG` still works).

## Scheduling

`tasks-update` asks no questions, so it can run on a schedule. Twice a day works well: in the morning it creates the day's note, at the end of the day it updates it. Put the config path in the scheduled prompt:

- **Cowork / Claude Desktop**: a scheduled task with `/tasks-update`, with the config folder connected.
- **Hermes**: a cron job, for example `hermes cron create "0 8,18 * * 1-5" "/eis-task-manager:tasks-update --config /path/to/eis-ops/task-manager" --skill eis-task-manager:tasks-update`.

## Running it again during the day

When the day's note already exists, `tasks-update` updates it instead of stopping: the note is the base, so every task, comment and check you made by hand or on the page stays. The run closes the tasks that were done, adds the new ones, sorts each group again and rewrites the agenda, pending issues, topics and concluded items. If you edit the note while it runs, your edit wins: the run reads the note again right before writing, compares it with what it read at the start, applies its changes on top of yours and tells you what you had changed. When nothing changed, the file is left untouched. A task you closed never comes back as new.

## Closing tasks automatically

Every open task, migrated or new, is closed (`[x]` with `✅ date` and a sub-item with the evidence) when:

- the messenger or e-mail thread shows you replied, or the person who asked closed the matter; for a message in a DM, the later messages of the DM count too, not only its thread;
- the linked tracker issue (Jira, Linear...) is in a done status, dated when it got there (turn it off with `sources.tracker: false`);
- the task names a merge request (or an issue) that was merged or closed, and the task was to merge, approve, review it or answer whether it could be merged;
- the task came from a vault note (a meeting note, for example) and its checkbox there is done; when the note shows nothing, a targeted search runs (below);
- the task has no link (you added it by hand): the same targeted search;
- the most recent report shows the task done or decided.

The targeted search never sweeps a whole source. Cheapest first, it stops at the first evidence: (1) later notes of the same series as the source note (the next 1:1 with that person, the next session of a recurring sync: same folder, same title without the date); (2) the people the task names, or the one or two people of the source note: vault notes that cite them, then the direct messages and e-mail threads with them; (3) tracker issues cited in the task or its note. Tasks are batched by person and series, so each DM or series is read once per run, and only what came after the last run (`state.json`) is read. Threads and issues linked from a task are opened in full only when they moved since the last run (latest reply, last update); the tracker is checked in one query for all issues.

A mention, a plan or partial progress is not evidence. Without evidence, the task stays open, but what moved since the last run (a reply in the DM or thread, a new status of the merge request or issue) is summed up in one dated comment under it per run, linking the latest message, never the same one twice. When a closed task came from a checkbox in a vault note, that checkbox is ticked too.

## Project layout

```
eis-task-manager/
├── src/                          plugin root: only this goes into the package
│   ├── .claude-plugin/plugin.json   manifest for Claude Code and Cowork
│   ├── plugin.json                  Agent Plugins v1 manifest (Hermes)
│   ├── references/config.md
│   ├── skills/
│   └── app/                         the daily page (index.html, js/, css/, vendor/eis-ds.css)
├── docs/                         specs and decisions
├── scripts/
│   ├── pack.sh                   builds the package in dist/
│   ├── vendor-eis-ds.py          rebuilds src/app/vendor/eis-ds.css from an eis-ds checkout
│   ├── pii-patterns.example.txt  template for the pattern list
│   └── pii-patterns.txt          patterns not allowed in src/ (local, not in git)
├── tests/                        tests of the page's logic (node --test)
├── package.json                  npm test (dev only, not packaged)
├── dist/                         generated builds (not in git)
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Develop

Put skills, agents, hooks and other plugin files inside `src/`, following the [standard plugin layout](https://code.claude.com/docs/en/plugins-reference#standard-layout). Inside a skill, reach other plugin files with paths relative to the skill's folder (`../../references/config.md`), never `${CLAUDE_PLUGIN_ROOT}`: only Claude Code expands it.

Test without packaging:

```
claude --plugin-dir ./src
hermes plugins validate ./src
npm test
```

The page's style is a trimmed copy of [eis-ds](https://github.com/diegoeis/eis-ds) (`src/app/vendor/eis-ds.css`), so the plugin depends on nothing outside itself. When the page starts using another eis-ds class, or eis-ds changes, rebuild it: `python3 scripts/vendor-eis-ds.py /path/to/eis-ds`. Never edit that file by hand.

## Package

1. From the second package on, bump `version` in both `src/.claude-plugin/plugin.json` and `src/plugin.json`.
2. Run:

```
./scripts/pack.sh
```

The script checks that both manifests have the same version, validates the plugin with `claude plugin validate`, searches `src/` for the patterns in `scripts/pii-patterns.txt`, and builds:

- `dist/vX.Y.Z/`: a clean copy of `src/`
- `dist/vX.Y.Z.zip`: the zip of that folder, ready to import

It stops if the version already exists in `dist/`.

`scripts/pii-patterns.txt` stays out of git, so your list of sensitive terms never reaches the repository. Anyone who clones the project creates their own from `scripts/pii-patterns.example.txt`.
