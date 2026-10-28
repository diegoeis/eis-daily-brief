/* daily-markdown.js
   Reads and edits the daily note written by the eis-daily-brief skill.
   The markdown file is the contract: the UI reads it and every change the UI makes
   is a change to the markdown text, in the same format the skill writes.

   How tasks are written is not fixed here. It comes from a daily format: the JSON described in
   the plugin's references/daily-format.md. With the default format:

   Task line:  - [ ] {description} — [Source](url) - ➕ YYYY-MM-DD 📅 YYYY-MM-DD
   Done task:  - [x] {description} ... ✅ YYYY-MM-DD
   Comment:        - YYYY-MM-DD - {note}

   compile(format) turns the JSON into what the functions use; every function takes that as its
   last argument and uses the default format without it. Dates in the model and in the arguments
   are always YYYY-MM-DD; the format decides how they are written in the note.
   Pure functions, no DOM. Works in the browser (window.DailyMarkdown) and in Node (require). */
(function (root) {
  "use strict";

  var LEVELS = ["highest", "high", "medium", "low", "lowest"];
  var isNode = typeof module !== "undefined" && module.exports;

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function splitLines(markdown) { return String(markdown).split(/\r?\n/); }
  function joinLines(lines, original) { return lines.join(/\r\n/.test(original) ? "\r\n" : "\n"); }

  /* ---------- format ---------- */

  /* What makes a format unusable, as short sentences. Empty = valid.
     Mirrors the required parts of references/daily-format.schema.json. */
  function validateFormat(f) {
    var errors = [];
    var need = function (ok, msg) { if (!ok) errors.push(msg); };
    var str = function (v) { return typeof v === "string" && v.length > 0; };
    var list = function (v) { return Array.isArray(v) && v.length > 0 && v.every(str); };
    var obj = function (v) { return v && typeof v === "object" ? v : {}; };
    if (!f || typeof f !== "object") return ["the format is not an object"];
    need(f.version === 1, "version must be 1");
    var d = obj(f.dates), t = obj(f.tasks);
    need(str(d.format) && ["YYYY", "MM", "DD"].every(function (k) { return d.format.split(k).length === 2; }),
      "dates.format must hold YYYY, MM and DD once each");
    var s = obj(t.section), g = obj(t.group), i = obj(t.item), fl = obj(t.fields), c = obj(t.comment);
    need(str(s.heading), "tasks.section.heading is required");
    need(list(s.endsAt), "tasks.section.endsAt needs at least one line start");
    need(str(g.before) && typeof g.after === "string" && str(g.default), "tasks.group needs before, after and default");
    need(str(i.open) && list(i.done), "tasks.item needs open and done");
    need(str(fl.created) && str(fl.due) && str(fl.completed), "tasks.fields needs created, due and completed");
    need(str(c.indent) && /^\s+$/.test(c.indent) && str(c.prefix) && str(c.line) && c.line.indexOf("{text}") !== -1,
      "tasks.comment needs a whitespace indent, a prefix and a line with {text}");
    Object.keys(obj(t.priority)).forEach(function (k) {
      need(LEVELS.indexOf(t.priority[k]) !== -1, "tasks.priority." + k + " must be one of " + LEVELS.join(", "));
    });
    return errors;
  }

  /* Turns a format (the JSON) into the expressions and writers the functions use. */
  function compile(format) {
    var errors = validateFormat(format);
    if (errors.length) { var e = new Error("Invalid daily format: " + errors.join("; ")); e.name = "InvalidFormat"; e.errors = errors; throw e; }
    var t = format.tasks;

    // Dates: YYYY, MM and DD become groups; their order in the format is kept.
    var order = [];
    var dateBody = escapeRe(format.dates.format).replace(/YYYY|MM|DD/g, function (k) {
      order.push(k);
      return k === "YYYY" ? "(\\d{4})" : "(\\d{2})";
    });
    var date = {
      group: "(" + dateBody.replace(/\((\\d\{[24]\})\)/g, "$1") + ")", // one group for the whole date
      re: new RegExp("^" + dateBody + "$"),
      toKey: function (text) {
        var m = String(text).match(date.re);
        if (!m) return null;
        var p = {};
        order.forEach(function (k, n) { p[k] = m[n + 1]; });
        return p.YYYY + "-" + p.MM + "-" + p.DD;
      },
      fromKey: function (key) {
        var p = String(key).split("-");
        return format.dates.format.replace("YYYY", p[0]).replace("MM", p[1]).replace("DD", p[2]);
      }
    };

    var marker = function (m) { return new RegExp(escapeRe(m) + "\\s*" + date.group); };
    var marks = [t.fields.created, t.fields.due, t.fields.completed].concat(t.fields.ignore || []);
    var priority = t.priority || {};

    // Comment line: {date} and {text} become groups, in the order they appear.
    var commentGroups = [];
    var commentRe = new RegExp("^" + t.comment.line.split(/(\{date\}|\{text\})/).map(function (p) {
      if (p === "{date}") { commentGroups.push("date"); return date.group; }
      if (p === "{text}") { commentGroups.push("text"); return "(.*)"; }
      return escapeRe(p);
    }).join("") + "$");

    return {
      format: format,
      date: date,
      heading: t.section.heading.trim(),
      headingLine: t.section.heading,
      endsAt: t.section.endsAt,
      groupRe: new RegExp("^" + escapeRe(t.group.before) + "(.+?)" + escapeRe(t.group.after) + "\\s*$"),
      groupLine: function (name) { return t.group.before + name + t.group.after; },
      defaultGroup: t.group.default,
      open: t.item.open,
      done: t.item.done,
      newPrefix: t.item.newPrefix || "",
      separators: t.item.sourceSeparators || [],
      marks: t.fields,
      fields: { created: marker(t.fields.created), due: marker(t.fields.due), completed: marker(t.fields.completed) },
      completedRe: new RegExp("\\s*" + escapeRe(t.fields.completed) + "\\s*" + date.group),
      anyMarkRe: new RegExp("\\s*(?:" + marks.map(escapeRe).join("|") + ")\\s*" + date.group, "g"),
      priorities: Object.keys(priority).sort(function (a, b) { return b.length - a.length; }), // "⬇️" before "⬇"
      priorityOf: priority,
      subRe: new RegExp("^(?: {2,}|\\t+)" + escapeRe(t.comment.prefix) + "(.*)$"),
      commentRe: commentRe,
      commentGroups: commentGroups,
      commentLine: function (key, text) {
        return t.comment.indent + t.comment.prefix + t.comment.line.replace("{date}", date.fromKey(key)).replace("{text}", text);
      },
      closedPrefixes: (t.comment.closedPrefixes || []).map(function (p) { return p.toLowerCase(); })
    };
  }

  var DEFAULT = compile(isNode ? require("./default-format.js") : root.DailyDefaultFormat);

  /* ---------- parse ---------- */

  function taskStart(line, F) {
    if (line.indexOf(F.open) === 0) return { done: false, prefix: F.open, body: line.slice(F.open.length) };
    for (var i = 0; i < F.done.length; i++) {
      if (line.indexOf(F.done[i]) === 0) return { done: true, prefix: F.done[i], body: line.slice(F.done[i].length) };
    }
    return null;
  }

  function isGroup(line, F) { return !taskStart(line, F) && F.groupRe.test(line); }

  function findTasksSection(lines, F) {
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === F.heading) { start = i + 1; break; }
    }
    if (start === -1) return null;
    var end = lines.length;
    for (var j = start; j < lines.length; j++) {
      var line = lines[j];
      if (F.endsAt.some(function (p) { return line.indexOf(p) === 0; })) { end = j; break; }
    }
    return { start: start, end: end };
  }

  /* The note's own date: a "# <date>" title, else "created: <date>" in the frontmatter. */
  function findNoteDate(lines, F) {
    var title = new RegExp("^#\\s+" + F.date.group + "\\s*$");
    var created = new RegExp("^created:\\s*" + F.date.group);
    for (var i = 0; i < lines.length; i++) { var m = lines[i].match(title); if (m) return F.date.toKey(m[1]); }
    for (var k = 0; k < lines.length; k++) { var c = lines[k].match(created); if (c) return F.date.toKey(c[1]); }
    return null;
  }

  /* Splits the body of a task line into its parts. Keeps `raw` untouched. */
  function parseTaskBody(body, F) {
    var task = { raw: body, isNew: false, created: null, due: null, completed: null, priority: null };
    var text = body;

    if (F.newPrefix && text.indexOf(F.newPrefix) === 0) { task.isNew = true; text = text.slice(F.newPrefix.length); }

    Object.keys(F.fields).forEach(function (key) {
      var m = text.match(F.fields[key]);
      if (m) task[key] = F.date.toKey(m[1]);
    });
    text = text.replace(F.anyMarkRe, "");

    F.priorities.forEach(function (mark) {
      if (text.indexOf(mark) !== -1) {
        if (!task.priority) task.priority = F.priorityOf[mark];
        text = text.split(mark).join("");
      }
    });

    text = text.replace(/[\s\-·]+$/, "").replace(/\s{2,}/g, " ").trim();

    // The source comes after the last separator on the line.
    var cut = -1, size = 0;
    F.separators.forEach(function (s) {
      var at = text.lastIndexOf(s);
      if (at > cut) { cut = at; size = s.length; }
    });
    if (cut !== -1) {
      task.description = text.slice(0, cut).trim();
      task.source = text.slice(cut + size).trim() || null;
    } else {
      task.description = text;
      task.source = null;
    }
    return task;
  }

  function parseNote(body, lineIndex, F) {
    var note = { line: lineIndex, date: null, text: body };
    var m = body.match(F.commentRe);
    if (m) {
      F.commentGroups.forEach(function (g, n) {
        if (g === "date") note.date = F.date.toKey(m[n + 1]);
        else note.text = m[n + 1];
      });
    }
    var lower = note.text.toLowerCase();
    note.kind = F.closedPrefixes.some(function (p) { return lower.indexOf(p) === 0; }) ? "closed" : "note";
    return note;
  }

  /* Returns { date, groups: [{ name, tasks }], tasks } for the tasks section.
     A task's `line` is its 0-based line index: the key every edit uses. */
  function parse(markdown, F) {
    F = F || DEFAULT;
    var lines = splitLines(markdown);
    var result = { date: findNoteDate(lines, F), groups: [], tasks: [] };
    var section = findTasksSection(lines, F);
    if (!section) return result;

    var group = null;
    var task = null;
    for (var i = section.start; i < section.end; i++) {
      var line = lines[i];
      var start = taskStart(line, F);
      if (start) {
        if (!group) { group = { name: "", tasks: [] }; result.groups.push(group); }
        task = parseTaskBody(start.body, F);
        task.line = i;
        task.done = start.done;
        task.group = group.name;
        task.notes = [];
        group.tasks.push(task);
        result.tasks.push(task);
        continue;
      }
      var s = line.match(F.subRe);
      if (s && task) { task.notes.push(parseNote(s[1], i, F)); continue; }
      var g = line.match(F.groupRe);
      if (g) {
        group = { name: g[1].trim(), tasks: [] };
        result.groups.push(group);
        task = null;
        continue;
      }
      if (line.trim() === "") continue;
      task = null; // any other line ends the current task's comments
    }
    return result;
  }

  /* ---------- edits ---------- */

  function taskAt(lines, lineIndex, F) {
    var start = taskStart(lines[lineIndex] || "", F);
    if (!start) throw new Error("Line " + lineIndex + " is not a task line");
    return start;
  }

  /* Marks a task done (a done start + the completed mark and date) or open again (removes both). */
  function setTaskDone(markdown, lineIndex, done, key, F) {
    F = F || DEFAULT;
    var lines = splitLines(markdown);
    var start = taskAt(lines, lineIndex, F);
    var body = start.body;
    if (done) {
      if (!F.fields.completed.test(body)) body = body.replace(/\s+$/, "") + " " + F.marks.completed + " " + F.date.fromKey(key);
      lines[lineIndex] = (start.done ? start.prefix : F.done[0]) + body;
    } else {
      lines[lineIndex] = F.open + body.replace(F.completedRe, "");
    }
    return joinLines(lines, markdown);
  }

  /* Adds a comment after the task's last comment. */
  function addTaskNote(markdown, lineIndex, key, text, F) {
    F = F || DEFAULT;
    var clean = String(text).replace(/\s+/g, " ").trim();
    if (!clean) throw new Error("Empty note");
    var lines = splitLines(markdown);
    taskAt(lines, lineIndex, F);
    var at = lineIndex + 1;
    while (at < lines.length && F.subRe.test(lines[at])) at++;
    lines.splice(at, 0, F.commentLine(key, clean));
    return joinLines(lines, markdown);
  }

  /* Adds an open task, the way the user writes one by hand:
       {open}{text} {created mark} {date} [{due mark} {date}]   (due only when given)
     It goes at the end of `group` (default: the format's default group). A missing group is
     created at the top of the tasks section; a missing section is added at the end of the note. */
  function addTask(markdown, task, F) {
    F = F || DEFAULT;
    var text = String(task.text || "").replace(/\s+/g, " ").trim();
    if (!text) throw new Error("Empty task");
    var line = F.open + text + " " + F.marks.created + " " + F.date.fromKey(task.created) +
      (task.due ? " " + F.marks.due + " " + F.date.fromKey(task.due) : "");
    var group = task.group || F.defaultGroup;
    var lines = splitLines(markdown);
    var section = findTasksSection(lines, F);

    if (!section) {
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      lines.push("", F.headingLine, "", F.groupLine(group), line, "");
      if (lines[0] === "") lines.shift();
      return joinLines(lines, markdown);
    }

    var header = -1;
    for (var i = section.start; i < section.end; i++) {
      var g = isGroup(lines[i], F) && lines[i].match(F.groupRe);
      if (g && g[1].trim() === group) { header = i; break; }
    }

    if (header === -1) {
      var at = section.start;
      while (at < section.end && lines[at].trim() === "") at++;
      var block = [F.groupLine(group), line];
      if (at < lines.length) block.push("");
      if (at === section.start) block.unshift("");
      lines.splice.apply(lines, [at, 0].concat(block));
      return joinLines(lines, markdown);
    }

    // After the group's last task or comment, before the next group or the end of the section.
    var last = header;
    for (var j = header + 1; j < section.end && !isGroup(lines[j], F); j++) {
      if (lines[j].trim() !== "") last = j;
    }
    lines.splice(last + 1, 0, line);
    return joinLines(lines, markdown);
  }

  /* Local date as YYYY-MM-DD (never toISOString, which shifts to UTC). */
  function toDateKey(d) {
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  var api = {
    compile: compile, validateFormat: validateFormat, DEFAULT: DEFAULT,
    parse: parse, setTaskDone: setTaskDone, addTaskNote: addTaskNote, addTask: addTask,
    toDateKey: toDateKey, DEFAULT_GROUP: DEFAULT.defaultGroup
  };
  if (isNode) module.exports = api;
  else root.DailyMarkdown = api;
})(this);
