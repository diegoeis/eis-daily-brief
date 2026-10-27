/* daily-markdown.js
   Reads and edits the daily note written by the eis-daily-brief skill.
   The markdown file is the contract: the UI reads it and every change the UI makes
   is a change to the markdown text, in the same format the skill writes.

   Task line:  - [ ] {description} — [Source](url) - ➕ YYYY-MM-DD 📅 YYYY-MM-DD
   Done task:  - [x] {description} ... ✅ YYYY-MM-DD
   Sub-item:       - YYYY-MM-DD - {note}

   Pure functions, no DOM. Works in the browser (window.DailyMarkdown) and in Node (require). */
(function (root) {
  "use strict";

  var DATE = "(\\d{4}-\\d{2}-\\d{2})";
  var TASK_RE = /^- \[([ xX])\] (.*)$/;
  var SUB_RE = /^(?: {2,}|\t+)- (.*)$/;
  var GROUP_RE = /^\*\*(.+?)\*\*\s*$/;
  var NOTE_RE = new RegExp("^" + DATE + " - (.*)$");
  var CLOSED_RE = /^(fechada|fechado|closed)\s*:/i;
  var MARKERS = {
    created: new RegExp("➕\\s*" + DATE),
    due: new RegExp("📅\\s*" + DATE),
    completed: new RegExp("✅\\s*" + DATE)
  };
  var ANY_MARKER_RE = new RegExp("\\s*(?:➕|📅|✅|⏳|🛫)\\s*" + DATE, "g");
  var PRIORITIES = [
    { mark: "🔺", key: "highest" },
    { mark: "⏫", key: "high" },
    { mark: "🔼", key: "medium" },
    { mark: "🔽", key: "low" },
    { mark: "⏬", key: "lowest" },
    { mark: "⬇️", key: "low" },
    { mark: "⬇", key: "low" }
  ];
  var NOTE_INDENT = "    ";
  var DEFAULT_GROUP = "Needs to be done"; // the skill's group for tasks with no team, project or topic

  function splitLines(markdown) {
    return String(markdown).split(/\r?\n/);
  }

  function joinLines(lines, original) {
    return lines.join(/\r\n/.test(original) ? "\r\n" : "\n");
  }

  function findTasksSection(lines) {
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/^##\s+Tasks\s*$/.test(lines[i])) { start = i + 1; break; }
    }
    if (start === -1) return null;
    var end = lines.length;
    for (var j = start; j < lines.length; j++) {
      if (/^##\s/.test(lines[j]) || /^---\s*$/.test(lines[j])) { end = j; break; }
    }
    return { start: start, end: end };
  }

  function findNoteDate(lines) {
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(new RegExp("^#\\s+" + DATE + "\\s*$"));
      if (m) return m[1];
    }
    for (var k = 0; k < lines.length; k++) {
      var c = lines[k].match(new RegExp("^created:\\s*" + DATE));
      if (c) return c[1];
    }
    return null;
  }

  /* Splits the body of a task line into its parts. Keeps `raw` untouched. */
  function parseTaskBody(body) {
    var task = { raw: body, isNew: false, created: null, due: null, completed: null, priority: null };
    var text = body;

    if (/^new - /.test(text)) { task.isNew = true; text = text.slice(6); }

    Object.keys(MARKERS).forEach(function (key) {
      var m = text.match(MARKERS[key]);
      if (m) task[key] = m[1];
    });
    text = text.replace(ANY_MARKER_RE, "");

    PRIORITIES.forEach(function (p) {
      if (text.indexOf(p.mark) !== -1) {
        if (!task.priority) task.priority = p.key;
        text = text.split(p.mark).join("");
      }
    });

    text = text.replace(/[\s\-·]+$/, "").replace(/\s{2,}/g, " ").trim();

    // The source comes after the last " — " (or " -- ") on the line.
    var cut = Math.max(text.lastIndexOf(" — "), text.lastIndexOf(" -- "));
    if (cut !== -1) {
      var sep = text.substr(cut, 4) === " -- " ? 4 : 3;
      task.description = text.slice(0, cut).trim();
      task.source = text.slice(cut + sep).trim() || null;
    } else {
      task.description = text;
      task.source = null;
    }
    return task;
  }

  function parseNote(body, lineIndex) {
    var m = body.match(NOTE_RE);
    var text = m ? m[2] : body;
    return {
      line: lineIndex,
      date: m ? m[1] : null,
      text: text,
      kind: CLOSED_RE.test(text) ? "closed" : "note"
    };
  }

  /* Returns { date, groups: [{ name, tasks }], tasks } for the "## Tasks" section.
     A task's `line` is its 0-based line index: the key every edit uses. */
  function parse(markdown) {
    var lines = splitLines(markdown);
    var result = { date: findNoteDate(lines), groups: [], tasks: [] };
    var section = findTasksSection(lines);
    if (!section) return result;

    var group = null;
    var task = null;
    for (var i = section.start; i < section.end; i++) {
      var line = lines[i];
      var g = line.match(GROUP_RE);
      if (g) {
        group = { name: g[1].trim(), tasks: [] };
        result.groups.push(group);
        task = null;
        continue;
      }
      var t = line.match(TASK_RE);
      if (t) {
        if (!group) { group = { name: "", tasks: [] }; result.groups.push(group); }
        task = parseTaskBody(t[2]);
        task.line = i;
        task.done = t[1] !== " ";
        task.group = group.name;
        task.notes = [];
        group.tasks.push(task);
        result.tasks.push(task);
        continue;
      }
      var s = line.match(SUB_RE);
      if (s && task) { task.notes.push(parseNote(s[1], i)); continue; }
      if (line.trim() === "") continue;
      task = null; // any other line ends the current task's sub-items
    }
    return result;
  }

  function assertTaskLine(lines, lineIndex) {
    if (!TASK_RE.test(lines[lineIndex] || "")) {
      throw new Error("Line " + lineIndex + " is not a task line");
    }
  }

  /* Marks a task done ("[x]" + " ✅ date") or open again (removes both). */
  function setTaskDone(markdown, lineIndex, done, date) {
    var lines = splitLines(markdown);
    assertTaskLine(lines, lineIndex);
    var line = lines[lineIndex];
    if (done) {
      line = line.replace(/^- \[ \]/, "- [x]");
      if (!MARKERS.completed.test(line)) line = line.replace(/\s+$/, "") + " ✅ " + date;
    } else {
      line = line.replace(/^- \[[xX]\]/, "- [ ]").replace(new RegExp("\\s*✅\\s*" + DATE), "");
    }
    lines[lineIndex] = line;
    return joinLines(lines, markdown);
  }

  /* Adds "    - date - text" after the task's last sub-item. */
  function addTaskNote(markdown, lineIndex, date, text) {
    var clean = String(text).replace(/\s+/g, " ").trim();
    if (!clean) throw new Error("Empty note");
    var lines = splitLines(markdown);
    assertTaskLine(lines, lineIndex);
    var at = lineIndex + 1;
    while (at < lines.length && SUB_RE.test(lines[at])) at++;
    lines.splice(at, 0, NOTE_INDENT + "- " + date + " - " + clean);
    return joinLines(lines, markdown);
  }

  /* Adds an open task, in the format the user writes by hand:
       - [ ] {text} ➕ YYYY-MM-DD 📅 YYYY-MM-DD   (📅 only when there is a due date)
     It goes at the end of `group` (default "Needs to be done", the skill's first group).
     A missing group is created at the top of "## Tasks"; a missing "## Tasks" section is
     added at the end of the note. */
  function addTask(markdown, task) {
    var text = String(task.text || "").replace(/\s+/g, " ").trim();
    if (!text) throw new Error("Empty task");
    var line = "- [ ] " + text + " ➕ " + task.created + (task.due ? " 📅 " + task.due : "");
    var group = task.group || DEFAULT_GROUP;
    var lines = splitLines(markdown);
    var section = findTasksSection(lines);

    if (!section) {
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      lines.push("", "## Tasks", "", "**" + group + "**", line, "");
      if (lines[0] === "") lines.shift();
      return joinLines(lines, markdown);
    }

    var header = -1;
    for (var i = section.start; i < section.end; i++) {
      var g = lines[i].match(GROUP_RE);
      if (g && g[1].trim() === group) { header = i; break; }
    }

    if (header === -1) {
      var at = section.start;
      while (at < section.end && lines[at].trim() === "") at++;
      var block = ["**" + group + "**", line];
      if (at < lines.length) block.push("");
      if (at === section.start) block.unshift("");
      lines.splice.apply(lines, [at, 0].concat(block));
      return joinLines(lines, markdown);
    }

    // After the group's last task or sub-item, before the next group or the end of the section.
    var last = header;
    for (var j = header + 1; j < section.end && !GROUP_RE.test(lines[j]); j++) {
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

  var api = { parse: parse, setTaskDone: setTaskDone, addTaskNote: addTaskNote, addTask: addTask, toDateKey: toDateKey, DEFAULT_GROUP: DEFAULT_GROUP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DailyMarkdown = api;
})(this);
