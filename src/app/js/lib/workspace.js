/* workspace.js
   What the page takes from the user's workspace. The skills write ../page-settings.js, next to this
   app folder (.eis-task-manager/page-settings.js), from config.json and daily-format.json:
     window.EisTaskManagerSettings = { pattern: "YYYY-MM/YYYY-MM-DD.md", format: { ...daily format... } | null, vault: "/path/to/vault" | null, folder: "<output.folder>" | null }
   A missing file (or a missing part) means the defaults. An invalid part falls back to its
   default and is listed in `problems`, so the page can say so.
   Exposes window.Workspace = { pattern, format (compiled), vault (path of the notes vault, links [[notes]]) | null, folder (output.folder) | null, problems: [] }. */
(function (root) {
  "use strict";

  var DM = root.DailyMarkdown;
  var DF = root.DailyFiles;
  var given = root.EisTaskManagerSettings || root.EisDailyBriefSettings || {}; // old name: page-settings.js written before v0.9.0
  var ws = { pattern: DF.DEFAULT_PATTERN, format: DM.DEFAULT, vault: null, folder: null, problems: [], custom: false };
  if (typeof given.vault === "string" && given.vault) ws.vault = given.vault;
  ws.folder = typeof given.folder === "string" && given.folder ? given.folder : null;

  if (given.pattern) {
    try { DF.compilePattern(given.pattern); ws.pattern = given.pattern; }
    catch (e) { ws.problems.push(e.message); }
  }
  if (given.format) {
    try { ws.format = DM.compile(given.format); ws.custom = true; }
    catch (e) { ws.problems.push(e.message); }
  }

  root.Workspace = ws;
})(this);
