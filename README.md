# eis-daily-brief

A plugin that builds a daily brief note with the tasks and replies you need to act on. It groups them by topic and by person, and closes tasks by itself when the daily update finds evidence that they were done.

It works in Claude Code, Cowork and Hermes.

## Skills

- `brief-setup`: creates, shows (`--show`) or edits the config file `eis-daily-brief.json`. Interactive. The first question is the folder where the file will live.
- `brief-generate`: writes the note for the day from the config. Runs unattended, so it can be scheduled. Without a config it stops with `STATUS: BLOCKED` and says how to make the file reachable. Flags: `--date YYYY-MM-DD`, `--config PATH`, `--force`.

## What the note has

Agenda (today and tomorrow, with conflicts), tasks grouped by topic (new ones and open ones migrated from the previous note), pending issues by person, important topics and concluded items. Every line cites its source: a message permalink, an e-mail thread, an issue link or a note in your vault.

Sources, each one optional: calendar, messenger, e-mail, meeting notes, status reports, a tracker, and the previous daily note. Any tool the session has for a source works (connector, MCP server, skill or CLI). A source that is on but has no tool is skipped and reported as a warning.

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

Everything personal (who you are, language, notes folder, sources that are on, priority people and channels, meeting and report folders) lives in `eis-daily-brief.json`, in a folder you choose during setup. You can edit it by hand; the brief reads it again before every run. The plugin never writes to `~/.claude/`, `${CLAUDE_PLUGIN_DATA}` or its own folder. Schema in [`src/references/config.md`](src/references/config.md).

The skills look for the file in this order:

1. `--config PATH` in the request (a folder or the file itself).
2. The root of a folder connected to the session, or one level below. In Cowork, connect the folder. In Hermes and other hosts without folder connection, the working directory counts.
3. A path the host keeps for you: persistent memory, your instructions file, or the `EIS_DAILY_BRIEF_CONFIG` environment variable.

## Scheduling

`brief-generate` asks no questions, so it can run on a schedule. Put the config path in the scheduled prompt:

- **Cowork / Claude Desktop**: a scheduled task with `/brief-generate`, with the config folder connected.
- **Hermes**: a cron job, for example `hermes cron create "15 8 * * 1-5" "/eis-daily-brief:brief-generate --config /path/to/eis-daily-brief.json" --skill eis-daily-brief:brief-generate`.

## Closing tasks automatically

Every open task, migrated or new, is closed (`[x]` with `✅ date` and a sub-item with the evidence) when:

- the messenger or e-mail thread shows you replied, or the person who asked closed the matter;
- the linked tracker issue (Jira, Linear...) is in a done status, dated when it got there (turn it off with `sources.tracker: false`);
- the most recent report shows the task done or decided.

Without evidence, the task stays open. When a closed task came from a checkbox in a vault note, that checkbox is ticked too.

## Project layout

```
eis-daily-brief/
├── src/                          plugin root: only this goes into the package
│   ├── .claude-plugin/plugin.json   manifest for Claude Code and Cowork
│   ├── plugin.json                  Agent Plugins v1 manifest (Hermes)
│   ├── references/config.md
│   └── skills/
├── docs/                         specs and decisions
├── scripts/
│   ├── pack.sh                   builds the package in dist/
│   ├── pii-patterns.example.txt  template for the pattern list
│   └── pii-patterns.txt          patterns not allowed in src/ (local, not in git)
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
```

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
