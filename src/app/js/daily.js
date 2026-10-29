/* app/js/daily.js
   The daily page: a UI layer over the latest daily note (markdown).
   - Task changes (done/open, new note) are markdown edits, saved through DailySource.
   - View choices (status, group, sort, collapsed groups) live only in the browser (ViewPrefs). */
(function () {
  "use strict";

  var DM = window.DailyMarkdown;
  var WS = window.Workspace; // the daily format and file pattern from the user's workspace
  // The mock note is written in the default format, whatever the user's is.
  function fmt() { return source.kind === "mock" ? DM.DEFAULT : WS.format; }
  var MD = window.InlineMarkdown;
  var F = window.Format;
  var esc = MD.escapeHtml;

  var TEXT = {
    allGroups: "Todos os grupos",
    noGroup: "Sem grupo",
    metrics: {
      open: "Abertas", openSub: function (n) { return "em " + n + (n === 1 ? " grupo" : " grupos"); },
      week: "Novas na semana", weekSub: function (n) { return "últimos 7 dias · " + n + (n === 1 ? " aberta" : " abertas"); },
      today: "Vencem hoje", todaySub: function (n) { return n + " nos próximos 7 dias"; },
      overdue: "Atrasadas", overdueSub: function (n) { return n === 0 ? "nenhuma" : "a mais antiga há " + n + " dias"; }
    },
    columns: { done: "Feita", idx: "#", task: "Tarefa", source: "Fonte", created: "Criada", due: "Prazo" },
    today: "HOJE",
    isNew: "Nova",
    priority: { highest: "Urgente", high: "Alta", medium: "Média", low: "Baixa", lowest: "Mínima" },
    doneOn: function (d) { return "feita em " + d; },
    groupOverdue: function (n) { return n + (n === 1 ? " atrasada" : " atrasadas"); },
    closed: "Fechada",
    addNote: "+ Comentário",
    notePlaceholder: "Atualização ou contexto desta tarefa",
    noteLabel: "Novo comentário",
    save: "Salvar",
    cancel: "Cancelar",
    empty: "Nenhuma tarefa com esses filtros.",
    allDone: {
      title: "Nada pendente por aqui",
      text: "Você não tem tarefas abertas nesta nota. Aproveite o respiro ou adicione o que vem a seguir.",
      add: "Adicionar tarefa",
      taskLabel: "Tarefa",
      taskPlaceholder: "O que precisa ser feito",
      dueLabel: "Prazo (opcional)"
    },
    loadError: "Não foi possível ler a nota do dia.",
    sourceKind: { mock: "mock", folder: "pasta" },
    panels: {
      setup: { title: "Pasta das daily notes", text: "Escolha a pasta onde a skill grava as daily notes para a tela ler e gravar a nota de verdade.", link: "Configurar pasta" },
      permission: { title: "Acesso à pasta", text: "O navegador pede para liberar de novo a pasta das daily notes.", allow: "Permitir acesso" },
      noNote: { title: "Nenhuma nota na pasta", text: function (p) { return "A pasta escolhida não tem nota no padrão " + p + " até hoje."; }, link: "Trocar a pasta" }
    },
    conflict: "A nota mudou fora do painel. Recarreguei a versão do arquivo: refaça a última alteração.",
    saveError: "Não foi possível gravar a nota. Nada foi alterado no arquivo.",
    badSettings: function (list) { return "Configuração da página inválida, usando o padrão: " + list.join("; ") + "."; }
  };

  var prefsStore = window.ViewPrefs.create(
    "eis-daily-brief:view:v1", // name kept from before v0.9.0 so saved view choices survive the rename
    { status: "open", group: "", sort: "note", collapsed: [] },
    { status: ["open", "done", "all"], sort: ["note", "due", "oldest", "newest"] }
  );

  // The real source (folder) when one is set in settings, else the mock. "panel" = what the note area asks of the user.
  var source = window.DailySource;
  var state = { path: "", markdown: "", model: DM.parse(""), prefs: prefsStore.load(), noteFormLine: null, addingTask: false, panel: null };
  var CHECK_EVERY_MS = 5000;
  var today = DM.toDateKey(new Date());
  var el = function (id) { return document.getElementById(id); };

  /* ---------- data ---------- */

  function show(note) {
    state.path = note.path;
    state.markdown = note.markdown;
    state.model = DM.parse(note.markdown, fmt());
    state.panel = source.kind === "mock" ? "setup" : null;
    render();
  }

  function load() {
    today = DM.toDateKey(new Date()); // the page may stay open past midnight
    return source.load().then(show, function (e) {
      var name = e && e.name;
      // Folder set in settings but not saved in this browser: show the mock and the call to settings.
      if (name === "NoFolder") { source = window.MockDailySource; return load(); }
      state.path = ""; state.markdown = ""; state.model = DM.parse("", fmt());
      state.panel = name === "PermissionNeeded" ? "permission" : name === "NoNote" ? "noNote" : null;
      render();
      if (!state.panel) el("tasks").innerHTML = '<p class="brief-empty eis-mono">' + esc(TEXT.loadError) + "</p>";
    });
  }

  function notice(text) {
    el("notice").textContent = text || "";
    el("notice").hidden = !text;
  }

  function commit(markdown) {
    notice(WS.problems.length ? TEXT.badSettings(WS.problems) : "");
    state.markdown = markdown;
    state.model = DM.parse(markdown, fmt());
    render();
    return source.save(markdown).catch(function (e) {
      if (e && e.name === "ConflictError") { notice(TEXT.conflict); return load(); }
      notice(TEXT.saveError);
      return load();
    });
  }

  /* A change made in the file (Obsidian, the skill) shows here: check the file's date every
     5 s while the tab is visible (nothing runs while it is hidden), and load the latest note
     again when the tab comes back. */
  function watch() {
    // Set up once; the source may change later (mock → folder), so check it on every tick.
    setInterval(function () {
      if (!source.hasChanged || document.hidden || isEditing() || state.panel) return;
      source.hasChanged().then(function (changed) { if (changed) load(); });
    }, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", function () {
      if (source.hasChanged && !document.hidden && !isEditing()) load();
    });
  }

  // A form is open: don't reload the note under the user's typing.
  function isEditing() { return state.noteFormLine !== null || state.addingTask; }

  function setPrefs(change) {
    Object.assign(state.prefs, change);
    prefsStore.save(state.prefs);
    render();
  }

  function isOverdue(t) { return !t.done && t.due && t.due < today; }

  function visibleTasks(tasks) {
    var p = state.prefs;
    var list = tasks.filter(function (t) {
      if (p.status === "open" && t.done) return false;
      if (p.status === "done" && !t.done) return false;
      return true;
    });
    var byKey = function (key, dir, empty) {
      return function (a, b) {
        var x = a[key] || empty, y = b[key] || empty;
        return x === y ? a.line - b.line : (x < y ? -dir : dir);
      };
    };
    if (p.sort === "due") list.sort(byKey("due", 1, "9999-99-99"));
    if (p.sort === "oldest") list.sort(byKey("created", 1, "9999-99-99"));
    if (p.sort === "newest") list.sort(byKey("created", -1, "0000-00-00"));
    // Done tasks always go to the end, in the order above.
    return list.filter(function (t) { return !t.done; }).concat(list.filter(function (t) { return t.done; }));
  }

  /* ---------- render ---------- */

  function render() {
    var model = state.model;
    var groups = model.groups.map(function (g) { return g.name; });
    if (state.prefs.group && groups.indexOf(state.prefs.group) === -1) state.prefs.group = "";

    el("today").textContent = F.longDate(today);
    el("today").setAttribute("datetime", today);
    el("note-path").textContent = state.path;
    el("nav-open-count").textContent = model.tasks.filter(function (t) { return !t.done; }).length;

    renderToolbar(groups);
    renderMetrics(model.tasks);
    renderTasks(model.groups);
    el("markdown").textContent = state.markdown;

    el("source-kind").textContent = TEXT.sourceKind[source.kind];
    renderPanel();
  }

  // Mock, no access or no note: the markdown panel gives way to what the user needs to do.
  function renderPanel() {
    var p = state.panel && TEXT.panels[state.panel];
    // Without access or without a note there is nothing to count or list: show only the panel.
    var blocked = Boolean(p) && state.panel !== "setup";
    ["summary", "toolbar", "tasks"].forEach(function (id) { el(id).hidden = blocked; });
    el("markdown-panel").hidden = Boolean(p);
    el("setup-panel").hidden = !p;
    if (!p) return;
    el("setup-h").textContent = p.title;
    el("setup-text").textContent = typeof p.text === "function" ? p.text(WS.pattern) : p.text;
    el("setup-link").hidden = !p.link;
    el("setup-link").textContent = p.link || "";
    el("setup-allow").hidden = !p.allow;
    el("setup-allow").textContent = p.allow || "";
  }

  function renderToolbar(groups) {
    var form = el("toolbar");
    form.querySelector('input[name="status"][value="' + state.prefs.status + '"]').checked = true;
    el("sort").value = state.prefs.sort;
    el("filter-group").innerHTML = ['<option value="">' + esc(TEXT.allGroups) + "</option>"].concat(groups.map(function (name) {
      return '<option value="' + esc(name) + '">' + esc(name || TEXT.noGroup) + "</option>";
    })).join("");
    el("filter-group").value = state.prefs.group;
  }

  function metric(label, value, sub, accent) {
    return '<div' + (accent ? ' class="eis-is-accent"' : "") + '><dt class="eis-label">' + esc(label) + "</dt><dd>" +
      F.count(value) + "</dd><dd>" + esc(sub) + "</dd></div>";
  }

  function renderMetrics(tasks) {
    var open = tasks.filter(function (t) { return !t.done; });
    // "Week" = the last 7 days, today included, so the number does not reset to zero on Mondays.
    var newThisWeek = tasks.filter(function (t) { var d = t.created && F.daysBetween(t.created, today); return d !== null && d >= 0 && d < 7; });
    var dueToday = open.filter(function (t) { return t.due === today; });
    var dueNext7 = open.filter(function (t) { var d = t.due && F.daysBetween(today, t.due); return d > 0 && d <= 7; });
    var overdue = open.filter(isOverdue);
    var oldest = overdue.reduce(function (max, t) { return Math.max(max, F.daysBetween(t.due, today)); }, 0);
    var openGroups = {};
    open.forEach(function (t) { openGroups[t.group] = true; });

    el("metrics").innerHTML =
      metric(TEXT.metrics.open, open.length, TEXT.metrics.openSub(Object.keys(openGroups).length)) +
      metric(TEXT.metrics.week, newThisWeek.length, TEXT.metrics.weekSub(newThisWeek.filter(function (t) { return !t.done; }).length)) +
      metric(TEXT.metrics.today, dueToday.length, TEXT.metrics.todaySub(dueNext7.length)) +
      metric(TEXT.metrics.overdue, overdue.length, TEXT.metrics.overdueSub(oldest), overdue.length > 0);
  }

  function renderTasks(groups) {
    var selected = state.prefs.group;
    var html = groups
      .filter(function (g) { return !selected || g.name === selected; })
      .map(function (g) { return { group: g, tasks: visibleTasks(g.tasks) }; })
      .filter(function (x) { return x.tasks.length > 0; })
      .map(function (x) { return renderGroup(x.group, x.tasks); })
      .join("");
    // No open task in the note: a friendly message and a way to add one, above any done tasks.
    var allDone = !state.model.tasks.some(function (t) { return !t.done; });
    if (allDone) { el("tasks").innerHTML = renderAllDone() + html; return; }
    el("tasks").innerHTML = html || '<p class="brief-empty eis-mono">' + esc(TEXT.empty) + "</p>";
  }

  function renderAllDone() {
    var a = TEXT.allDone;
    var action = state.addingTask
      ? '<form class="brief-add-task" id="add-task">' +
        '<div class="eis-field brief-add-task__text"><label for="add-task-text">' + a.taskLabel + "</label>" +
        '<input class="eis-input" id="add-task-text" name="text" autocomplete="off" required placeholder="' + esc(a.taskPlaceholder) + '"></div>' +
        '<div class="eis-field"><label for="add-task-due">' + a.dueLabel + "</label>" +
        '<input class="eis-input" id="add-task-due" name="due" type="date" min="' + today + '"></div>' +
        '<div class="brief-add-task__actions">' +
        '<button class="eis-button eis-button--ghost" type="button" data-action="task-cancel">' + TEXT.cancel + "</button>" +
        '<button class="eis-button eis-button--black" type="submit">' + TEXT.save + "</button></div></form>"
      : '<button class="eis-button eis-button--black" type="button" data-action="task-open">' + a.add + "</button>";
    return '<div class="brief-all-done"><h2>' + a.title + "</h2><p>" + a.text + "</p>" + action + "</div>";
  }

  function renderGroup(group, tasks) {
    var open = state.prefs.collapsed.indexOf(group.name) === -1;
    var overdue = tasks.filter(isOverdue).length;
    var c = TEXT.columns;
    return '<details data-group="' + esc(group.name) + '"' + (open ? " open" : "") + ">" +
      "<summary><h2>" + esc(group.name || TEXT.noGroup) + '</h2><span class="eis-mono">' +
      (overdue ? '<span class="eis-app-over">' + esc(TEXT.groupOverdue(overdue)) + "</span> · " : "") +
      tasks.length + "</span></summary>" +
      '<table class="eis-table"><colgroup><col class="eis-app-col-check"><col class="eis-app-col-idx"><col><col class="eis-app-col-src"><col class="eis-app-col-date"><col class="eis-app-col-due"></colgroup>' +
      '<thead class="eis-label"><tr>' +
      '<th scope="col"><span class="eis-visually-hidden">' + c.done + '</span></th><th scope="col">' + c.idx + '</th><th scope="col">' + c.task +
      '</th><th scope="col">' + c.source + '</th><th scope="col">' + c.created + '</th><th scope="col">' + c.due + "</th></tr></thead>" +
      "<tbody>" + tasks.map(renderTask).join("") + "</tbody></table></details>";
  }

  function renderTask(t, i) {
    var id = "task-" + t.line;
    var chip = function (cls, text) { return ' <span class="eis-chip eis-chip--sm ' + cls + '">' + text + "</span>"; };
    var meta = [];
    if (t.done && t.completed) meta.push("<em>" + esc(TEXT.doneOn(F.shortDate(t.completed))) + "</em>");
    meta.push('<button class="brief-text-button" type="button" data-action="note-open" data-line="' + t.line + '">' + TEXT.addNote + "</button>");

    var due = "—", dueClass = "";
    if (t.due) {
      due = '<time datetime="' + t.due + '">' + (t.due === today ? TEXT.today : F.shortDate(t.due)) + "</time>";
      if (!t.done) dueClass = t.due === today ? " eis-app-due--today" : (t.due < today ? " eis-app-due--over" : "");
    }

    return "<tr>" +
      // Only the checkbox marks a task done: the title is not a <label>, it names the checkbox through aria-labelledby.
      '<td><input class="eis-checkbox" type="checkbox" aria-labelledby="' + id + '" data-line="' + t.line + '"' + (t.done ? " checked" : "") + "></td>" +
      '<td class="eis-mono">' + F.count(i + 1) + "</td>" +
      // Title: "Fechada" first, then the text, then "Nova" and the priority.
      '<td><p class="eis-app-task-title" id="' + id + '">' +
      (t.done ? chip("eis-chip--success", TEXT.closed) + " " : "") +
      MD.toHtml(t.description) +
      (t.isNew ? chip("eis-chip--solid", TEXT.isNew) : "") +
      (t.priority ? chip(/high/.test(t.priority) ? "" : "eis-chip--outline", TEXT.priority[t.priority]) : "") + "</p>" +
      '<p class="eis-app-meta">' + meta.join("") + "</p>" +
      renderNotes(t) + "</td>" +
      '<td class="eis-mono" title="' + esc(t.source ? MD.toText(t.source) : "") + '">' + (t.source ? MD.toHtml(t.source) : "—") + "</td>" +
      '<td class="eis-mono">' + (t.created ? '<time datetime="' + t.created + '">' + F.shortDate(t.created) + "</time>" : "—") + "</td>" +
      '<td class="eis-mono' + dueClass + '">' + due + "</td></tr>";
  }

  function renderNotes(t) {
    var items = t.notes.map(function (n) {
      return '<li class="brief-note">' +
        (n.date ? '<time class="eis-mono" datetime="' + n.date + '">' + F.shortDate(n.date) + "</time>" : "<span></span>") +
        "<p>" + MD.toHtml(n.text) + "</p></li>";
    }).join("");
    var form = state.noteFormLine === t.line
      ? '<form class="brief-note-form" data-line="' + t.line + '">' +
        '<label class="eis-visually-hidden" for="note-' + t.line + '">' + TEXT.noteLabel + "</label>" +
        '<input class="eis-input" id="note-' + t.line + '" name="note" autocomplete="off" required placeholder="' + esc(TEXT.notePlaceholder) + '">' +
        '<button class="eis-button eis-button--sm eis-button--ghost" type="button" data-action="note-cancel">' + TEXT.cancel + "</button>" +
        '<button class="eis-button eis-button--sm eis-button--black" type="submit">' + TEXT.save + "</button></form>"
      : "";
    return (items ? '<ul class="brief-notes">' + items + "</ul>" : "") + form;
  }

  /* ---------- events ---------- */

  function bind() {
    var tasks = el("tasks");

    el("toolbar").addEventListener("change", function (e) {
      var name = e.target.name;
      if (name === "status" || name === "sort" || name === "group") {
        var change = {}; change[name] = e.target.value; setPrefs(change);
      }
    });
    el("toolbar").addEventListener("submit", function (e) { e.preventDefault(); });

    tasks.addEventListener("change", function (e) {
      if (!e.target.matches(".eis-checkbox")) return;
      commit(DM.setTaskDone(state.markdown, Number(e.target.dataset.line), e.target.checked, today, fmt()));
    });

    tasks.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "note-open") {
        state.noteFormLine = Number(btn.dataset.line);
        render();
        var input = el("note-" + state.noteFormLine);
        if (input) input.focus();
      }
      if (btn.dataset.action === "note-cancel") { state.noteFormLine = null; render(); }
      if (btn.dataset.action === "task-open") { state.addingTask = true; render(); el("add-task-text").focus(); }
      if (btn.dataset.action === "task-cancel") { state.addingTask = false; render(); }
    });

    tasks.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && e.target.closest(".brief-note-form")) { state.noteFormLine = null; render(); }
      if (e.key === "Escape" && e.target.closest("#add-task")) { state.addingTask = false; render(); }
    });

    tasks.addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      if (form.id === "add-task") {
        var task = form.elements.text.value;
        if (!task.trim()) return;
        state.addingTask = false;
        commit(DM.addTask(state.markdown, { text: task, created: today, due: form.elements.due.value || null }, fmt()));
        return;
      }
      var text = form.elements.note.value;
      if (!text.trim()) return;
      state.noteFormLine = null;
      commit(DM.addTaskNote(state.markdown, Number(form.dataset.line), today, text, fmt()));
    });

    el("setup-allow").addEventListener("click", function () {
      source.requestAccess().then(function (granted) { if (granted) load(); });
    });

    // "toggle" does not bubble: listen in the capture phase.
    tasks.addEventListener("toggle", function (e) {
      if (!e.target.matches("details[data-group]")) return;
      var name = e.target.dataset.group;
      var collapsed = state.prefs.collapsed.filter(function (n) { return n !== name; });
      if (!e.target.open) collapsed.push(name);
      if (collapsed.length !== state.prefs.collapsed.length) {
        state.prefs.collapsed = collapsed;
        prefsStore.save(state.prefs);
      }
    }, true);
  }

  bind();
  if (WS.problems.length) notice(TEXT.badSettings(WS.problems));
  // A folder chosen in the settings view: drop the mock and read the folder.
  window.addEventListener("eis-task-manager:folder-changed", function () {
    source = window.DailyFolderSource;
    load();
  });
  load().then(watch);
})();
