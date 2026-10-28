// The daily format: the default JSON, its schema and a custom format through every edit.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const DM = require("../src/app/js/lib/daily-markdown.js");

const REF = path.join(__dirname, "../src/references");
const json = (name) => JSON.parse(fs.readFileSync(path.join(REF, name), "utf8"));

test("the page's default format is the one in references/daily-format.json", () => {
  const ref = json("daily-format.json");
  delete ref.$schema;
  const page = JSON.parse(JSON.stringify(require("../src/app/js/lib/default-format.js")));
  delete page.$schema;
  assert.deepEqual(page, ref);
});

test("the default format is valid and uses every key the schema allows, and no other", () => {
  const f = json("daily-format.json");
  const schema = json("daily-format.schema.json");
  assert.deepEqual(DM.validateFormat(f), []);
  const keys = (s) => Object.keys(s.properties || {}).sort();
  assert.deepEqual(Object.keys(f).sort(), keys(schema));
  for (const k of Object.keys(f.tasks)) assert.ok(schema.properties.tasks.properties[k], "tasks." + k + " in schema");
  for (const [k, v] of Object.entries(f.tasks)) {
    const s = schema.properties.tasks.properties[k];
    if (s.properties) for (const kk of Object.keys(v)) assert.ok(s.properties[kk], "tasks." + k + "." + kk + " in schema");
  }
});

test("validateFormat names what is wrong", () => {
  const f = json("daily-format.json");
  f.dates.format = "YYYY-MM";
  f.tasks.comment.line = "{date}";
  f.tasks.priority["!"] = "urgent";
  const errors = DM.validateFormat(f);
  assert.equal(errors.length, 3);
  assert.throws(() => DM.compile(f), (e) => e.name === "InvalidFormat");
});

// A format unlike the default: other heading, ### groups, dates as DD/MM/YYYY, text markers.
const CUSTOM = DM.compile({
  version: 1,
  dates: { format: "DD/MM/YYYY" },
  tasks: {
    section: { heading: "# TODO", endsAt: ["# "] },
    group: { before: "### ", after: "", default: "Inbox" },
    item: { open: "* [ ] ", done: ["* [x] "], newPrefix: "", sourceSeparators: [" | "] },
    fields: { created: "created:", due: "due:", completed: "done:" },
    priority: { "!!": "high", "!": "medium" },
    comment: { indent: "  ", prefix: "* ", line: "({date}) {text}", closedPrefixes: ["Closed:"] }
  }
});

const NOTE = [
  "# 26/10/2026",
  "",
  "# TODO",
  "### Inbox",
  "* [ ] Call the bank !! | Email created: 20/10/2026 due: 27/10/2026",
  "  * (25/10/2026) Left a message",
  "### Home",
  "* [x] Fix the sink created: 01/10/2026 done: 25/10/2026",
  "  * (25/10/2026) Closed: plumber came",
  "",
  "# Notes",
  "* [ ] not a task"
].join("\n");

test("custom format: parse", () => {
  const m = DM.parse(NOTE, CUSTOM);
  assert.equal(m.date, "2026-10-26");
  assert.deepEqual(m.groups.map((g) => g.name), ["Inbox", "Home"]);
  const [bank, sink] = m.tasks;
  assert.equal(bank.description, "Call the bank");
  assert.equal(bank.source, "Email");
  assert.equal(bank.priority, "high");
  assert.equal(bank.created, "2026-10-20");
  assert.equal(bank.due, "2026-10-27");
  assert.deepEqual(bank.notes.map((n) => [n.date, n.text, n.kind]), [["2026-10-25", "Left a message", "note"]]);
  assert.equal(sink.done, true);
  assert.equal(sink.completed, "2026-10-25");
  assert.equal(sink.notes[0].kind, "closed");
});

test("custom format: done and undo give back the same text", () => {
  const line = DM.parse(NOTE, CUSTOM).tasks[0].line;
  const done = DM.setTaskDone(NOTE, line, true, "2026-10-26", CUSTOM);
  assert.equal(done.split("\n")[line], "* [x] Call the bank !! | Email created: 20/10/2026 due: 27/10/2026 done: 26/10/2026");
  assert.equal(DM.setTaskDone(done, line, false, "2026-10-26", CUSTOM), NOTE);
});

test("custom format: comment and new task in the format", () => {
  const line = DM.parse(NOTE, CUSTOM).tasks[0].line;
  const noted = DM.addTaskNote(NOTE, line, "2026-10-26", "Called again", CUSTOM).split("\n");
  assert.equal(noted[line + 2], "  * (26/10/2026) Called again");
  const added = DM.addTask(NOTE, { text: "Buy stamps", created: "2026-10-26", due: "2026-10-30" }, CUSTOM).split("\n");
  assert.equal(added[6], "* [ ] Buy stamps created: 26/10/2026 due: 30/10/2026");
  assert.equal(added[7], "### Home");
  const m = DM.parse(added.join("\n"), CUSTOM);
  assert.equal(m.groups[0].tasks.length, 2);
});
