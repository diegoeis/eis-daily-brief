---
name: brief-setup
description: Create, show or edit eis-daily-brief.json, the personal config that brief-generate reads before every run - who the user is, output language, where daily notes are written, which sources are on, priority people and channels, meeting and report folders. Use when the user says "configura o daily brief", "setup do brief", "adiciona uma pessoa prioritária", "adiciona um canal", "muda a pasta da daily", "mostra minha config do brief", "set up my daily brief", or runs /brief-setup. With no config found it creates one; with one found it edits it. "--show" prints the config path and contents. "--config PATH" names the folder or file. Interactive by nature; nothing is saved without the user's confirmation. Does not generate the daily note (use brief-generate).
---

# brief-setup

Fill the config the first time, then add or change things in it. The config schema and the rules for finding the file are in `${CLAUDE_PLUGIN_ROOT}/references/config.md`; read it before step 2.

Write the conversation in the language the user writes in.

## What must always be true

- The only file this skill writes is `eis-daily-brief.json`, in the folder the user chose. Never write to `~/.claude/`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PLUGIN_ROOT}` or any hidden location, and never create a pointer file anywhere else.
- Every question, form or folder picker is preceded by one or two sentences saying why it is asked and what will be done with the answer. In Cowork, text written between tool calls is not shown to the user, so that context goes through the user-message tool before the picker.
- Never invent values. What can be inferred from the connected tools is proposed and confirmed, never saved silently.
- Nothing is written before the user confirms the final summary.

## Steps

### 1. Where the config lives

Look for an existing `eis-daily-brief.json` as described in `references/config.md`.

- **Found**: say where it is and go to step 3 (edit mode). With `--show`, print the path and the contents and stop.
- **Not found**: tell the user, before asking anything else:
  - the settings will be saved in a file named `eis-daily-brief.json` in the folder they choose;
  - they can edit that file by hand whenever they want;
  - every time the brief runs, it reads that file again, so the folder must be connected (or passed with `--config`) on every run.

  Then ask for the folder. In Cowork use the native folder picker (request a folder connection); on other hosts, ask for the path. If a folder is already connected, offer it as the default.

### 2. First fill (new config)

Ask in short rounds, at most five related fields per round, and skip anything already known:

1. **Who you are and where notes go**: full name, e-mail(s), output language, folder for the daily notes (`output.folder`). Propose name and e-mail from the connected tools when available.
2. **Sources**: which of calendar, messenger, e-mail, meetings, reports and tracker are on (the tracker only closes tasks that link to an issue). Say which tools are connected in this session; a source without a tool can stay on and will be skipped.
3. **Priority people**: names grouped as the user wants (e.g. leadership, own team, stakeholders), with an optional lead for each. When a messenger is connected, propose the people the user talks to most in the last weeks and let them pick.
4. **Priority channels**: name and URL. When a messenger is connected, propose the channels the user is active in.
5. **Meetings and reports**: folders with meeting notes, terms found in meeting titles to read, terms for high-priority meetings, folders with status reports, path of the notes vault. When the user doesn't use one of these, leave it out.

### 3. Edit mode (existing config)

Show a short summary of the current config (counts and key values, not the raw JSON) and ask what to change. Accept free text ("adiciona a Maria no time", "tira o canal X", "troca a pasta da daily"). Change only what was asked and keep every other key, including keys the user added by hand.

### 4. Confirm and save

Show the final values in a short readable summary and the diff when editing. Save only after the user confirms. Write valid JSON with `schemaVersion: 1`, two-space indentation.

Finish with: the path of the file, a one-line reminder that it can be edited by hand, and the next step (`/brief-generate`, or schedule it with the folder connected or `--config`).
