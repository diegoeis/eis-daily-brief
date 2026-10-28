/* app/js/sources/daily-folder-source.js
   Real data source of the daily page: the latest note in the folder the user chose in settings.
   Same interface as mock/daily-source.js, plus what only a real file needs:
     load()            -> Promise<{ path, markdown }>  finds the latest note and reads it
     save(markdown)    -> Promise<void>   writes only if the file did not change since load();
                                          otherwise rejects with a ConflictError and writes nothing
     hasChanged()      -> Promise<boolean> the file changed on disk since the last load/save
     requestAccess()   -> Promise<boolean> asks the browser again for the folder (needs a click)
   load() rejects with an error named NoFolder (nothing saved in this browser),
   PermissionNeeded (the browser wants a click to allow the folder again) or NoNote.
   Loaded after the mock, it is always tried first: with no folder handle in IndexedDB, load()
   rejects with NoFolder and the page falls back to the mock (window.MockDailySource). */
(function (root) {
  "use strict";

  var KEY = "daily-folder";
  var DF = root.DailyFiles;
  var current = null; // { handle, path, date, text, lastModified }
  var queue = Promise.resolve(); // saves run one at a time: each one checks the text the previous one wrote

  function fail(name, message) { var e = new Error(message || name); e.name = name; return e; }
  function today() { return root.DailyMarkdown.toDateKey(new Date()); }

  function folder() {
    return root.HandleStore.get(KEY).then(function (handle) {
      if (!handle) throw fail("NoFolder");
      return handle.queryPermission({ mode: "readwrite" }).then(function (state) {
        if (state !== "granted") throw fail("PermissionNeeded");
        return handle;
      });
    });
  }

  var source = {
    kind: "folder",

    load: function () {
      return folder().then(function (dir) { return DF.findLatest(dir, today(), root.Workspace.pattern); }).then(function (found) {
        if (!found) throw fail("NoNote");
        return DF.read(found.handle).then(function (file) {
          current = { handle: found.handle, path: found.path, date: found.date, text: file.text, lastModified: file.lastModified };
          return { path: found.path, markdown: file.text };
        });
      });
    },

    save: function (markdown) {
      var run = queue.then(function () {
        if (!current) throw fail("NoNote");
        return DF.writeIfUnchanged(current.handle, current.text, markdown).then(function (file) {
          current.text = file.text;
          current.lastModified = file.lastModified;
        });
      });
      queue = run.catch(function () {});
      return run;
    },

    /* True when the open note changed on disk, or when a newer note appeared in the folder
       (the skill wrote today's note while the page was open, or the day turned).
       The open note's date is checked first: one file stat per call. The folder is only walked
       while the open note is not today's, since no newer note can appear after today's. */
    hasChanged: function () {
      if (!current) return Promise.resolve(false);
      var opened = current;
      return opened.handle.getFile().then(function (file) {
        if (file.lastModified !== opened.lastModified) return true;
        if (opened.date === today()) return false;
        return folder().then(function (dir) { return DF.findLatest(dir, today(), root.Workspace.pattern); })
          .then(function (found) { return Boolean(found) && found.path !== opened.path; });
      });
    },

    requestAccess: function () {
      return root.HandleStore.get(KEY).then(function (handle) {
        return handle ? handle.requestPermission({ mode: "readwrite" }) : "denied";
      }).then(function (state) { return state === "granted"; });
    }
  };

  root.DailyFolderSource = source;
  root.DailySource = source;
})(this);
