// Run from the project root: npm test
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const DM = require("../src/app/js/lib/daily-markdown.js");
const MD = require("../src/app/js/lib/inline-markdown.js");

const NOTE = [
  "---",
  "created: 2026-10-26",
  "---",
  "",
  "# 2026-10-26",
  "",
  "## Agenda",
  "- [ ] not a task: outside the Tasks section",
  "",
  "## Tasks",
  "",
  "**Needs to be done**",
  "- [ ] Ship the invoices screen ➕ 2026-10-23",
  "    - 2026-10-26 - Told support it ships Monday — [Slack DM](https://x.slack.com/p1)",
  "- [ ] new - Answer [[Bruno Lima]] about the talk — [Slack DM](https://x.slack.com/p2) - ➕ 2026-10-25 📅 2026-10-26",
  "- [ ] Strategy deck ⏫ ➕ 2026-10-14 📅 2026-11-15",
  "",
  "**Billing**",
  "- [x] Reply to [[Davi Rocha]] — [Slack DM](https://x.slack.com/p3) - ➕ 2026-10-22 ✅ 2026-10-26",
  "    - 2026-10-26 - Fechada: Davi said thanks — [Slack DM](https://x.slack.com/p4)",
  "- [ ] Old item ➕ 2026-09-19 ⬇️",
  "- [ ] Organise RPA-2511 ➕ 2026-10-21  📅 2026-10-23 -- [[Ana Prado]]",
  "",
  "---",
  "",
  "## Concluded",
  "- [ ] not a task either"
].join("\n");

test("parse: date, groups and only the Tasks section", () => {
  const m = DM.parse(NOTE);
  assert.equal(m.date, "2026-10-26");
  assert.deepEqual(m.groups.map((g) => g.name), ["Needs to be done", "Billing"]);
  assert.equal(m.tasks.length, 6);
});

test("parse: task fields", () => {
  const [ship, answer, deck, reply, old, rpa] = DM.parse(NOTE).tasks;
  assert.equal(ship.description, "Ship the invoices screen");
  assert.equal(ship.created, "2026-10-23");
  assert.equal(ship.source, null);
  assert.equal(ship.notes.length, 1);
  assert.equal(ship.notes[0].date, "2026-10-26");
  assert.equal(ship.notes[0].kind, "note");

  assert.equal(answer.isNew, true);
  assert.equal(answer.description, "Answer [[Bruno Lima]] about the talk");
  assert.equal(answer.source, "[Slack DM](https://x.slack.com/p2)");
  assert.equal(answer.due, "2026-10-26");

  assert.equal(deck.priority, "high");
  assert.equal(deck.description, "Strategy deck");

  assert.equal(reply.done, true);
  assert.equal(reply.completed, "2026-10-26");
  assert.equal(reply.group, "Billing");
  assert.equal(reply.notes[0].kind, "closed");

  assert.equal(old.priority, "low");
  assert.equal(old.description, "Old item");

  assert.equal(rpa.description, "Organise RPA-2511");
  assert.equal(rpa.source, "[[Ana Prado]]");
  assert.equal(rpa.due, "2026-10-23");
});

test("setTaskDone: marks done with ✅ and back, changing only that line", () => {
  const before = DM.parse(NOTE).tasks[0];
  const done = DM.setTaskDone(NOTE, before.line, true, "2026-10-27");
  const lines = done.split("\n");
  assert.equal(lines[before.line], "- [x] Ship the invoices screen ➕ 2026-10-23 ✅ 2026-10-27");
  assert.equal(lines.filter((l, i) => l !== NOTE.split("\n")[i]).length, 1);
  assert.equal(DM.setTaskDone(done, before.line, false), NOTE);
});

test("setTaskDone: keeps an existing ✅ date", () => {
  const reply = DM.parse(NOTE).tasks[3];
  assert.equal(DM.setTaskDone(NOTE, reply.line, true, "2030-01-01"), NOTE);
});

test("addTaskNote: appends after the last sub-item, in the skill format", () => {
  const ship = DM.parse(NOTE).tasks[0];
  const out = DM.addTaskNote(NOTE, ship.line, "2026-10-27", "  Waiting\nfor the flag ");
  const lines = out.split("\n");
  assert.equal(lines[ship.line + 2], "    - 2026-10-27 - Waiting for the flag");
  const again = DM.parse(out).tasks[0];
  assert.equal(again.notes.length, 2);
  assert.equal(again.notes[1].text, "Waiting for the flag");
});

test("addTaskNote: works on a task with no sub-items", () => {
  const deck = DM.parse(NOTE).tasks[2];
  const out = DM.addTaskNote(NOTE, deck.line, "2026-10-27", "Outline done");
  assert.equal(DM.parse(out).tasks[2].notes[0].text, "Outline done");
});

