---
name: brief-setup
description: Create, show or edit the plugin's workspace - the .eis-daily-brief/ folder with config.json, the personal config every skill reads before each run, and the user's copy of the daily page - who the user is, output language, where daily notes are written, which sources are on, priority people and channels, meeting and report folders. Use when the user says "configura o daily brief", "setup do brief", "adiciona uma pessoa prioritária", "adiciona um canal", "muda a pasta da daily", "mostra minha config do brief", "set up my daily brief", or runs /brief-setup. With no config found it creates the workspace in a folder the user chooses; with one found it edits the config. "--show" prints the config path and contents. "--config PATH" names the folder or file. Interactive by nature; nothing is saved without the user's confirmation. Does not generate the daily note (use brief-generate).
---

# brief-setup

Fill the config the first time, then add or change things in it. The workspace layout, the rules for finding it, the config schema and how to install the page are in `../../references/config.md` (relative to this skill's folder); read it before step 1.

Write the conversation in the language the user writes in.

## What must always be true

- This skill writes only inside `.eis-daily-brief/` in the folder the user chose: `config.json` and the page copy in `app/`. Never write to `~/.claude/`, `${CLAUDE_PLUGIN_DATA}`, the plugin's own folder or any other place, and never create a pointer file anywhere else.
- Every question, form or folder picker is preceded by one or two sentences saying why it is asked and what will be done with the answer. In Cowork, text written between tool calls is not shown to the user, so that context goes through the user-message tool before the picker.
- Never invent values. What can be inferred from the connected tools is proposed and confirmed, never saved silently.
- Nothing is written before the user confirms the final summary.

## Steps

### 1. Where the workspace lives

Look for an existing workspace as described in `references/config.md`.

- **Found**: say where it is and go to step 3 (edit mode). With `--show`, print the path and the contents of `config.json` and stop.
- **Found in the older layout** (`eis-daily-brief.json` straight in the folder): say so and offer to move it to `.eis-daily-brief/config.json` in the same folder. Move it only after a yes (create the folder, write the same content, then delete the old file); on a no, keep editing the old file. Either way, the page goes to `.eis-daily-brief/app/` next to it (step 4). Then go to step 3.
- **Not found**: tell the user, before asking anything else:
  - a folder named `.eis-daily-brief` will be created inside the folder they choose (the root of their notes vault is a good place). It holds `config.json`, with all the settings, and `app/`, their copy of the daily page;
  - they can edit `config.json` by hand whenever they want;
  - every time the brief runs, it reads that file again, so the chosen folder must be connected (or passed with `--config`) on every run.

  Then ask for the folder. In Cowork use the native folder picker (request a folder connection); on other hosts, ask for the path. If a folder is already connected, offer it as the default.

  On hosts without folder connection (the session just runs in a working directory), tell the user that later runs will only find the file if its path is passed with `--config` or kept by the host, and offer to save the path in the host's persistent memory when the host has one (see "Finding the file" in `references/config.md`).

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

Show the final values in a short readable summary and the diff when editing. Save only after the user confirms:

1. Create `.eis-daily-brief/` in the chosen folder when it doesn't exist.
2. Write `config.json` there: valid JSON with `schemaVersion: 1`, two-space indentation.
3. Install or update the page copy in `.eis-daily-brief/app/`, as "The page" in `references/config.md` says.

Finish with:
- the path of `config.json` and a one-line reminder that it can be edited by hand;
- the address of the page (`file:///…/.eis-daily-brief/app/index.html`, as the user's computer sees it). On its first opening the user picks the notes folder (`output.folder`) in **Configurações → Escolher pasta**: browsers never let a page open a folder from a path;
- the next step: `/brief-generate`, or `/brief-view` to generate (when needed) and open the page, or a schedule with the folder connected or with `--config {{path}}` in the scheduled prompt.
