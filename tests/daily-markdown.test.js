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

test("addTask: writes the priority mark before the dates, as the notes do", () => {
  const out = DM.addTask(NOTE, { text: "Fix the export", created: "2026-10-27", due: "2026-10-30", priority: "high" });
  assert.ok(out.includes("- [ ] Fix the export ⏫ ➕ 2026-10-27 📅 2026-10-30\n"));
  const added = DM.parse(out).tasks.find((t) => t.description === "Fix the export");
  assert.equal(added.priority, "high");
  assert.throws(() => DM.addTask(NOTE, { text: "x", created: "2026-10-27", priority: "huge" }));
});

test("editTask: text, priority and due, changing only that line", () => {
  const [ship, answer, deck] = DM.parse(NOTE).tasks;
  const lines = (md) => md.split("\n");
  const changed = (md) => lines(md).filter((l, i) => l !== lines(NOTE)[i]).length;

  let out = DM.editTask(NOTE, ship.line, { text: "Ship the new invoices screen" });
  assert.equal(lines(out)[ship.line], "- [ ] Ship the new invoices screen ➕ 2026-10-23");
  assert.equal(changed(out), 1);

  out = DM.editTask(NOTE, ship.line, { priority: "highest", due: "2026-10-31" });
  assert.equal(lines(out)[ship.line], "- [ ] Ship the invoices screen 🔺 ➕ 2026-10-23 📅 2026-10-31");

  out = DM.editTask(NOTE, answer.line, { text: "Answer Bruno", priority: "medium", due: "2026-10-28" });
  assert.equal(lines(out)[answer.line], "- [ ] new - Answer Bruno — [Slack DM](https://x.slack.com/p2) - 🔼 ➕ 2026-10-25 📅 2026-10-28");

  out = DM.editTask(NOTE, deck.line, { priority: null, due: null });
  assert.equal(lines(out)[deck.line], "- [ ] Strategy deck ➕ 2026-10-14");
  out = DM.editTask(NOTE, deck.line, { priority: "low" });
  assert.equal(lines(out)[deck.line], "- [ ] Strategy deck 🔽 ➕ 2026-10-14 📅 2026-11-15");

  // nothing changes when the values are the same
  assert.equal(DM.editTask(NOTE, deck.line, { text: "Strategy deck", priority: "high", due: "2026-11-15" }), NOTE);
  assert.throws(() => DM.editTask(NOTE, deck.line, { text: "  " }));
  assert.throws(() => DM.editTask(NOTE, 0, { text: "x" }));
});

test("editTask: a done task keeps its ✅, a task with no dates gets them at the end", () => {
  const reply = DM.parse(NOTE).tasks[3];
  const out = DM.editTask(NOTE, reply.line, { due: "2026-10-24" });
  assert.equal(out.split("\n")[reply.line], "- [x] Reply to [[Davi Rocha]] — [Slack DM](https://x.slack.com/p3) - ➕ 2026-10-22 📅 2026-10-24 ✅ 2026-10-26");
  const bare = "## Tasks\n\n**A**\n- [ ] Plain\n";
  assert.equal(DM.editTask(bare, 3, { priority: "high", due: "2026-11-01" }), "## Tasks\n\n**A**\n- [ ] Plain ⏫ 📅 2026-11-01\n");
});

test("editTask: a description split by marks is written again with the same parts", () => {
  const note = "## Tasks\n\n**A**\n- [ ] Call ➕ 2026-10-20 the bank — [[Ana Prado]]\n";
  const out = DM.editTask(note, 3, { text: "Call the bank today" });
  const t = DM.parse(out).tasks[0];
  assert.equal(t.description, "Call the bank today");
  assert.equal(t.source, "[[Ana Prado]]");
  assert.equal(t.created, "2026-10-20");
});

test("setTaskCancelled: [-] and back, only the start of that line changes", () => {
  const deck = DM.parse(NOTE).tasks[2];
  const out = DM.setTaskCancelled(NOTE, deck.line, true);
  assert.equal(out.split("\n")[deck.line], "- [-] Strategy deck ⏫ ➕ 2026-10-14 📅 2026-11-15");
  const t = DM.parse(out).tasks[2];
  assert.equal(t.cancelled, true);
  assert.equal(t.done, true); // closed: out of the open counts
  assert.equal(t.priority, "high");
  assert.equal(DM.setTaskCancelled(out, deck.line, false), NOTE);
  assert.equal(DM.parse(NOTE).tasks[2].cancelled, false);
  assert.throws(() => DM.setTaskCancelled(NOTE, DM.parse(NOTE).tasks[3].line, true)); // done task
  assert.throws(() => DM.setTaskCancelled(NOTE, 0, true));
});

test("editTaskNote: keeps the date, touches only that comment", () => {
  const ship = DM.parse(NOTE).tasks[0];
  const n = ship.notes[0];
  const out = DM.editTaskNote(NOTE, n.line, " Ships  Tuesday ");
  assert.equal(out.split("\n")[n.line], "    - 2026-10-26 - Ships Tuesday");
  const undated = "## Tasks\n\n- [ ] A\n  - loose note\n";
  assert.equal(DM.editTaskNote(undated, 3, "fixed"), "## Tasks\n\n- [ ] A\n  - fixed\n");

  assert.throws(() => DM.editTaskNote(NOTE, ship.line, "x"));
  assert.throws(() => DM.editTaskNote(NOTE, n.line, "  "));
});

