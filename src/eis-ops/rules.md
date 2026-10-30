# eis-ops rules

eis-ops-rules: 1

Every eis-plugins plugin keeps the user's files in one shared folder, `eis-ops/`. These rules are the same in every plugin: this file and `eis_ops.py` are copied as-is from the `eis-plugins` repo (`eis-ops/`). Never edit a plugin's copy; change the source and sync.

Run the script with `python3 eis_ops.py <command>` (`python` on Windows), from the folder of this file. It prints one JSON object. Without Python, do the same steps by hand.

## Layout

```
<folder the user chose>/eis-ops/
├── AGENTS.md         rules for agents + table of the plugins installed here
├── CLAUDE.md         only "@AGENTS.md"
└── <plugin>/         one folder per plugin: the plugin name without "eis-" (eis-task-manager -> task-manager)
```

Pointer: `~/.config/eis-ops/eis-ops-pointer.json` = `{"schemaVersion": 1, "EIS_OPS_LOCAL_PATH": "<absolute path of eis-ops>"}`. Hosts that can't reach the user's home (sandboxed sessions) never find it; that is fine, the setup asks.

## Setup: finding or creating eis-ops

1. `find`. `found`: use that path, don't ask where to save. `missing` or `stale`: go on.
2. Ask the user where to save the plugin's files. Tell them that if they already use another eis-plugins plugin, they can point to the folder where `eis-ops/` is; otherwise a new one is created there.
3. `resolve <path>`. Then `init <path>` in both cases: with `absent` it creates `eis-ops/`; with `exists` it keeps the folder as it is and writes the pointer again (an earlier pointer write may have failed). It also creates `AGENTS.md` and `CLAUDE.md` when missing, silently.
4. `register --plugin <plugin name> --desc "<one-line description in English>"`: creates the plugin's folder and adds or updates its row in the `AGENTS.md` table, and sets each other row's status to `active` or `not_found` by whether its folder exists. Silent: never ask the user about the table.

Steps 3 and 4 write files: a setup that asks for confirmation before saving runs them only when it saves.

## Always

- Never rename, move, empty or delete `eis-ops/`, another plugin's folder or another plugin's row.
- A plugin writes only inside its own folder, its own row of the table, and (in `init`) the pointer, `AGENTS.md` and `CLAUDE.md` when missing.
- The user may edit the table by hand; keep what they wrote.
