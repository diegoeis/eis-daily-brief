# eis-daily-brief

A plugin that builds a daily brief note with the tasks and replies you need to act on. It groups them by topic and by person, and closes tasks by itself when the daily update finds evidence that they were done.

It works in Claude Code, Cowork and Hermes.

## Skills

- `brief-setup`: creates, shows (`--show`) or edits your workspace, `.eis-daily-brief/`, with the config and your copy of the daily page. Interactive. The first question is the folder where the workspace will live.
- `brief-generate`: writes the note for the day from the config, or updates it when it already exists. Runs unattended, so it can be scheduled, also several times a day. Without a config it stops with `STATUS: BLOCKED` and says how to make the file reachable. When you run it yourself, it ends by offering to open the daily page; scheduled runs never ask. Flags: `--date YYYY-MM-DD`, `--config PATH`, `--force` (rebuild the day's note from the previous one, dropping edits), `--no-view`.
- `brief-view`: opens your copy of the daily page (below) in the host's preview pane or in the default browser, or gives you its address when the session can't open it. When today's note doesn't exist yet, it runs `brief-generate` first. Flag: `--config PATH`.

## What the note has

Agenda (today and tomorrow, with conflicts), tasks grouped by topic (new ones and open ones migrated from the previous note; inside each group, nearest due date first, then most recently created, then highest priority), pending issues by person, important topics and concluded items. Every line cites its source: a message permalink, an e-mail thread, an issue link or a note in your vault.

Sources, each one optional: calendar, messenger, e-mail, meeting notes, status reports, a tracker, and the previous daily note. Any tool the session has for a source works (connector, MCP server, skill or CLI). A source that is on but has no tool is skipped and reported as a warning.

## The daily page

The plugin ships a local web page, `src/app/`, that shows the latest daily note as a task dashboard: open tasks, new this week, due today and overdue; tasks grouped by topic, with filters and sorting. Marking a task done, adding a comment or adding a task writes to the note at once, in the brief's format, and changes made in the note show on the page in a few seconds.

- No server and no install: plain HTML, CSS and JavaScript, opened straight from disk.
- You open your copy, `.eis-daily-brief/app/index.html` in your workspace, never the plugin's folder: the plugin folder moves on every update (in some hosts it lives in a temporary folder), and the browser keeps your choices per page address. `brief-setup` and `brief-view` keep the copy current, so its address never changes.
- The first time, pick the folder of the daily notes in **Configurações** (the same folder as `output.folder`). Until then it shows sample data.
- It needs a Chromium browser (Chrome, Edge, Arc, Dia, Brave) or a host preview pane that opens local files (Hermes desktop does). Safari and Firefox can't pick folders. Chat artifacts and inline widgets run sandboxed and can't reach your files.
- Filters, sorting and the chosen folder stay in the browser. The page never writes anything but the note.
- The interface text is in Portuguese for now.

## Install

### Claude Code

```
/plugin marketplace add diegoeis/eis-plugins
/plugin install eis-daily-brief@eis-plugins
```

### Cowork / Claude Desktop (zip)

The `src/` folder is the whole plugin. Zip its contents, not the folder itself, so `.claude-plugin/plugin.json` sits at the root of the zip:

```
git clone https://github.com/diegoeis/eis-daily-brief.git
cd eis-daily-brief/src
zip -r ../eis-daily-brief.zip . -x '*.DS_Store'
```

Then upload `eis-daily-brief.zip` in Claude Desktop > Skills > Personal plugins > +. If you have the repo checked out, `./scripts/pack.sh` builds the same zip in `dist/` and validates it first.

### Hermes

```
hermes plugins install diegoeis/eis-daily-brief/src --enable
```

The skills show up as `eis-daily-brief:brief-setup` and `eis-daily-brief:brief-generate`. Update with `hermes plugins update eis-daily-brief`.

## Configuration

Everything the plugin keeps for you lives in one folder, `.eis-daily-brief/`, that `brief-setup` creates inside a folder you choose (the root of your notes vault works well; Obsidian ignores dot folders):

```
<your folder>/.eis-daily-brief/
├── config.json         who you are, language, notes folder, sources, priority people and channels, meeting and report folders
├── daily-format.json   optional: how you write tasks, when it isn't the plugin's default
├── page-settings.js    what the page needs from the two files above (written by the skills)
├── state.json          when brief-generate last ran; the next run only reads what came after
└── app/                your copy of the daily page
```

You can edit `config.json` by hand; the skills read it again before every run. The plugin never writes to `~/.claude/`, `${CLAUDE_PLUGIN_DATA}` or its own folder. Schema in [`src/references/config.md`](src/references/config.md). **Daily format.** How tasks are written (section heading, groups, task lines, date marks, comments) is data, not code: [`src/references/daily-format.json`](src/references/daily-format.json) is the default, described in [`daily-format.md`](src/references/daily-format.md) with a JSON Schema. If you already write daily notes your own way, `brief-setup` reads a few of them and proposes a `daily-format.json` for your workspace; `brief-generate` writes and the page reads and edits by it. The page also finds your notes by `output.pattern` (for example `YYYY/MM/DD.md`).

A config from before v0.5.0 (`eis-daily-brief.json` straight in the folder) still works; `brief-setup` offers to move it.

The skills look for the file in this order:

1. `--config PATH` in the request (a folder or the file itself).
2. The root of a folder connected to the session, or one level below. In Cowork, connect the folder. In Hermes and other hosts without folder connection, the working directory counts.
3. A path the host keeps for you: persistent memory, your instructions file, or the `EIS_DAILY_BRIEF_CONFIG` environment variable.

## Scheduling

`brief-generate` asks no questions, so it can run on a schedule. Put the config path in the scheduled prompt:

- **Cowork / Claude Desktop**: a scheduled task with `/brief-generate`, with the config folder connected.
- **Hermes**: a cron job, for example `hermes cron create "15 8 * * 1-5" "/eis-daily-brief:brief-generate --config /path/to/.eis-daily-brief" --skill eis-daily-brief:brief-generate`.

## Running it again during the day

When the day's note already exists, `brief-generate` updates it instead of stopping: the note is the base, so every task, comment and check you made by hand or on the page stays. The run closes the tasks that were done, adds the new ones, sorts each group again and rewrites the agenda, pending issues, topics and concluded items. If you edit the note while it runs, your edit wins and the run's changes are applied on top. When nothing changed, the file is left untouched. A task you closed never comes back as new.

## Closing tasks automatically

Every open task, migrated or new, is closed (`[x]` with `✅ date` and a sub-item with the evidence) when:

- the messenger or e-mail thread shows you replied, or the person who asked closed the matter;
- the linked tracker issue (Jira, Linear...) is in a done status, dated when it got there (turn it off with `sources.tracker: false`);
- the task came from a vault note (a meeting note, for example) and its checkbox there is done; when the note shows nothing, a targeted search runs (below);
- the task has no link (you added it by hand): the same targeted search;
- the most recent report shows the task done or decided.

The targeted search never sweeps a whole source. Cheapest first, it stops at the first evidence: (1) later notes of the same series as the source note (the next 1:1 with that person, the next session of a recurring sync: same folder, same title without the date); (2) the direct messages and e-mail threads with the people the task names, or with the one or two people of the source note; (3) tracker issues cited in the task or its note. Tasks are batched by person and series, so each DM or series is read once per run, and only what came after the last run (`state.json`) is read.

A mention, a plan or partial progress is not evidence. Without evidence, the task stays open. When a closed task came from a checkbox in a vault note, that checkbox is ticked too.

## Project layout

```
eis-daily-brief/
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