test("edits refuse a line that is not a task", () => {
  assert.throws(() => DM.setTaskDone(NOTE, 0, true, "2026-10-27"));
  assert.throws(() => DM.addTaskNote(NOTE, 0, "2026-10-27", "x"));
  assert.throws(() => DM.addTaskNote(NOTE, DM.parse(NOTE).tasks[0].line, "2026-10-27", "   "));
});

test("edits keep CRLF line endings", () => {
  const crlf = NOTE.replace(/\n/g, "\r\n");
  const line = DM.parse(crlf).tasks[0].line;
  assert.ok(!/[^\r]\n/.test(DM.setTaskDone(crlf, line, true, "2026-10-27")));
});

test("inline: links, wikilinks, code and escaping", () => {
  assert.equal(
    MD.toHtml("Ask [[Ana Prado|Ana]] <b> `a<b` [DM](https://x.com/p?a=1&b=2) [file](reports/x.md)"),
    'Ask <span class="brief-wikilink">Ana</span> &lt;b&gt; <code>a&lt;b</code> ' +
      '<a class="eis-link" href="https://x.com/p?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">DM</a> ' +
      '<span class="brief-wikilink">file</span>'
  );
  assert.equal(MD.toHtml("[x](javascript:alert(1))").includes("href"), false);
  assert.equal(MD.toText("[[A B]] and [DM](https://x)"), "A B and DM");
});

test("addTask: appends to the end of an existing group, after its sub-items", () => {
  const out = DM.addTask(NOTE, { text: " Write the  launch post ", created: "2026-10-27", due: "2026-10-30" });
  const m = DM.parse(out);
  const needs = m.groups.find((g) => g.name === "Needs to be done").tasks;
  const added = needs[needs.length - 1];
  assert.equal(added.description, "Write the launch post");
  assert.equal(added.created, "2026-10-27");
  assert.equal(added.due, "2026-10-30");
  assert.equal(added.done, false);
  assert.equal(out.split("\n")[added.line], "- [ ] Write the launch post ➕ 2026-10-27 📅 2026-10-30");
  assert.equal(m.tasks.length, DM.parse(NOTE).tasks.length + 1);
  // the other groups did not change
  assert.deepEqual(m.groups.find((g) => g.name === "Billing").tasks.map((t) => t.raw), DM.parse(NOTE).groups[1].tasks.map((t) => t.raw));
});

test("addTask: no due date, no 📅", () => {
  const out = DM.addTask(NOTE, { text: "Call the bank", created: "2026-10-27" });
  assert.ok(out.includes("- [ ] Call the bank ➕ 2026-10-27\n"));
});

test("addTask: creates the group at the top of Tasks when missing", () => {
  const note = NOTE.replace("**Needs to be done**", "**Other**");
  const m = DM.parse(DM.addTask(note, { text: "First", created: "2026-10-27" }));
  assert.equal(m.groups[0].name, "Needs to be done");
  assert.equal(m.groups[0].tasks[0].description, "First");
  assert.equal(m.groups.length, 3);
});

test("addTask: creates the Tasks section when the note has none, or is empty", () => {
  const empty = DM.addTask("", { text: "Only task", created: "2026-10-27" });
  assert.equal(empty, "## Tasks\n\n**Needs to be done**\n- [ ] Only task ➕ 2026-10-27\n");
  const noSection = DM.addTask("# 2026-10-27\n\n## Agenda\n\nnothing\n", { text: "Only task", created: "2026-10-27" });
  assert.equal(DM.parse(noSection).tasks[0].description, "Only task");
  assert.ok(noSection.startsWith("# 2026-10-27\n\n## Agenda\n\nnothing\n\n## Tasks\n"));
});

test("addTask: works when every task is done and keeps the separator", () => {
  const done = "## Tasks\n\n**Needs to be done**\n- [x] Old ✅ 2026-10-26\n\n---\n\n## Concluded\n";
  const out = DM.addTask(done, { text: "New one", created: "2026-10-27" });
  assert.equal(out, "## Tasks\n\n**Needs to be done**\n- [x] Old ✅ 2026-10-26\n- [ ] New one ➕ 2026-10-27\n\n---\n\n## Concluded\n");
  const emptySection = DM.addTask("## Tasks\n\n---\n", { text: "A", created: "2026-10-27" });
  assert.equal(emptySection, "## Tasks\n\n**Needs to be done**\n- [ ] A ➕ 2026-10-27\n\n---\n");
});

test("addTask: refuses empty text", () => {
  assert.throws(() => DM.addTask(NOTE, { text: "  ", created: "2026-10-27" }));
});
