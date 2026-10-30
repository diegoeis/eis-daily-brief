/* default-format.js
   The plugin's default daily format: a copy of references/daily-format.json (a test keeps them equal).
   Works in the browser (window.DailyDefaultFormat) and in Node (require). */
(function (root) {
  "use strict";
  var format = {
    "$schema": "./daily-format.schema.json",
    "version": 1,
    "dates": {
      "format": "YYYY-MM-DD"
    },
    "tasks": {
      "section": {
        "heading": "## Tasks",
        "endsAt": [
          "## ",
          "---"
        ]
      },
      "group": {
        "before": "**",
        "after": "**",
        "default": "Needs to be done"
      },
      "item": {
        "open": "- [ ] ",
        "done": [
          "- [x] ",
          "- [X] "
        ],
        "cancelled": "- [-] ",
        "newPrefix": "new - ",
        "sourceSeparators": [
          " — ",
          " -- "
        ]
      },
      "fields": {
        "created": "➕",
        "due": "📅",
        "completed": "✅",
        "ignore": [
          "⏳",
          "🛫"
        ]
      },
      "priority": {
        "🔺": "highest",
        "⏫": "high",
        "🔼": "medium",
        "🔽": "low",
        "⏬": "lowest",
        "⬇️": "low",
        "⬇": "low"
      },
      "comment": {
        "indent": "    ",
        "prefix": "- ",
        "line": "{date} - {text}",
        "closedPrefixes": [
          "Fechada:",
          "Fechado:",
          "Closed:"
        ]
      }
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = format;
  else root.DailyDefaultFormat = format;
})(this);
