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
    columns: { done: "Feita", idx: "#", task: "Tarefa", source: "Fonte", created: "Criada", due: "Prazo", act: "Cancelar ou reabrir" },
    today: "HOJE",
    isNew: "Nova",
    priority: { highest: "Urgente", high: "Alta", medium: "Média", low: "Baixa", lowest: "Mínima" },
    doneOn: function (d) { return "feita em " + d; },
    groupOverdue: function (n) { return n + (n === 1 ? " atrasada" : " atrasadas"); },
    closed: "Fechada",
    addNote: "+ Comentário",
    dblclick: "Clique duas vezes para editar",
    openInObsidian: "Abrir no Obsidian",
    cancelTask: "Cancelar tarefa",
    reopenTask: "Reabrir tarefa",
    cancelled: "Cancelada",
    editTaskLabel: "Tarefa",
    editNoteLabel: "Comentário",
    noPriority: "Sem prioridade",
    priorityLabel: "Prioridade",
    groupLabel: "Grupo",
    addTask: "+ Tarefa",
    notePlaceholder: "Atualização ou contexto desta tarefa",
    actionPlaceholder: "O que a IA deve fazer (ex.: /skill e o pedido). Roda no próximo tasks-act",
    actionToggle: "Ação para a IA: o tasks-act executa este comentário",
    action: { pending: "🤖 A executar", running: "🤖 Executando", done: "🤖 Executada", failed: "🤖 Falhou" },
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
    { status: ["open", "today", "done", "cancelled", "all"], sort: ["note", "due", "priority", "oldest", "newest"] }
  );

  // The real source (folder) when one is set in settings, else the mock. "panel" = what the note area asks of the user.
  var source = window.DailySource;
  /* Open forms, by the line they edit: one at a time.
     noteFormLine = new comment under that task; editTaskLine / editNoteLine / editDueLine = editing that
     task's text and priority, that comment, that task's due date (opened by a double click). */
  var state = { path: "", markdown: "", model: DM.parse(""), prefs: prefsStore.load(), noteFormLine: null, addingTask: false,
    editTaskLine: null, editNoteLine: null, editDueLine: null, panel: null, search: "" };
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

  function closeForms() {
    state.noteFormLine = null; state.addingTask = false; state.editTaskLine = null; state.editNoteLine = null; state.editDueLine = null;
  }

  // Runs an edit of the note; an edit that fails (the line moved, empty text) changes nothing.
  function edit(fn) {
    var markdown;
    try { markdown = fn(); } catch (e) { notice(TEXT.saveError); return load(); }
    closeForms();
    return commit(markdown);
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
  function isEditing() { return state.noteFormLine !== null || state.addingTask || state.editTaskLine !== null || state.editNoteLine !== null || state.editDueLine !== null; }

  function setPrefs(change) {
    Object.assign(state.prefs, change);
    prefsStore.save(state.prefs);
    render();
  }

  function fold(text) { return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  function rank(t) { var i = DM.LEVELS.indexOf(t.priority); return i === -1 ? 2.5 : i; }

  function isOverdue(t) { return !t.done && t.due && t.due < today; }

  function visibleTasks(tasks) {
    var p = state.prefs;
    var words = fold(state.search).split(/\s+/).filter(Boolean);
    var list = tasks.filter(function (t) {
      if (words.length) {
        // Every word must be in the task: its text, source, group or comments; any case, any accent.
        var hay = fold([t.description, t.source || "", t.group].concat(t.notes.map(function (n) { return n.text; })).map(MD.toText).join(" "));
        if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return false;
      }
      if (p.status === "open") return !t.done;
      if (p.status === "today") return !t.done && t.due === today;
      if (p.status === "done") return t.done && !t.cancelled;
      if (p.status === "cancelled") return t.cancelled;
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
    // Highest first; no mark counts as between medium and low, as in tasks-update and Obsidian Tasks.
    if (p.sort === "priority") list.sort(function (a, b) {
      var x = rank(a), y = rank(b);
      return x === y ? a.line - b.line : x - y;
    });
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
    var inVault = notePathInVault(state.path);
    el("note-path").innerHTML = inVault
      ? '<a class="eis-link" href="' + esc(obsidianHref(inVault)) + '" title="' + esc(TEXT.openInObsidian) + '">' + esc(inVault) + "</a>"
      : esc(state.path);
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
    el("tasks").innerHTML = renderAddBar() + (html || '<p class="brief-empty eis-mono">' + esc(TEXT.empty) + "</p>");
  }

  function renderAllDone() {
    var a = TEXT.allDone;
    var action = state.addingTask ? renderAddForm()
      : '<button class="eis-button eis-button--black" type="button" data-action="task-open">' + a.add + "</button>";
    return '<div class="brief-all-done"><h2>' + a.title + "</h2><p>" + a.text + "</p>" + action + "</div>";
  }

  // Above the groups while adding a task (the "+ Tarefa" button sits in the toolbar).
  function renderAddBar() {
    return state.addingTask ? '<div class="brief-add-bar">' + renderAddForm() + "</div>" : "";
  }

  // Only the levels the format has a mark for; a format with no priority marks gets no field.
  // compact: no visible label and no field wrapper, for the inline edit row; the options are the
  // format's own marks (the Obsidian Tasks emojis by default), named in their title.
  function prioritySelect(id, value, compact) {
    var levels = DM.LEVELS.filter(function (l) { return fmt().priorityMark[l]; });
    if (!levels.length) return "";
    if (compact) {
      return '<label class="eis-visually-hidden" for="' + id + '">' + TEXT.priorityLabel + "</label>" +
        '<select class="eis-select brief-inline-edit__priority" id="' + id + '" name="priority" title="' + TEXT.priorityLabel + '">' +
        '<option value="" title="' + TEXT.noPriority + '">—</option>' +
        levels.map(function (l) {
          return '<option value="' + l + '" title="' + TEXT.priority[l] + '"' + (l === value ? " selected" : "") + ">" +
            esc(fmt().priorityMark[l]) + "</option>";
        }).join("") + "</select>";
    }
    return '<div class="eis-field"><label for="' + id + '">' + TEXT.priorityLabel + "</label>" +
      '<select class="eis-select" id="' + id + '" name="priority"><option value="">' + TEXT.noPriority + "</option>" +
      levels.map(function (l) {
        return '<option value="' + l + '"' + (l === value ? " selected" : "") + ">" + TEXT.priority[l] + "</option>";
      }).join("") + "</select></div>";
  }

  function formActions(cancelAction, small) {
    var sm = small ? " eis-button--sm" : "";
    return '<div class="brief-add-task__actions">' +
      '<button class="eis-button eis-button--ghost' + sm + '" type="button" data-action="' + cancelAction + '">' + TEXT.cancel + "</button>" +
      '<button class="eis-button eis-button--black' + sm + '" type="submit">' + TEXT.save + "</button></div>";
  }

  function renderAddForm() {
    var a = TEXT.allDone;
    // The groups of the note, the default one first even when the note doesn't have it yet.
    var names = [fmt().defaultGroup].concat(state.model.groups.map(function (g) { return g.name; }))
      .filter(function (n, i, all) { return n && all.indexOf(n) === i; });
    var current = state.prefs.group && names.indexOf(state.prefs.group) !== -1 ? state.prefs.group : names[0];
    return '<form class="brief-add-task" id="add-task">' +
      '<div class="eis-field brief-add-task__text"><label for="add-task-text">' + a.taskLabel + "</label>" +
      '<input class="eis-input" id="add-task-text" name="text" autocomplete="off" required placeholder="' + esc(a.taskPlaceholder) + '"></div>' +
      '<div class="eis-field"><label for="add-task-group">' + TEXT.groupLabel + "</label>" +
      '<select class="eis-select" id="add-task-group" name="group">' + names.map(function (n) {
        return '<option value="' + esc(n) + '"' + (n === current ? " selected" : "") + ">" + esc(n) + "</option>";
      }).join("") + "</select></div>" +
      prioritySelect("add-task-priority", "") +
      '<div class="eis-field"><label for="add-task-due">' + a.dueLabel + "</label>" +
      '<input class="eis-input" id="add-task-due" name="due" type="date" min="' + today + '"></div>' +
      formActions("task-cancel") + "</form>";
  }

  function renderGroup(group, tasks) {
    var open = state.prefs.collapsed.indexOf(group.name) === -1;
    var overdue = tasks.filter(isOverdue).length;
    var c = TEXT.columns;
    return '<details data-group="' + esc(group.name) + '"' + (open ? " open" : "") + ">" +
      "<summary><h2>" + esc(group.name || TEXT.noGroup) + '</h2><span class="eis-mono">' +
      (overdue ? '<span class="eis-app-over">' + esc(TEXT.groupOverdue(overdue)) + "</span> · " : "") +
      tasks.length + "</span></summary>" +
      '<table class="eis-table"><colgroup><col class="eis-app-col-idx"><col class="eis-app-col-check"><col><col class="eis-app-col-src"><col class="eis-app-col-date"><col class="eis-app-col-due"><col class="brief-col-act"></colgroup>' +
      '<thead class="eis-label"><tr>' +
      '<th scope="col">' + c.idx + '</th><th scope="col"><span class="eis-visually-hidden">' + c.done + '</span></th><th scope="col">' + c.task +
      '</th><th scope="col">' + c.source + '</th><th scope="col">' + c.created + '</th><th scope="col">' + c.due +
      '</th><th scope="col"><span class="eis-visually-hidden">' + c.act + "</span></th></tr></thead>" +
      "<tbody>" + tasks.map(renderTask).join("") + "</tbody></table></details>";
  }

  function renderTask(t, i) {
    var id = "task-" + t.line;
    var chip = function (cls, text) { return ' <span class="eis-chip eis-chip--sm ' + cls + '">' + text + "</span>"; };
    var meta = [];
    if (t.done && t.completed) meta.push("<em>" + esc(TEXT.doneOn(F.shortDate(t.completed))) + "</em>");
    meta.push(textButton("note-open", t.line, TEXT.addNote));

    var due = "—", dueClass = "";
    if (t.due) {
      due = '<time datetime="' + t.due + '">' + (t.due === today ? TEXT.today : F.shortDate(t.due)) + "</time>";
      if (!t.done) dueClass = t.due === today ? " eis-app-due--today" : (t.due < today ? " eis-app-due--over" : "");
    }
    if (state.editDueLine === t.line) {
      due = '<input class="eis-input brief-due-input" type="date" data-due-input data-line="' + t.line + '" value="' + (t.due || "") +
        '" aria-label="' + esc(TEXT.columns.due) + '">';
    }

    // Title: "Fechada" or "Cancelada" first, then the text, then "Nova" and the priority.
    var title = state.editTaskLine === t.line ? renderTaskForm(t)
      : '<p class="eis-app-task-title' + (t.cancelled ? " brief-cancelled" : "") + '" id="' + id + '" data-edit-task="' + t.line + '" title="' + TEXT.dblclick + '">' +
        (t.cancelled ? chip("eis-chip--outline", TEXT.cancelled) + " " : t.done ? chip("eis-chip--success", TEXT.closed) + " " : "") +
        MD.toHtml(t.description, links()) +
        (t.isNew ? chip("eis-chip--solid", TEXT.isNew) : "") +
        (t.priority ? chip(/high/.test(t.priority) ? "" : "eis-chip--outline", TEXT.priority[t.priority]) : "") + "</p>";

    return "<tr>" +
      '<td class="eis-mono">' + F.count(i + 1) + "</td>" +
      // Only the checkbox marks a task done: the title is not a <label>, it names the checkbox through aria-labelledby.
      '<td><input class="eis-checkbox" type="checkbox" aria-labelledby="' + id + '" data-line="' + t.line + '"' + (t.done && !t.cancelled ? " checked" : "") + (t.cancelled ? " disabled" : "") + "></td>" +
      // Comments and the new-comment form sit above "+ Comentário".
      "<td>" + title + renderNotes(t) + '<p class="eis-app-meta">' + meta.join("") + "</p></td>" +
      '<td class="eis-mono" title="' + esc(t.source ? MD.toText(t.source) : "") + '">' + (t.source ? MD.toHtml(t.source, links()) : "—") + "</td>" +
      '<td class="eis-mono">' + (t.created ? '<time datetime="' + t.created + '">' + F.shortDate(t.created) + "</time>" : "—") + "</td>" +
      '<td class="eis-mono brief-due' + dueClass + '" data-edit-due="' + t.line + '" title="' + TEXT.dblclick + '">' + due + "</td>" +
      "<td>" + (fmt().cancelled && (!t.done || t.cancelled) ? cancelButton(t) : "") + "</td></tr>";
  }

  /* Notes open in Obsidian when the page knows the vault (page-settings.js): obsidian://open?file=<name>.md. */
  function obsidianHref(file) {
    return "obsidian://open?file=" + encodeURIComponent(/\.md$/i.test(file) ? file : file + ".md");
  }

  function links() {
    if (!WS.vault) return null;
    var root = WS.vault.replace(/[\\/]+$/, "");
    return {
      wikiHref: function (target) { return obsidianHref(target); },
      wikiTitle: function (target) { return root + "/" + target + ".md"; }
    };
  }

  /* The note's path inside the vault: the chosen folder's place in the vault (from page-settings.js)
     plus the path the page found under it. Without the vault, the path as found. */
  function notePathInVault(path) {
    if (!WS.vault || !WS.folder || !path) return null;
    var vault = WS.vault.replace(/[\\/]+$/, ""), folder = WS.folder.replace(/[\\/]+$/, "");
    if (folder.indexOf(vault + "/") !== 0) return null;
    var under = path.slice(path.indexOf("/") + 1); // the path starts with the chosen folder's name
    return folder.slice(vault.length + 1) + "/" + under;
  }

  function textButton(action, line, label) {
    return '<button class="brief-text-button" type="button" data-action="' + action + '" data-line="' + line + '">' + label + "</button>";
  }

  // Cancel an open task (- [-]) or reopen a cancelled one: one click, undone by the same button.
  var ICON = {
    cancel: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.6 12.4 12.4 3.6" stroke="currentColor" stroke-width="1.5"/></svg>',
    reopen: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
  };
  function cancelButton(t) {
    var label = t.cancelled ? TEXT.reopenTask : TEXT.cancelTask;
    return '<button class="brief-icon-button" type="button" data-action="' + (t.cancelled ? "task-reopen" : "task-cancel-it") + '" data-line="' + t.line +
      '" title="' + label + '" aria-label="' + label + '">' + (t.cancelled ? ICON.reopen : ICON.cancel) + "</button>";
  }

  // Double click on the title: its text and priority, saved with the button or Enter, Esc drops it.
  function renderTaskForm(t) {
    return '<form class="brief-inline-edit" data-form="task-edit" data-line="' + t.line + '">' +
      '<label class="eis-visually-hidden" for="edit-task-' + t.line + '">' + TEXT.editTaskLabel + "</label>" +
      prioritySelect("edit-priority-" + t.line, t.priority, true) +
      '<input class="eis-input" id="edit-task-' + t.line + '" name="text" autocomplete="off" required value="' + esc(t.description) + '">' +
      '<button class="eis-button eis-button--sm eis-button--black" type="submit">' + TEXT.save + "</button></form>";
  }

  function renderNotes(t) {
    var items = t.notes.map(function (n) {
      var body = state.editNoteLine === n.line
        ? '<form class="brief-inline-edit" data-form="note-edit" data-line="' + n.line + '">' +
          '<label class="eis-visually-hidden" for="edit-note-' + n.line + '">' + TEXT.editNoteLabel + "</label>" +
          '<input class="eis-input" id="edit-note-' + n.line + '" name="note" autocomplete="off" required value="' + esc(n.text) + '">' +
          '<button class="eis-button eis-button--sm eis-button--black" type="submit">' + TEXT.save + "</button></form>"
        : '<p data-edit-note="' + n.line + '" title="' + TEXT.dblclick + '">' + MD.toHtml(n.text, links()) + "</p>";
      var chip = n.action ? '<span class="eis-chip eis-chip--sm ' + (n.action === "done" ? "eis-chip--success" : n.action === "failed" ? "brief-chip-failed" : "eis-chip--solid") +
        '">' + TEXT.action[n.action] + "</span> " : "";
      if (chip && state.editNoteLine !== n.line) body = body.replace(/^(<p[^>]*>)/, "$1" + chip);
      return '<li class="brief-note' + (n.action ? " brief-note--action" : "") + '">' +
        (n.date ? '<time class="eis-mono" datetime="' + n.date + '">' + F.shortDate(n.date) + "</time>" : "<span></span>") +
        "<div>" + body + "</div></li>";
    }).join("");
    var form = state.noteFormLine === t.line
      ? '<form class="brief-note-form" data-line="' + t.line + '">' +
        // Turns the comment into an action for tasks-act (the 🤖 mark); flipped in place, so typed text stays.
        (fmt().actionMark ? '<button class="brief-icon-button brief-action-toggle" type="button" data-action="note-ai" aria-pressed="false" title="' +
          esc(TEXT.actionToggle) + '" aria-label="' + esc(TEXT.actionToggle) + '"><span aria-hidden="true">🤖</span></button>' : "") +
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
    // Filters as the user types; only this page view, nothing is saved.
    el("search").addEventListener("input", function (e) { state.search = e.target.value; render(); });
    el("search").addEventListener("keydown", function (e) { if (e.key === "Escape") { e.target.value = ""; state.search = ""; render(); } });
    el("add-task-open").addEventListener("click", function () {
      closeForms(); state.addingTask = true; render();
      var input = el("add-task-text"); if (input) input.focus();
    });

    tasks.addEventListener("change", function (e) {
      if (!e.target.matches(".eis-checkbox")) return;
      commit(DM.setTaskDone(state.markdown, Number(e.target.dataset.line), e.target.checked, today, fmt()));
    });

    tasks.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.dataset.action, line = Number(btn.dataset.line);
      var focus = function (id) { var input = el(id); if (input) { input.focus(); if (input.select) input.select(); } };
      switch (action) {
        case "note-open": closeForms(); state.noteFormLine = line; render(); focus("note-" + line); break;
        case "task-open": closeForms(); state.addingTask = true; render(); focus("add-task-text"); break;
        case "task-cancel-it": edit(function () { return DM.setTaskCancelled(state.markdown, line, true, fmt()); }); break;
        case "task-reopen": edit(function () { return DM.setTaskCancelled(state.markdown, line, false, fmt()); }); break;
        case "note-ai": {
          var on = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", String(on));
          var input = btn.form.elements.note;
          input.placeholder = on ? TEXT.actionPlaceholder : TEXT.notePlaceholder;
          input.focus();
          break;
        }
        case "note-cancel": case "task-cancel": closeForms(); render(); break;
      }
    });

    // Double click opens the inline editor: task title (text and priority), comment, due date.
    tasks.addEventListener("dblclick", function (e) {
      var spot = e.target.closest("[data-edit-task], [data-edit-note], [data-edit-due]");
      if (!spot || e.target.closest("a, input, select, button")) return;
      var d = spot.dataset;
      closeForms();
      if (d.editTask !== undefined) state.editTaskLine = Number(d.editTask);
      if (d.editNote !== undefined) state.editNoteLine = Number(d.editNote);
      if (d.editDue !== undefined) state.editDueLine = Number(d.editDue);
      if (window.getSelection) window.getSelection().removeAllRanges(); // the double click selected a word
      render();
      var input = tasks.querySelector(".brief-inline-edit .eis-input, [data-due-input]");
      if (input) { input.focus(); if (input.type === "text") input.select(); }
    });

    tasks.addEventListener("keydown", function (e) {
      // Esc in a form or in the due input: drop it, nothing is written.
      if (e.key === "Escape" && (e.target.closest("form") || e.target.matches("[data-due-input]"))) { closeForms(); render(); return; }
      if (e.key === "Enter" && e.target.matches("[data-due-input]")) {
        e.preventDefault();
        var line = Number(e.target.dataset.line), value = e.target.value || null;
        edit(function () { return DM.editTask(state.markdown, line, { due: value }, fmt()); });
      }
    });

    tasks.addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      var v = function (name) { return form.elements[name] ? form.elements[name].value : ""; };
      var line = Number(form.dataset.line);
      if (form.id === "add-task") {
        if (!v("text").trim()) return;
        edit(function () {
          return DM.addTask(state.markdown, { text: v("text"), group: v("group"), priority: v("priority") || null, created: today, due: v("due") || null }, fmt());
        });
        return;
      }
      if (form.dataset.form === "task-edit") {
        if (!v("text").trim()) return;
        edit(function () { return DM.editTask(state.markdown, line, { text: v("text"), priority: v("priority") || null }, fmt()); });
        return;
      }
      if (!v("note").trim()) return;
      if (form.dataset.form === "note-edit") { edit(function () { return DM.editTaskNote(state.markdown, line, v("note"), fmt()); }); return; }
      var ai = form.querySelector('[data-action="note-ai"][aria-pressed="true"]') !== null;
      edit(function () { return DM.addTaskNote(state.markdown, line, today, v("note"), fmt(), ai); });
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
