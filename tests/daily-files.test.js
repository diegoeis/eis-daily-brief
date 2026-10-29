"use strict";
// Tests for src/app/js/lib/daily-files.js with a fake folder handle over a temp folder.
// The fake implements only what the lib uses from the File System Access API.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const DF = require("../src/app/js/lib/daily-files.js");

function fileHandle(p) {
  return {
    kind: "file",
    name: path.basename(p),
    async getFile() {
      const stat = fs.statSync(p);
      return { lastModified: stat.mtimeMs, text: async () => fs.readFileSync(p, "utf8") };
    },
    async createWritable() {
      let data = "";
      return { async write(t) { data += t; }, async close() { fs.writeFileSync(p, data); } };
    }
  };
}

function dirHandle(p) {
  return {
    kind: "directory",
    name: path.basename(p),
    async *entries() {
      for (const name of fs.readdirSync(p)) {
        const full = path.join(p, name);
        yield [name, fs.statSync(full).isDirectory() ? dirHandle(full) : fileHandle(full)];
      }
    },
    async getDirectoryHandle(name) { return dirHandle(path.join(p, name)); },
    async getFileHandle(name) { return fileHandle(path.join(p, name)); }
  };
}

function folder(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eis-task-manager-"));
  const dir = path.join(root, "daily");
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.mkdirSync(dir, { recursive: true });
  return { dir, handle: dirHandle(dir), cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("findLatest picks the latest note by its name, across months", async () => {
  const f = folder({
    "2026-09/2026-09-30.md": "sep",
    "2026-10/2026-10-01.md": "a",
    "2026-10/2026-10-12.md": "b",
    "2026-10/2026-10-09.md": "c"
  });
  try {
    const found = await DF.findLatest(f.handle, "2026-10-26");
    assert.equal(found.path, "daily/2026-10/2026-10-12.md");
    assert.equal(found.date, "2026-10-12");
    assert.equal((await DF.read(found.handle)).text, "b");
  } finally { f.cleanup(); }
});

test("findLatest skips notes dated after today and names out of the pattern", async () => {
  const f = folder({
    "2026-10/2026-10-20.md": "today-ish",
    "2026-10/2026-10-27.md": "future",
    "2026-11/2026-11-01.md": "future month",
    "2026-10/2026-10-25 copy.md": "copy",
    "2026-10/notes.md": "other",
    "drafts/2026-10-26.md": "not a month folder"
  });
  try {
    const found = await DF.findLatest(f.handle, "2026-10-26");
    assert.equal(found.path, "daily/2026-10/2026-10-20.md");
  } finally { f.cleanup(); }
});

test("findLatest goes back a month when the latest month folder has no note", async () => {
  const f = folder({ "2026-09/2026-09-29.md": "x", "2026-10/readme.txt": "" });
  try {
    assert.equal((await DF.findLatest(f.handle, "2026-10-26")).path, "daily/2026-09/2026-09-29.md");
  } finally { f.cleanup(); }
});

test("findLatest returns null for a folder with no note", async () => {
  const f = folder({ "other.md": "x" });
  try { assert.equal(await DF.findLatest(f.handle, "2026-10-26"), null); } finally { f.cleanup(); }
});

test("writeIfUnchanged writes when the file still holds the text last read", async () => {
  const f = folder({ "2026-10/2026-10-26.md": "- [ ] a\r\n" });
  try {
    const found = await DF.findLatest(f.handle, "2026-10-26");
    const before = await DF.read(found.handle);
    const after = await DF.writeIfUnchanged(found.handle, before.text, "- [x] a\r\n");
    assert.equal(after.text, "- [x] a\r\n");
    assert.equal(fs.readFileSync(path.join(f.dir, "2026-10/2026-10-26.md"), "utf8"), "- [x] a\r\n");
  } finally { f.cleanup(); }
});

test("writeIfUnchanged refuses and keeps the file when it changed outside", async () => {
  const f = folder({ "2026-10/2026-10-26.md": "original" });
  try {
    const found = await DF.findLatest(f.handle, "2026-10-26");
    const before = await DF.read(found.handle);
    fs.writeFileSync(path.join(f.dir, "2026-10/2026-10-26.md"), "edited in Obsidian");
    await assert.rejects(DF.writeIfUnchanged(found.handle, before.text, "from the UI"), { name: "ConflictError" });
    assert.equal(fs.readFileSync(path.join(f.dir, "2026-10/2026-10-26.md"), "utf8"), "edited in Obsidian");
  } finally { f.cleanup(); }
});

test("findLatest follows output.pattern: flat, nested and other separators", async () => {
  const flat = folder({ "2026-10-20.md": "a", "2026-10-25.md": "b", "2026-10-27.md": "future", "readme.md": "x" });
  const nested = folder({ "2026/09/30.md": "sep", "2026/10/02.md": "oct", "2026/11/01.md": "future", "2026/10/notes.md": "x" });
  const other = folder({ "notes/26.10.2026.md": "a", "notes/01.11.2026.md": "future", "notes/02.10.2026.md": "b" });
  try {
    assert.equal((await DF.findLatest(flat.handle, "2026-10-26", "YYYY-MM-DD.md")).path, "daily/2026-10-25.md");
    assert.equal((await DF.findLatest(nested.handle, "2026-10-26", "YYYY/MM/DD.md")).path, "daily/2026/10/02.md");
    assert.equal((await DF.findLatest(other.handle, "2026-10-26", "notes/DD.MM.YYYY.md")).path, "daily/notes/26.10.2026.md");
    assert.equal((await DF.findLatest(nested.handle, "2026-10-26", "YYYY/MM/DD.md")).date, "2026-10-02");
    assert.equal((await DF.findLatest(other.handle, "2026-10-26", "notes/DD.MM.YYYY.md")).date, "2026-10-26");
  } finally { flat.cleanup(); nested.cleanup(); other.cleanup(); }
});

test("findLatest skips a note whose name disagrees with its folder", async () => {
  const f = folder({ "2026-09/2026-10-12.md": "wrong month", "2026-09/2026-09-01.md": "ok" });
  try {
    assert.equal((await DF.findLatest(f.handle, "2026-10-26")).path, "daily/2026-09/2026-09-01.md");
  } finally { f.cleanup(); }
});

test("compilePattern refuses a pattern without the whole date", () => {
  assert.throws(() => DF.compilePattern("YYYY-MM.md"), /YYYY, MM and DD/);
  assert.throws(() => DF.compilePattern("YYYY//MM-DD.md"), /empty folder/);
});
