/* app.js
   The app is one page with one view per area (<main data-view="…">), switched by the #hash.
   One page on purpose: on file:// browsers may keep storage per page file, so separate
   pages would not share the chosen folder or the view prefs. Default view: daily. */
(function () {
  "use strict";

  var TITLES = { daily: "Daily", settings: "Settings" };
  var views = document.querySelectorAll("main[data-view]");
  var links = document.querySelectorAll("[data-view-link]");

  function show() {
    var name = location.hash.slice(1);
    if (!TITLES[name]) name = "daily";
    views.forEach(function (v) { v.hidden = v.dataset.view !== name; });
    links.forEach(function (a) {
      if (a.dataset.viewLink === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = TITLES[name] + " — Task manager";
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", show);
  show();
})();
