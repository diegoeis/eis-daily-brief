"use strict";
// Tests for src/app/js/sources/daily-folder-source.js: hasChanged() over a fake folder handle.
// The source is a browser script; it runs here in a vm context with the globals it reads.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const DF = require("../src/app/js/lib/daily-files.js");

const SOURCE = fs.readFileSync(path.join(__dirname, "../src/app/js/sources/daily-folder-source.js"), "utf8");

function pad(n) { return String(n).padStart(2, "0"); }
function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function notePath(k) { return k.slice(0, 7) + "/" + k + ".md"; }

// Fake handles that count folder walks, so the test can tell a stat from a scan.
function fake(dir, counter) {
  function fileHandle(p) {
    return {
      kind: "file", name: path.basename(p),
      async getFile() {
        const stat = fs.statSync(p);
        return { lastModified: stat.mtimeMs, text: async () => fs.readFileSync(p, "utf8") };
      }
    };
  }
  function dirHandle(p) {
    return {
      kind: "directory", name: path.basename(p),
      async *entries() {
        counter.walks++;
        for (const name of fs.readdirSync(p)) {
          const full = path.join(p, name);
          yield [name, fs.statSync(full).isDirectory() ? dirHandle(full) : fileHandle(full)];
        }
      },
      async queryPermission() { return "granted"; }
    };
  }
  return dirHandle(dir);
}

function setup(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eis-daily-brief-src-"));
  const dir = path.join(root, "daily");
  fs.mkdirSync(dir, { recursive: true });
  const write = (rel, text) => {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  const counter = { walks: 0 };
  const handle = fake(dir, counter);
  const ctx = {
    DailyFiles: DF,
    DailyMarkdown: { toDateKey: key },
    HandleStore: { get: async () => handle },
    Workspace: { pattern: "YYYY-MM/YYYY-MM-DD.md" },
    Promise
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { source: ctx.DailyFolderSource, counter, write, dir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("hasChanged with today's note open: one file check, no folder walk", async () => {
  const today = key(new Date());
  const s = setup({ [notePath(today)]: "today" });
  try {
    await s.source.load();
    s.counter.walks = 0;
    assert.equal(await s.source.hasChanged(), false);
    assert.equal(s.counter.walks, 0);
  } finally { s.cleanup(); }
});

test("hasChanged sees an edit to the open note", async () => {
  const today = key(new Date());
  const s = setup({ [notePath(today)]: "today" });
  try {
    await s.source.load();
    const file = path.join(s.dir, notePath(today));
    const later = new Date(Date.now() + 5000);
    fs.writeFileSync(file, "edited");
    fs.utimesSync(file, later, later);
    assert.equal(await s.source.hasChanged(), true);
  } finally { s.cleanup(); }
});

test("hasChanged with an older note open walks the folder and finds today's", async () => {
  const today = key(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = key(y);
  const s = setup({ [notePath(yesterday)]: "yesterday" });
  try {
    await s.source.load();
    assert.equal(await s.source.hasChanged(), false);
    s.write(notePath(today), "today");
    s.counter.walks = 0;
    assert.equal(await s.source.hasChanged(), true);
    assert.ok(s.counter.walks > 0);
  } finally { s.cleanup(); }
});
