/* view-prefs.js
   Saves view choices (filters, sorting, collapsed groups) in the browser only.
   These never touch the markdown. One key per page, versioned, validated on read. */
(function (root) {
  "use strict";

  /* defaults: { field: value }. allowed: { field: [values] } for fields with a closed list. */
  function create(key, defaults, allowed) {
    allowed = allowed || {};

    function isValid(field, value) {
      if (!(field in defaults)) return false;
      if (allowed[field]) return allowed[field].indexOf(value) !== -1;
      if (Array.isArray(defaults[field])) return Array.isArray(value);
      return typeof value === typeof defaults[field];
    }

    function load() {
      var prefs = Object.assign({}, defaults);
      try {
        var saved = JSON.parse(root.localStorage.getItem(key) || "{}");
        Object.keys(saved).forEach(function (f) { if (isValid(f, saved[f])) prefs[f] = saved[f]; });
      } catch (e) { /* corrupt or blocked storage: use defaults */ }
      return prefs;
    }

    function save(prefs) {
      try { root.localStorage.setItem(key, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ }
    }

    return { load: load, save: save };
  }

  root.ViewPrefs = { create: create };
})(this);
