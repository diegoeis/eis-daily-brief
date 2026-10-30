# Workspace and config - .eis-task-manager/

Everything the plugin keeps for a user lives in one folder, `.eis-task-manager/`, created by `tasks-setup` inside a folder the user chose (for example the root of their notes vault):

```
<folder the user chose>/
└── .eis-task-manager/          the workspace
    ├── config.json            all personal settings (schema below)
    ├── daily-format.json      optional: how the user writes tasks (see daily-format.md); absent = the default
    ├── page-settings.js       what the page needs from the two files above (see "The page"); written by the skills
    ├── state.json             written by tasks-update at the end of each run: {"lastCheck": ISO date-time}; start of the next run's search window
    ├── act-state.json         written by tasks-act: the actions it is running now, with their start time
    └── app/                   the user's copy of the daily page (see "The page")
        ├── index.html
        └── VERSION            plugin version of this copy
```

The user may edit `config.json` by hand at any time; every skill reads it again before every run. The leading dot keeps the folder out of note apps (Obsidian, for example, ignores dot folders).

Never store the workspace, a copy of it or a pointer to it in `~/.claude/`, `${CLAUDE_PLUGIN_DATA}`, the plugin's own folder or any other place than the folder the user chose. In Cowork the plugin can only read and write inside folders connected to the session, so the user must connect the folder that holds `.eis-task-manager/`.

**Older layouts.** Skills still read them, and `tasks-setup` offers to move them to `.eis-task-manager/`:

- Before v0.9.0 the plugin was named `eis-daily-brief` and the workspace was `.eis-daily-brief/`, with the same files inside. A run that finds it uses it as the workspace (it reads and writes there) until the user moves it.
- Before v0.5.0 the config was a file named `eis-daily-brief.json` straight in the chosen folder. Its workspace is the `.eis-daily-brief/` folder next to it (the page goes there).

## Finding the workspace

Every skill looks for it in this order and stops at the first hit:

1. A path given in the request, as `--config {{path}}` or in prose: the chosen folder, the `.eis-task-manager/` folder or the config file itself. This is the way for scheduled runs and agents without a connected folder.
2. `.eis-task-manager/config.json` (or, in an older layout, `.eis-daily-brief/config.json` or `eis-daily-brief.json`) at the root of a folder connected to the session, or one level below it. On hosts without folder connection, the session's working directory counts as the connected folder.
3. A path the host keeps for this user across sessions: an entry in the host's persistent memory, a line in the user's instructions file, or the `EIS_TASK_MANAGER_CONFIG` environment variable (or the older `EIS_DAILY_BRIEF_CONFIG`) when the session can read environment variables.

Nothing else: no searching parent folders, home directories or other hidden folders.

## The page

The plugin ships a page, `app/` in the plugin's own folder, that shows the latest daily note and writes changes back to it. The user opens **their copy** in `.eis-task-manager/app/`, never the plugin's: the plugin folder moves on every update (and in some hosts lives in a temporary folder), and the browser keeps the chosen notes folder per page address. A copy in the workspace keeps one address forever.

**Install or update the copy** (`tasks-setup` after saving, `tasks-view` before opening):

1. Read the plugin version from the plugin's manifest (`plugin.json` at the plugin root, two levels above a skill's folder).
2. If `.eis-task-manager/app/VERSION` exists and holds that version, the copy is current: do nothing.
3. Otherwise replace `.eis-task-manager/app/` with the plugin's `app/` folder: every file and subfolder, same names, nothing else. Use a shell copy when the session has one; else read and write each file. Then write the version in `.eis-task-manager/app/VERSION`.
4. The copy holds no personal data: never write config values or notes into it.
5. Write `.eis-task-manager/page-settings.js` (outside `app/`, so updates never replace it). A browser page can't read a `.json` from disk but can load a script, so this file carries what the page needs, as one line of JavaScript:

   ```js
   window.EisTaskManagerSettings = {"pattern": "<output.pattern>", "format": <daily-format.json contents, or null>, "vault": "<vault.path, or null>", "folder": "<output.folder>"};
   ```

   With `vault`, the page turns each `[[Note]]` into a link that opens the note in Obsidian (`obsidian://open?file=<Note>.md`), with the note's path as its tooltip, and the path of the open daily note (its place in the vault, from `folder`) into the same kind of link.

   Write it every time, even when the copy was current: the config or the format may have changed. Valid JSON after the `=`, nothing else in the file. It holds no personal data beyond the file pattern, the format and the vault and notes folder paths.

**The address to give the user** is the absolute path of `.eis-task-manager/app/index.html` **as the user's computer sees it** (`file:///…`). Hosts that run the session in an isolated environment mount the user's folders under another path: map it back to the user's path (the host shows both, or use the folder path the user gave in setup). If that is not possible, say it is `<folder you chose>/.eis-task-manager/app/index.html`.

## Schema

```json
{
  "schemaVersion": 1,
  "me": {
    "name": "{{full name}}",
    "emails": ["{{email}}"]
  },
  "language": "{{output language, e.g. pt-br}}",
  "windowDays": 2,
  "output": {
    "folder": "{{absolute path of the folder that holds the daily notes}}",
    "pattern": "YYYY-MM/YYYY-MM-DD.md"
  },
  "sources": {
    "calendar": true,
    "messenger": true,
    "email": true,
    "meetings": true,
    "reports": true,
    "tracker": true
  },
  "people": [
    { "name": "{{full name}}", "group": "{{group, e.g. Leadership, My team, Stakeholders}}", "reportsTo": "{{optional: full name of their lead}}" }
  ],
  "channels": [
    { "name": "{{channel name}}", "url": "{{channel URL}}" }
  ],
  "meetings": {
    "folders": ["{{absolute path of a folder with meeting notes}}"],
    "titleTerms": ["{{term found in meeting titles to read}}"],
    "highPriorityTerms": ["{{term for meetings where stakeholders comment, read first}}"]
  },
  "reports": {
    "folders": ["{{absolute path of a folder with status reports}}"]
  },
  "vault": {
    "path": "{{absolute path of the notes vault, used to resolve [[wikilinks]] and person notes}}",
    "personNoteType": "person"
  }
}
```

## Field rules

- `me` identifies the user in messenger, email and calendar ("did I reply?", "am I the organizer?"). Required.
- `language` is the language of everything written in the daily note. Section names of the template never change.
- `windowDays` is how far back calendar, messenger and email are read. The closing check ignores it.
- `output.folder` is required. It is also the folder the user picks in the page's settings. The page finds the latest note by `output.pattern` (through `page-settings.js`). `pattern` is relative to it; `YYYY`, `MM` and `DD` are replaced by the run date.
- `sources` turns each source on or off. A source that is on but has no connected tool is skipped silently. `tracker` is only used to close tasks that link to an issue (it never creates tasks); a missing `tracker` key counts as on.
- `people` and `channels` are the priority list for the messenger; messages from anyone else that ask the user something directly still count, but these are read first.
- `meetings.folders`, `reports.folders` and `vault.path` are optional; a missing one turns that part off.
- Unknown keys are kept as they are. Never delete a key the user added by hand.
