/* daily-files.js
   Finds and writes the daily note inside a folder handle (File System Access API).
   No DOM: it only uses the handle interface (entries(), getFile(), createWritable()),
   so Node tests can pass a fake handle built over a temp folder.
   Notes are found by the config's output.pattern, relative to the folder: YYYY, MM and DD stand
   for the date and "/" separates folders. Default: YYYY-MM/YYYY-MM-DD.md */
(function (root) {
  "use strict";

  var DEFAULT_PATTERN = "YYYY-MM/YYYY-MM-DD.md";
  var TOKENS = ["YYYY", "MM", "DD"];

  function ConflictError() {
    var e = new Error("The note changed outside the dashboard since it was read.");
    e.name = "ConflictError";
    return e;
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* "YYYY-MM/YYYY-MM-DD.md" -> one matcher per path segment. Throws on a pattern without
     YYYY, MM and DD, or with an empty segment. */
  function compilePattern(pattern) {
    pattern = pattern || DEFAULT_PATTERN;
    var segments = String(pattern).split("/");
    TOKENS.forEach(function (k) {
      if (pattern.indexOf(k) === -1) throw new Error("output.pattern must hold YYYY, MM and DD: " + pattern);
    });
    return segments.map(function (segment) {
      if (!segment) throw new Error("output.pattern has an empty folder: " + pattern);
      var names = [];
      var re = new RegExp("^" + escapeRe(segment).replace(/YYYY|MM|DD/g, function (k) {
        names.push(k);
        return k === "YYYY" ? "(\\d{4})" : k === "MM" ? "(0[1-9]|1[0-2])" : "(0[1-9]|[12]\\d|3[01])";
      }) + "$");
      return { re: re, names: names };
    });
  }

  /* The date parts a name gives, merged with the ones found above it; null when they disagree
     (a note 2026-10-12.md inside a 2026-09 folder). */
  function merge(known, segment, name) {
    var m = name.match(segment.re);
    if (!m) return null;
    var next = Object.assign({}, known);
    for (var i = 0; i < segment.names.length; i++) {
      var k = segment.names[i], v = m[i + 1];
      if (next[k] && next[k] !== v) return null;
      next[k] = v;
    }
    return next;
  }

  /* Known parts as a comparable string, cut at the first unknown part (YYYY, then MM, then DD). */
  function prefix(parts) {
    var out = "";
    for (var i = 0; i < TOKENS.length && parts[TOKENS[i]]; i++) out += parts[TOKENS[i]];
    return out;
  }

  /* The latest note by the date in its path. Notes dated after `today` (YYYY-MM-DD) are skipped,
     so a note prepared ahead of time does not replace today's. Returns { handle, path, date }
     (date as YYYY-MM-DD), or null when there is none. */
  async function findLatest(folder, today, pattern) {
    var segments = compilePattern(pattern);
    var limit = today ? today.replace(/-/g, "") : null;

    async function walk(dir, level, parts, path) {
      var last = level === segments.length - 1;
      var found = [];
      for await (var pair of dir.entries()) {
        if (pair[1].kind !== (last ? "file" : "directory")) continue;
        var next = merge(parts, segments[level], pair[0]);
        if (!next) continue;
        var key = prefix(next);
        if (limit && key > limit.slice(0, key.length)) continue;
        found.push({ name: pair[0], handle: pair[1], parts: next, key: key });
      }
      // Latest first; a folder with no note in it falls through to the one before.
      found.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : a.name < b.name ? 1 : -1; });
      for (var i = 0; i < found.length; i++) {
        var f = found[i];
        if (last) return { handle: f.handle, path: path + "/" + f.name, date: f.parts.YYYY + "-" + f.parts.MM + "-" + f.parts.DD };
        var hit = await walk(f.handle, level + 1, f.parts, path + "/" + f.name);
        if (hit) return hit;
      }
      return null;
    }

    return walk(folder, 0, {}, folder.name);
  }

  async function read(fileHandle) {
    var file = await fileHandle.getFile();
    return { text: await file.text(), lastModified: file.lastModified };
  }

  /* Writes `text` only if the file still holds `expected` (the text last read).
     Otherwise throws ConflictError and leaves the file alone. Returns the new state. */
  async function writeIfUnchanged(fileHandle, expected, text) {
    var current = await read(fileHandle);
    if (current.text !== expected) throw ConflictError();
    var writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return read(fileHandle);
  }

  var api = { findLatest: findLatest, compilePattern: compilePattern, read: read, writeIfUnchanged: writeIfUnchanged, DEFAULT_PATTERN: DEFAULT_PATTERN };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DailyFiles = api;
})(this);