test("deleteTaskNote: removes only that comment line", () => {
  const ship = DM.parse(NOTE).tasks[0];
  const n = ship.notes[0];
  const out = DM.deleteTaskNote(NOTE, n.line);
  const before = NOTE.split("\n");
  before.splice(n.line, 1);
  assert.equal(out, before.join("\n"));
  const after = DM.parse(out).tasks[0];
  assert.equal(after.description, ship.description);
  assert.equal(after.notes.length, ship.notes.length - 1);
  const undated = "## Tasks\n\n- [ ] A\n  - one\n  - two\n- [ ] B\n";
  assert.equal(DM.deleteTaskNote(undated, 4), "## Tasks\n\n- [ ] A\n  - one\n- [ ] B\n");
  assert.equal(DM.deleteTaskNote(undated, 3), "## Tasks\n\n- [ ] A\n  - two\n- [ ] B\n");

  assert.throws(() => DM.deleteTaskNote(NOTE, ship.line));
  assert.throws(() => DM.deleteTaskNote(undated, 0));
});

test("inline: [[wikilinks]] become links only with a link builder", () => {
  const links = { wikiHref: (t) => "obsidian://open?vault=v&file=" + encodeURIComponent(t), wikiTitle: (t) => "/v/" + t + ".md" };
  assert.equal(MD.toHtml("[[A & B|ab]]", links),
    '<a class="eis-link brief-wikilink" href="obsidian://open?vault=v&amp;file=A%20%26%20B" title="/v/A &amp; B.md">ab</a>');
  assert.equal(MD.toHtml("[[A]]"), '<span class="brief-wikilink">A</span>');
  assert.equal(MD.toHtml("[[A]]", { wikiHref: () => "javascript:x", wikiTitle: () => "" }), '<span class="brief-wikilink">A</span>');
});

test("actions: 🤖 comments are instructions with a state; edits keep the mark", () => {
  const note = [
    "## Tasks",
    "",
    "**A**",
    "- [ ] Specify the status button",
    "    - 2026-10-29 - plain comment",
    "    - 2026-10-29 - 🤖 /prod-specs-story Write the story",
    "    - 2026-10-29 - 🤖✅ Make the mock",
    "    - 2026-10-30 - Resultado: mock in Figma — [Figma](https://figma.com/x)",
    "    - 2026-10-29 - 🤖⚠️ Watch the thread",
    "    - 2026-10-29 - 🤖⏳ Being done",
    ""
  ].join("\n");
  const [plain, pending, done, result, failed, running] = DM.parse(note).tasks[0].notes;
  assert.equal(running.action, "running");
  assert.equal(running.text, "Being done");
  assert.equal(plain.kind, "note");
  assert.equal(pending.kind, "action");
  assert.equal(pending.action, "pending");
  assert.equal(pending.text, "/prod-specs-story Write the story");
  assert.equal(done.action, "done");
  assert.equal(done.text, "Make the mock");
  assert.equal(result.action, null);
  assert.equal(failed.action, "failed");

  const edited = DM.editTaskNote(note, pending.line, "/prod-specs-story Write the story and the mock");
  assert.equal(edited.split("\n")[pending.line], "    - 2026-10-29 - 🤖 /prod-specs-story Write the story and the mock");
  assert.equal(DM.editTaskNote(note, done.line, "Make the mock").split("\n")[done.line], "    - 2026-10-29 - 🤖✅ Make the mock");

  assert.equal(DM.editTaskNote(note, failed.line, "Watch the thread daily").split("\n")[failed.line], "    - 2026-10-29 - 🤖 Watch the thread daily");

  const added = DM.addTaskNote(note, 3, "2026-10-31", "Create a cron for the thread", undefined, true);
  assert.equal(added.split("\n")[10], "    - 2026-10-31 - 🤖 Create a cron for the thread");
  assert.equal(DM.addTaskNote(note, 3, "2026-10-31", "x").split("\n")[10], "    - 2026-10-31 - x");
});

test("actions: a format without action marks has none, and refuses to add one", () => {
  const f = JSON.parse(JSON.stringify(require("../src/references/daily-format.json")));
  delete f.tasks.comment.action;
  const F = DM.compile(f);
  const n = DM.parse("## Tasks\n\n- [ ] A\n    - 2026-10-29 - 🤖 do it\n", F).tasks[0].notes[0];
  assert.equal(n.kind, "note");
  assert.equal(n.text, "🤖 do it");
  assert.throws(() => DM.addTaskNote("## Tasks\n\n- [ ] A\n", 2, "2026-10-29", "x", F, true));
  f.tasks.comment.action = { pending: "🤖 ", running: "r", done: "🤖 ", failed: "x" };
  assert.throws(() => DM.compile(f));
});
