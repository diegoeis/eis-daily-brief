# Config file - eis-daily-brief.json

All personal settings of the plugin live in one JSON file named `eis-daily-brief.json`, in a folder the user chose during `brief-setup`. The user may edit it by hand at any time; `brief-generate` reads it again before every run.

Never store this file, a copy of it or a pointer to it in `~/.claude/`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PLUGIN_ROOT}` or any other hidden location. In Cowork the plugin can only read and write inside folders connected to the session, so the file must live in a folder the user connects.

## Finding the file

Every skill looks for the file in this order and stops at the first hit:

1. A path given in the request, as `--config {{path}}` or in prose (a folder or the file itself). This is the way for scheduled runs and agents without a connected folder.
2. `eis-daily-brief.json` at the root of a folder connected to the session, or one level below it.

Nothing else: no searching parent folders, home directories or hidden folders.

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
- `output.folder` is required. `pattern` is relative to it; `YYYY`, `MM` and `DD` are replaced by the run date.
- `sources` turns each source on or off. A source that is on but has no connected tool is skipped silently. `tracker` is only used to close tasks that link to an issue (it never creates tasks); a missing `tracker` key counts as on.
- `people` and `channels` are the priority list for the messenger; messages from anyone else that ask the user something directly still count, but these are read first.
- `meetings.folders`, `reports.folders` and `vault.path` are optional; a missing one turns that part off.
- Unknown keys are kept as they are. Never delete a key the user added by hand.
