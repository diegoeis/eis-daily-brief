#!/usr/bin/env python3
"""vendor-eis-ds.py — builds src/app/vendor/eis-ds.css, the trimmed copy of the eis-ds design system
that the plugin's page uses.

The page must work wherever the plugin is installed, so it can't link eis-ds from a checkout.
This script reads the shared and app scopes of an eis-ds checkout, keeps only the rules whose
eis-* classes the page uses (plus tokens and the base reset) and writes one CSS file.

Usage (from the project root):
  python3 scripts/vendor-eis-ds.py /path/to/eis-ds

Run it again when the page uses new eis-ds classes or eis-ds changes. Never edit the output by hand.
Python 3 standard library only.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "src" / "app"
OUT = APP / "vendor" / "eis-ds.css"
# Order matters: the same order app/app.css imports them.
SOURCES = [
    "src/shared/css/tokens.css",
    "src/shared/css/base.css",
    "src/shared/css/elements.css",
    "src/app/css/tokens.css",
    "src/app/css/components.css",
]
FONTS = re.compile(r'@import url\("https://fonts\.googleapis\.com[^"]*"\);')
CLASS = re.compile(r"\.(eis-[a-z0-9_-]+)")


def used_classes():
    """Every eis-* class the page names in its HTML, JS and CSS."""
    names = set()
    for path in APP.rglob("*"):
        if path.suffix in {".html", ".js", ".css"} and "vendor" not in path.parts:
            names.update(re.findall(r"eis-[a-z0-9_-]+", path.read_text(encoding="utf-8")))
    return names


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def split_rules(css):
    """Top-level blocks as (prelude, body). Handles one level of nesting (@media)."""
    rules, i, n = [], 0, len(css)
    while i < n:
        start = css.find("{", i)
        if start == -1:
            break
        prelude = css[i:start].strip()
        depth, j = 1, start + 1
        while j < n and depth:
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        rules.append((prelude, css[start + 1 : j - 1]))
        i = j
    return rules


def keep_selector(selector, used):
    classes = CLASS.findall(selector)
    return all(c in used for c in classes)


def prune(css, used):
    out = []
    for prelude, body in split_rules(css):
        if prelude.startswith("@media"):
            inner = prune(body, used)
            if inner.strip():
                out.append(prelude + "{\n" + inner + "}")
            continue
        if prelude.startswith("@"):
            out.append(prelude + "{" + body + "}")
            continue
        parts = [p.strip() for p in prelude.split(",") if keep_selector(p, used)]
        if parts:
            out.append(",".join(parts) + "{" + body.strip() + "}")
    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/vendor-eis-ds.py /path/to/eis-ds")
    ds = pathlib.Path(sys.argv[1]).expanduser().resolve()
    missing = [s for s in SOURCES + ["src/shared/shared.css"] if not (ds / s).is_file()]
    if missing:
        sys.exit("not an eis-ds checkout, missing: " + ", ".join(missing))
    try:
        commit = subprocess.run(["git", "-C", str(ds), "rev-parse", "--short", "HEAD"],
                                capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "unknown"

    used = used_classes()
    # The font import lives in the shared entry file (shared/shared.css), not in the css/ files.
    fonts, chunks = FONTS.findall((ds / "src/shared/shared.css").read_text(encoding="utf-8")), []
    for src in SOURCES:
        css = (ds / src).read_text(encoding="utf-8")
        fonts += FONTS.findall(css)
        css = FONTS.sub("", re.sub(r'@import url\("[^"]*"\);', "", css))
        chunks.append("/* " + src + " */\n" + prune(strip_comments(css), used))

    header = (
        "/* eis-ds, trimmed for the eis-task-manager page. GENERATED: do not edit.\n"
        "   Source: https://github.com/diegoeis/eis-ds @ " + commit + "\n"
        "   Built by scripts/vendor-eis-ds.py with only the eis-* classes the page uses. */\n"
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(header + "\n".join(dict.fromkeys(fonts)) + "\n\n" + "\n".join(chunks), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, eis-ds {commit}, {len(used)} classes used)")


if __name__ == "__main__":
    main()
