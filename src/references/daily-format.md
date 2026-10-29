# Daily format - daily-format.json

How tasks are written in a daily note, as data: the section, the groups, the task lines, the date marks, the priority marks and the comments. One file is the contract between the two sides that touch the tasks:

- `tasks-update` writes the tasks section by it;
- the daily page reads, marks done, comments and adds tasks by it.

The plugin's default is [`daily-format.json`](daily-format.json), next to this file: the format of `../skills/tasks-update/templates/daily.md`. A user with their own way of writing tasks keeps a `daily-format.json` in their workspace (`.eis-task-manager/daily-format.json`, see `config.md`); without one, the default applies. The schema is [`daily-format.schema.json`](daily-format.schema.json) (JSON Schema 2020-12). Same spirit as the W3C design tokens format: a small, versioned, declarative file that tools on both sides read.

Only the tasks section is described. The rest of the note (agenda, pending issues, topics) follows the template.

## Keys

| Key | What it is | Default |
|---|---|---|
| `version` | Format version. Always `1`. | `1` |
| `dates.format` | How a date is written, with `YYYY`, `MM` and `DD` once each. | `YYYY-MM-DD` |
| `tasks.section.heading` | The whole line that opens the tasks section. | `## Tasks` |
| `tasks.section.endsAt` | A line starting with any of these ends the section. | `## `, `---` |
| `tasks.group.before` / `after` | Text around a group name, on its own line. | `**` / `**` |
| `tasks.group.default` | Group for tasks with no team, project or topic. New tasks from the page go here. | `Needs to be done` |
| `tasks.item.open` | Start of an open task. | `- [ ] ` |
| `tasks.item.done` | Starts of a done task; the first one is written. | `- [x] `, `- [X] ` |
| `tasks.item.newPrefix` | Prefix on tasks new today; `""` for none. | `new - ` |
| `tasks.item.sourceSeparators` | Text between the description and the source; the last one on the line counts. | ` — `, ` -- ` |
| `tasks.fields.created` / `due` / `completed` | Mark written before each date. `completed` is added when a task is marked done and removed on undo. | `➕` / `📅` / `✅` |
| `tasks.fields.ignore` | Other date marks: kept in the line, hidden on the page. | `⏳`, `🛫` |
| `tasks.priority` | Mark → level (`highest`, `high`, `medium`, `low`, `lowest`). | Obsidian Tasks marks |
| `tasks.comment.indent` | Whitespace before a comment under a task. Any indent of 2+ spaces or a tab is read; this one is written. | 4 spaces |
| `tasks.comment.prefix` | Start of a comment, after the indent. | `- ` |
| `tasks.comment.line` | The rest of the comment, with `{text}` and optionally `{date}`. | `{date} - {text}` |
| `tasks.comment.closedPrefixes` | A comment starting with one of these (any case) is the evidence that closed the task. | `Fechada:`, `Fechado:`, `Closed:` |

How a task line is read, in this order: the start (`open` or `done`), `newPrefix`, the date marks (each followed by a date in `dates.format`), the priority marks; what is left, split at the last source separator, is the description and the source.

## Rules

- **Plain text only.** Every value is literal text, plus the `YYYY`/`MM`/`DD` and `{date}`/`{text}` placeholders. No regular expressions: they are hard to validate and easy to get wrong.
- **Round trip.** Everything the format describes can be read and written back unchanged: marking a task done and then open again gives back the same line.
- **Out of scope**: formats with another structure, such as outliner blocks (Logseq `TODO`/`DONE`), org-mode or tasks in tables. They do not fit this file; do not stretch the schema for them.
- **Changing the format** of existing notes is not this file's job. A new format applies to the notes written after it; the page reads the latest note by the format in force.

## Describing a user's format (tasks-setup)

When the user already writes daily notes in their own way and wants to keep it:

1. Read the two or three latest notes from `output.folder` (by `output.pattern`).
2. Fill each key from what the notes show. Keep the default for anything the notes do not show (for example `newPrefix` when they never mark new tasks: set `""`).
3. Check it: valid against the schema, and the notes' tasks read back as the user sees them (count the tasks, the done ones and the groups, and show the user two or three tasks as read).
4. When a key can't be told from the notes, or the notes are out of scope, say so instead of guessing.
5. Show the JSON and save it only after the user confirms.
