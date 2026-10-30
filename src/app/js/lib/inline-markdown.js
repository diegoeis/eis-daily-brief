/* inline-markdown.js
   Renders the inline markdown the daily note uses (links, [[wikilinks]], `code`)
   as safe HTML. Everything else is escaped. No DOM, works in Node for tests. */
(function (root) {
  "use strict";

  var SAFE_URL = /^(https?:|mailto:|obsidian:)/i;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* links (optional): { wikiHref(target), wikiTitle(target) } turns [[wikilinks]] into links;
     without it they are plain text. */
  function unescapeHtml(text) {
    return String(text).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  function toHtml(text, links) {
    var codes = [];
    var html = escapeHtml(text).replace(/`([^`]+)`/g, function (_, code) {
      codes.push("<code>" + code + "</code>");
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, target, alias) {
      var label = (alias || target).trim();
      // target is already escaped; the page's own builder decides the URL.
      var href = links && links.wikiHref(unescapeHtml(target.trim()));
      if (!href || !SAFE_URL.test(href)) return '<span class="brief-wikilink">' + label + "</span>";
      return '<a class="eis-link brief-wikilink" href="' + escapeHtml(href) + '" title="' + escapeHtml(links.wikiTitle(unescapeHtml(target.trim()))) + '">' + label + "</a>";
    });
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      if (!SAFE_URL.test(url)) return '<span class="brief-wikilink">' + label + "</span>";
      return '<a class="eis-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    return html.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codes[i]; });
  }

  /* Plain text, for title attributes and counts. */
  function toText(text) {
    return String(text)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, t, a) { return (a || t).trim(); })
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }

  var api = { toHtml: toHtml, toText: toText, escapeHtml: escapeHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InlineMarkdown = api;
})(this);
