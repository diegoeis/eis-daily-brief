/* daily-files.js
   Finds and writes the daily note inside a folder handle (File System Access API).
   No DOM: it only uses the handle interface (entries(), getFile(), createWritable()),
   so Node tests can pass a fake handle built over a temp folder.
   Layout written by the eis-daily-brief skill: <folder>/YYYY-MM/YYYY-MM-DD.md */
(function (root) {
  "use strict";

  var MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  var NOTE = /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\.md$/;

  function ConflictError() {
    var e = new Error("The note changed outside the dashboard since it was read.");
    e.name = "ConflictError";
    return e;
  }

  async function namesOf(dir, kind, pattern) {
    var names = [];
    for await (var pair of dir.entries()) {
      if (pair[1].kind === kind && pattern.test(pair[0])) names.push(pair[0]);
    }
    return names.sort();
  }

  /* The latest note by date in its name. Notes dated after `today` (YYYY-MM-DD) are skipped,
     so a note prepared ahead of time does not replace today's. Returns null when there is none. */
  async function findLatest(folder, today) {
    var months = (await namesOf(folder, "directory", MONTH)).reverse();
    for (var i = 0; i < months.length; i++) {
      if (today && months[i] > today.slice(0, 7)) continue;
      var monthDir = await folder.getDirectoryHandle(months[i]);
      var files = (await namesOf(monthDir, "file", NOTE)).reverse().filter(function (name) {
        return !today || name.slice(0, 10) <= today;
      });
      // A month folder with no note in it: look at the previous month.
      if (files.length) {
        return { handle: await monthDir.getFileHandle(files[0]), path: folder.name + "/" + months[i] + "/" + files[0] };
      }
    }
    return null;
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

  var api = { findLatest: findLatest, read: read, writeIfUnchanged: writeIfUnchanged };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DailyFiles = api;
})(this);
