#!/usr/bin/env bash
#
# pack.sh — packages the plugin for distribution.
#
# src/ is the plugin root and the only source of what goes into the package.
# Everything outside it (docs/, scripts/, README, AGENTS.md, CLAUDE.md, .git) is left out.
#
# Output, relative to the project root:
#   dist/vX.Y.Z/       clean copy of src/
#   dist/vX.Y.Z.zip    zip of that folder, ready to import
#
# The version comes from the "version" key in src/.claude-plugin/plugin.json.
# If dist/vX.Y.Z already exists, the script stops: bump the version before packaging.
#
# Usage:
#   ./scripts/pack.sh

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
SRC="$ROOT/src"
DIST="$ROOT/dist"
MANIFEST="$SRC/.claude-plugin/plugin.json"
PII_FILE="$SCRIPTS_DIR/pii-patterns.txt"

die() { echo "Error: $*" >&2; exit 1; }

[[ -d "$SRC" ]] || die "src/ folder not found in $ROOT"
[[ -f "$MANIFEST" ]] || die "manifest not found at src/.claude-plugin/plugin.json"

# Reads a top-level string key from plugin.json.
# Uses jq when available; without jq, falls back to a grep that takes the first match.
read_key() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$key" '.[$k] // empty' "$MANIFEST"
  else
    grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$MANIFEST" | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/'
  fi
}

# src/plugin.json is the Agent Plugins v1 manifest (Hermes). It must carry the same version.
HERMES_MANIFEST="$SRC/plugin.json"
if [[ -f "$HERMES_MANIFEST" ]]; then
  HV="$(MANIFEST="$HERMES_MANIFEST" read_key version)"
  CV="$(read_key version)"
  [[ "$HV" == "$CV" ]] || die "version differs: src/plugin.json has \"$HV\", src/.claude-plugin/plugin.json has \"$CV\". Bump both."
fi

NAME="$(read_key name)"
VERSION="$(read_key version)"
[[ -n "$NAME" ]] || die "\"name\" is empty or missing in plugin.json"
[[ -n "$VERSION" ]] || die "\"version\" is empty or missing in plugin.json"

# The daily page shows the version in its header; it must match the manifest.
PAGE_VERSION="$(sed -n 's/.*eis-app-brand.*<span class="eis-mono">v\([^<]*\)<\/span>.*/\1/p' "$SRC/app/index.html")"
[[ "$PAGE_VERSION" == "$VERSION" ]] || die "src/app/index.html shows v$PAGE_VERSION, plugin.json has $VERSION. Update the header."

# src/eis-ops/ is a copy of eis-plugins/eis-ops/ (rules shared by every plugin's setup).
# When the eis-plugins repo is next to this one, the copy must match it.
EIS_OPS_SOURCE="$ROOT/../eis-plugins/eis-ops"
if [[ -d "$EIS_OPS_SOURCE" ]]; then
  for f in rules.md eis_ops.py; do
    cmp -s "$EIS_OPS_SOURCE/$f" "$SRC/eis-ops/$f" || die "src/eis-ops/$f differs from eis-plugins/eis-ops/$f. Run eis-plugins/scripts/sync-eis-ops.sh."
  done
fi

OUT_DIR="$DIST/v$VERSION"
OUT_ZIP="$DIST/v$VERSION.zip"

if [[ -e "$OUT_DIR" || -e "$OUT_ZIP" ]]; then
  die "dist/v$VERSION already exists. Bump \"version\" in src/.claude-plugin/plugin.json before packaging."
fi

# Claude.ai's marketplace sync rejects a plugin that has another .claude-plugin/plugin.json
# nested anywhere below its root, and 'claude plugin validate' doesn't catch it.
NESTED="$(cd "$SRC" && find . -path '*/.claude-plugin/plugin.json' -not -path './.claude-plugin/plugin.json')"
if [[ -n "$NESTED" ]]; then
  die "found a nested .claude-plugin/plugin.json inside src/ (Claude.ai marketplace sync rejects it): $NESTED"
fi

# Claude Desktop rejects a skill whose frontmatter description has more than 1024 characters,
# and 'claude plugin validate' doesn't catch it.
LONG="$(python3 - "$SRC" <<'PY'
import pathlib, re, sys
for p in sorted(pathlib.Path(sys.argv[1]).glob("skills/*/SKILL.md")):
    fm = p.read_text(encoding="utf-8").split("---")[1]
    m = re.search(r"^description:\s*(.*)$", fm, re.M)
    n = len(m.group(1).strip().strip('"')) if m else 0
    if n > 1024: print(f"{p.parent.name} ({n})")
PY
)"
if [[ -n "$LONG" ]]; then
  die "skill description over 1024 characters (Claude Desktop rejects it): $LONG"
fi

# Validates the plugin with the official CLI, when available.
if command -v claude >/dev/null 2>&1; then
  echo "Validating src/ with 'claude plugin validate'..."
  claude plugin validate "$SRC" || die "validation failed. Fix it before packaging."
else
  echo "Warning: 'claude' CLI not found; skipping 'claude plugin validate'." >&2
fi

# Personal-data audit: one pattern (extended regex) per line in
# scripts/pii-patterns.txt. Empty lines and lines starting with # are ignored.
# The file is local (it's in .gitignore); the template is scripts/pii-patterns.example.txt.
# plugin.json is skipped because the author legitimately appears there.
if [[ ! -f "$PII_FILE" ]]; then
  echo "Warning: scripts/pii-patterns.txt doesn't exist; skipping the personal-data audit." >&2
  echo "         Copy scripts/pii-patterns.example.txt to scripts/pii-patterns.txt and fill it in." >&2
else
  # tr -d '\r' keeps a file saved with Windows line endings from voiding the patterns.
  PATTERNS="$(tr -d '\r' < "$PII_FILE" | grep -vE '^[[:space:]]*(#|$)' || true)"
  if [[ -n "$PATTERNS" ]]; then
    if MATCHES="$(grep -rnIE -f <(printf '%s\n' "$PATTERNS") "$SRC" \
          --exclude=plugin.json --exclude=.DS_Store)"; then
      echo "Error: found personal data in src/:" >&2
      echo "$MATCHES" >&2
      exit 1
    fi
  fi
fi

echo "Packaging $NAME v$VERSION..."

mkdir -p "$DIST"
# If anything fails from here on, don't leave a half-built version in dist/.
trap 'rm -rf "$OUT_DIR" "$OUT_ZIP"' ERR

mkdir "$OUT_DIR"
# Copies all of src/ (including hidden files such as .claude-plugin/ and .mcp.json),
# without .DS_Store or the .gitkeep files that only exist so git tracks empty folders.
(cd "$SRC" && tar cf - --exclude='.DS_Store' --exclude='.gitkeep' .) | (cd "$OUT_DIR" && tar xf -)

(cd "$OUT_DIR" && zip -rqX "$OUT_ZIP" .)

trap - ERR

echo "  dist/v$VERSION/"
echo "  dist/v$VERSION.zip  ($(du -h "$OUT_ZIP" | cut -f1))"
echo ""
echo "Install:"
echo "  Claude Code:  claude --plugin-dir \"$OUT_DIR\""
echo "  Cowork:       Claude Desktop > Skills > Personal plugins > + > upload dist/v$VERSION.zip"
echo "  Hermes:       hermes plugins install diegoeis/$NAME/src --enable"
