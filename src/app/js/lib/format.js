/* format.js
   Dates and numbers for the interface, in English (en-GB: day before month). Dates come in as "YYYY-MM-DD"
   (local, the format the daily note uses). Every screen formats through here. */
(function (root) {
  "use strict";

  var LOCALE = "en-GB";
  var DAY_MS = 24 * 60 * 60 * 1000;

  function fromKey(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12);
  }

  /* Whole days from a to b (b - a). */
  function daysBetween(a, b) {
    return Math.round((fromKey(b) - fromKey(a)) / DAY_MS);
  }

  function longDate(key) {
    return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(fromKey(key));
  }

  function shortDate(key) {
    return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit" }).format(fromKey(key));
  }

  function count(n) {
    return String(n).padStart(2, "0");
  }

  root.Format = { daysBetween: daysBetween, longDate: longDate, shortDate: shortDate, count: count };
})(this);
