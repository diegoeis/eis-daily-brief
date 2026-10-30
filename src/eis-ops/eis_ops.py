#!/usr/bin/env python3
"""eis_ops.py - finds, creates and registers plugins in the shared eis-ops folder.

Copied as-is into every eis-plugins plugin (src/eis-ops/). The source of truth is
eis-plugins/eis-ops/; change it there and run scripts/sync-eis-ops.sh. Rules: rules.md.

  find                              read the pointer; is the folder still there?
  resolve PATH                      is there an eis-ops folder at PATH (or PATH itself)?
  init PATH                         create eis-ops (when missing), AGENTS.md, CLAUDE.md, pointer
  register --plugin NAME --desc TXT [--eis-ops PATH]
                                    create the plugin's folder, update the AGENTS.md table

Prints one JSON object. Python 3 standard library only; any OS.
The pointer is ~/.config/eis-ops/eis-ops-pointer.json, or the path in EIS_OPS_POINTER.
"""
import argparse
import json
import os
import sys
from pathlib import Path

FOLDER = "eis-ops"
POINTER_KEY = "EIS_OPS_LOCAL_PATH"
TABLE_HEAD = "| Plugin | Folder | Description | Status |"

AGENTS_MD = """# eis-ops

Shared folder of the eis-plugins assistant plugins. Each plugin keeps its files in its own subfolder, listed in the table below.

## Rules

- A plugin reads and writes only its own subfolder and its own row in the table below.
- Never rename, move, empty or delete this folder or another plugin's subfolder.
- A plugin's subfolder is named after the plugin without the `eis-` prefix.
- Status: `active` when the subfolder exists, `not_found` when it doesn't. Plugins update it on setup.
- Other sessions find this folder through `~/.config/eis-ops/eis-ops-pointer.json` (key `EIS_OPS_LOCAL_PATH`).

## Plugins

""" + TABLE_HEAD + "\n|---|---|---|---|\n"


def out(**data):
    print(json.dumps(data, ensure_ascii=False))


def pointer_file():
    return Path(os.environ.get("EIS_OPS_POINTER") or Path.home() / ".config" / "eis-ops" / "eis-ops-pointer.json")


def read_pointer():
    try:
        return json.loads(pointer_file().read_text(encoding="utf-8")).get(POINTER_KEY) or None
    except (OSError, ValueError, AttributeError):
        return None


def write_pointer(path):
    try:
        f = pointer_file()
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps({"schemaVersion": 1, POINTER_KEY: str(path)}, indent=2) + "\n", encoding="utf-8")
        return "written"
    except OSError as e:
        return "failed: " + str(e)


def locate(path):
    """(eis-ops path, exists) for a path given by the user: the eis-ops folder or its parent."""
    p = Path(path).expanduser().resolve()
    if p.name == FOLDER:
        return p, p.is_dir()
    return p / FOLDER, (p / FOLDER).is_dir()


def folder_of(plugin):
    return plugin[4:] if plugin.startswith("eis-") else plugin


def cell(text):
    return " ".join(str(text).split()).replace("|", "/")


def update_table(agents, eis_ops, plugin, desc):
    lines = agents.read_text(encoding="utf-8").splitlines()
    if TABLE_HEAD not in lines:
        lines += ["", "## Plugins", "", TABLE_HEAD, "|---|---|---|---|"]
    start = lines.index(TABLE_HEAD) + 2
    end = start
    while end < len(lines) and lines[end].startswith("|"):
        end += 1
    rows, mine = [], [plugin, folder_of(plugin) + "/", cell(desc), "active"]
    for line in lines[start:end]:
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cols) < 4:
            rows.append(line)
            continue
        if cols[0] == plugin:
            rows.append(mine)
            mine = None
        else:
            cols[3] = "active" if (eis_ops / cols[1].rstrip("/")).is_dir() else "not_found"
            rows.append(cols[:4])
    if mine:
        rows.append(mine)
    rows = [r if isinstance(r, str) else "| " + " | ".join(r) + " |" for r in rows]
    text = "\n".join(lines[:start] + rows + lines[end:]) + "\n"
    agents.write_text(text, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="eis-ops shared folder")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("find")
    sub.add_parser("resolve").add_argument("path")
    sub.add_parser("init").add_argument("path")
    reg = sub.add_parser("register")
    reg.add_argument("--plugin", required=True)
    reg.add_argument("--desc", required=True)
    reg.add_argument("--eis-ops")
    a = ap.parse_args()

    if a.cmd == "find":
        path = read_pointer()
        if not path:
            return out(status="missing", pointer=str(pointer_file()))
        return out(status="found" if Path(path).is_dir() else "stale", path=path)

    if a.cmd == "resolve":
        path, exists = locate(a.path)
        return out(status="exists" if exists else "absent", path=str(path))

    if a.cmd == "init":
        path, existed = locate(a.path)
        path.mkdir(parents=True, exist_ok=True)
        if not (path / "AGENTS.md").exists():
            (path / "AGENTS.md").write_text(AGENTS_MD, encoding="utf-8")
        if not (path / "CLAUDE.md").exists():
            (path / "CLAUDE.md").write_text("@AGENTS.md\n", encoding="utf-8")
        return out(status="existing" if existed else "created", path=str(path), pointer=write_pointer(path))

    if a.cmd == "register":
        if a.eis_ops:
            path, exists = locate(a.eis_ops)
        else:
            p = read_pointer()
            path, exists = (Path(p), Path(p).is_dir()) if p else (None, False)
        if not exists or path is None:
            return out(status="error", error="eis-ops folder not found; run init first")
        agents = path / "AGENTS.md"
        if not agents.exists():
            agents.write_text(AGENTS_MD, encoding="utf-8")
        mine = path / folder_of(a.plugin)
        mine.mkdir(exist_ok=True)
        update_table(agents, path, a.plugin, a.desc)
        return out(status="registered", folder=str(mine))


if __name__ == "__main__":
    sys.exit(main())
