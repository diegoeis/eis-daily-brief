/* handle-store.js
   Keeps folder handles (File System Access API) in IndexedDB, so the user picks a folder once.
   A handle can't go in localStorage: only IndexedDB stores it. Browser only. */
(function (root) {
  "use strict";

  var DB = "eis-daily-brief", STORE = "handles"; // name kept from before v0.9.0: renaming it would make users pick the folder again

  function open() {
    return new Promise(function (resolve, reject) {
      var req = root.indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function run(mode, action) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = action(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); resolve(req.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }

  root.HandleStore = {
    get: function (key) { return run("readonly", function (s) { return s.get(key); }); },
    set: function (key, handle) { return run("readwrite", function (s) { return s.put(handle, key); }); },
    remove: function (key) { return run("readwrite", function (s) { return s.delete(key); }); }
  };
})(this);
