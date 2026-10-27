/* app/js/settings.js
   Settings of the dashboard. Today: the folder of the daily notes.
   The browser never exposes a folder's absolute path. The user picks the folder and the
   page gets a handle (File System Access API), with the folder name.
   The handle goes to IndexedDB (HandleStore), the only record that a folder is set.
   This view lives in the same page as the daily (index.html): after a new folder is chosen it
   tells the daily view to load again ("eis-daily-brief:folder-changed"). */
(function () {
  "use strict";

  var F = window.Format;
  var today = window.DailyMarkdown.toDateKey(new Date());
  var KEY = "daily-folder";
  var el = function (id) { return document.getElementById(id); };

  var TEXT = {
    none: "Nenhuma pasta escolhida",
    unsupported: "Este navegador não deixa escolher pastas. Use Chrome, Edge ou Arc.",
    failed: "Não foi possível abrir a pasta.",
  };

  function render(name) {
    el("daily-folder").textContent = name || TEXT.none;
    el("daily-folder").classList.toggle("brief-folder__value--empty", !name);
  }

  el("pick-folder").addEventListener("click", function () {
    el("daily-folder-error").textContent = "";
    if (!window.showDirectoryPicker) { el("daily-folder-error").textContent = TEXT.unsupported; return; }
    window.showDirectoryPicker({ id: "daily-notes", mode: "readwrite" }).then(function (handle) {
      return window.HandleStore.set(KEY, handle).then(function () {
        render(handle.name);
        window.dispatchEvent(new CustomEvent("eis-daily-brief:folder-changed"));
      });
    }).catch(function (e) {
      if (e && e.name !== "AbortError") el("daily-folder-error").textContent = TEXT.failed;
    });
  });

  el("settings-today").textContent = F.longDate(today);
  el("settings-today").setAttribute("datetime", today);
  render("");
  window.HandleStore.get(KEY).then(function (handle) { render(handle && handle.name); });
})();
