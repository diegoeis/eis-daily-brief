#!/usr/bin/env python3
"""pending.py - lists the action comments tasks-act has to look at, without an LLM.

Usage: python3 pending.py --config PATH [--today YYYY-MM-DD] [--stale-hours N]

PATH is the chosen folder, its .eis-task-manager/ folder or the config.json. Reads the latest
daily note (output.folder + output.pattern, on or before today) by the daily format (the
workspace's daily-format.json, else the plugin's default) and prints one JSON object:

  {"note": path, "pending": [...], "stale": [...], "underClosed": n}

  pending      🤖 actions under open tasks: what tasks-act runs
  stale        🤖⏳ actions whose claim in .eis-task-manager/act-state.json
               ({"running": [{"instruction", "task", "started"}]}) is older than
               --stale-hours (default 2) or missing: a run that stopped midway
  underClosed  🤖 actions under done or cancelled tasks (not run)

When there is nothing to run and nothing stale, the last line is {"wakeAgent": false}, so a
scheduler can skip the agent. Any error prints {"scan_error": "..."} instead.
Python 3 standard library only. Reads; never writes.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_FORMAT = os.path.join(HERE, "..", "..", "..", "references", "daily-format.json")


def workspace_of(path):
    path = os.path.abspath(os.path.expanduser(path))
    if os.path.isfile(path):
        return os.path.dirname(path), path
    for ws in (path, os.path.join(path, ".eis-task-manager")):
        if os.path.isfile(os.path.join(ws, "config.json")):
            return ws, os.path.join(ws, "config.json")
    raise SystemExit(json.dumps({"scan_error": "config.json not found from " + path}))


def pattern_re(pattern):
    out, groups = "", []
    for token in re.split(r"(YYYY|MM|DD)", pattern):
        if token in ("YYYY", "MM", "DD"):
            out += "(?P<%s>\\d{%d})" % (token, 4 if token == "YYYY" else 2) if token not in groups else "(?P=%s)" % token
            groups.append(token)
        else:
            out += re.escape(token)
    return re.compile("^" + out + "$")


def latest_note(folder, pattern, today):
    rx, best = pattern_re(pattern), None
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            rel = os.path.relpath(os.path.join(root, name), folder).replace(os.sep, "/")
            m = rx.match(rel)
            if not m:
                continue
            key = m.group("YYYY") + "-" + m.group("MM") + "-" + m.group("DD")
            if key <= today and (best is None or key > best[0]):
                best = (key, os.path.join(folder, rel))
    return best[1] if best else None


def scan(note_text, fmt):
    t = fmt["tasks"]
    marks = t["comment"].get("action")
    if not marks:
        return [], [], 0
    by_len = sorted(marks.items(), key=lambda kv: -len(kv[1]))
    done_starts = t["item"]["done"] + ([t["item"]["cancelled"]] if t["item"].get("cancelled") else [])
    sub = re.compile(r"^(?: {2,}|\t+)" + re.escape(t["comment"]["prefix"]) + r"(.*)$")
    body = "^" + "".join("(?P<date>.+?)" if p == "{date}" else "(?P<text>.*)" if p == "{text}" else re.escape(p)
                         for p in re.split(r"(\{date\}|\{text\})", t["comment"]["line"])) + "$"
    comment = re.compile(body)
    pending, running, under_closed = [], [], 0
    in_section, task, task_open = False, None, False
    for n, line in enumerate(note_text.splitlines()):
        if line.strip() == t["section"]["heading"].strip():
            in_section = True
            continue
        if not in_section:
            continue
        if any(line.startswith(e) for e in t["section"]["endsAt"]):
            break
        if line.startswith(t["item"]["open"]):
            task, task_open = line[len(t["item"]["open"]):], True
            continue
        if any(line.startswith(s) for s in done_starts):
            task, task_open = line, False
            continue
        s = sub.match(line)
        if not (s and task):
            if line.strip():
                task = None
            continue
        c = comment.match(s.group(1))
        text = c.group("text") if c and "text" in c.groupdict() else s.group(1)
        hit = next(((k, m) for k, m in by_len if text.startswith(m)), None)
        state = hit[0] if hit else None
        item = {"line": n + 1, "task": task.strip(), "instruction": text[len(hit[1]):].strip() if hit else text}
        if state == "pending":
            if task_open:
                pending.append(item)
            else:
                under_closed += 1
        elif state == "running":
            running.append(item)
    return pending, running, under_closed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--today", default=dt.date.today().isoformat())
    ap.add_argument("--stale-hours", type=float, default=2)
    a = ap.parse_args()
    ws, cfg_path = workspace_of(a.config)
    cfg = json.load(open(cfg_path, encoding="utf-8"))
    custom = os.path.join(ws, "daily-format.json")
    fmt = json.load(open(custom if os.path.isfile(custom) else DEFAULT_FORMAT, encoding="utf-8"))
    out = cfg["output"]
    note = latest_note(out["folder"], out.get("pattern", "YYYY-MM/YYYY-MM-DD.md"), a.today)
    if not note:
        print(json.dumps({"note": None, "pending": [], "stale": [], "underClosed": 0}))
        print(json.dumps({"wakeAgent": False}))
        return
    pending, running, under_closed = scan(open(note, encoding="utf-8").read(), fmt)

    state_path = os.path.join(ws, "act-state.json")
    claims = {}
    if os.path.isfile(state_path):
        claims = {c["instruction"]: c["started"] for c in json.load(open(state_path, encoding="utf-8")).get("running", [])}
    now = dt.datetime.now(dt.timezone.utc)
    stale = []
    for r in running:
        started = claims.get(r["instruction"])
        age = (now - dt.datetime.fromisoformat(started)).total_seconds() / 3600 if started else None
        if age is None or age > a.stale_hours:
            stale.append(dict(r, started=started))

    print(json.dumps({"note": note, "pending": pending, "stale": stale, "underClosed": under_closed}, ensure_ascii=False))
    if not pending and not stale:
        print(json.dumps({"wakeAgent": False}))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # the scheduler shows this to the agent instead of failing silently
        print(json.dumps({"scan_error": "%s: %s" % (type(e).__name__, e)}))
