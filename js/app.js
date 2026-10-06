/* ============================================================
   ZenTask · app.js
   State, routing, events, focus timer, reminders, import/export
   ============================================================ */
(function () {
  'use strict';

  var view = document.getElementById('view');
  var searchInput = document.getElementById('searchInput');
  var taskModal = document.getElementById('taskModal');
  var confirmModal = document.getElementById('confirmModal');
  var taskForm = document.getElementById('taskForm');
  var saveChip = document.getElementById('saveChip');

  /* ---------------- UI state ---------------- */
  var ui = {
    page: 'dashboard',
    tab: 'all',
    view: ZT.settings().defaultView || 'list',
    query: '',
    filters: { status: '', priority: '', category: '' },
    sort: 'due',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    focus: { mode: 'work', remaining: 0, running: false, endAt: 0, timer: null, cycles: 0 }
  };

  var LIST_PAGES = ['tasks', 'today', 'upcoming', 'completed'];
  var TASK_PAGES = LIST_PAGES.concat(['kanban', 'calendar']);
  var PRIO_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  var STATUS_ORDER = { todo: 0, inprogress: 1, review: 2, completed: 3 };

  var PAGE_SUB = {
    tasks: 'Every task in one calm place',
    today: 'Only what matters today',
    upcoming: 'What’s coming next',
    completed: 'Your finished work',
    kanban: 'Drag cards between columns to change status',
    calendar: 'Click any day to plan a task'
  };

  /* ---------------- focus timer defaults ---------------- */
  function modeMinutes(mode) {
    var p = ZT.settings().pomodoro;
    return (mode === 'work' ? p.work : mode === 'short' ? p.short : p.long) || 25;
  }
  ui.focus.remaining = modeMinutes('work') * 60;

  /* ---------------- filtering / sorting ---------------- */
  function tabFilter(tab, t) {
    var today = ZT.isoDate();
    if (tab === 'today') return t.status !== 'completed' && t.dueDate === today;
    if (tab === 'upcoming') return t.status !== 'completed' && t.dueDate && t.dueDate > today;
    if (tab === 'completed') return t.status === 'completed';
    if (tab === 'overdue') return t.status !== 'completed' && t.dueDate && t.dueDate < today;
    return true;
  }

  function searchMatch(t, q) {
    if (!q) return true;
    var cat = ZT.categoryOf(t);
    var hay = [
      t.title, t.description, t.notes, cat.name,
      t.tags.join(' '),
      t.subtasks.map(function (s) { return s.text; }).join(' '),
      t.status, t.priority
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function sortTasks(list) {
    var mode = ui.sort;
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (mode === 'title') return a.title.localeCompare(b.title);
      if (mode === 'created') return b.createdAt - a.createdAt;
      if (mode === 'priority') {
        return (PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]) || cmpDue(a, b);
      }
      if (mode === 'status') {
        return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || cmpDue(a, b);
      }
      return cmpDue(a, b) || (PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]);
    });
    return copy;
  }

  function cmpDue(a, b) {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  }

  function pageForTab(tab) {
    if (tab === 'today') return 'today';
    if (tab === 'upcoming') return 'upcoming';
    if (tab === 'completed') return 'completed';
    return 'tasks';
  }

  function effView() {
    if (ui.page === 'kanban') return 'kanban';
    if (ui.page === 'calendar') return 'calendar';
    return ui.view === 'kanban' || ui.view === 'calendar' ? ui.view : 'list';
  }

  function buildCtx() {
    var all = ZT.all();
    var q = ui.query.trim().toLowerCase();
    var tabCount = {
      all: all.length,
      today: all.filter(function (t) { return tabFilter('today', t); }).length,
      upcoming: all.filter(function (t) { return tabFilter('upcoming', t); }).length,
      completed: all.filter(function (t) { return tabFilter('completed', t); }).length,
      overdue: all.filter(function (t) { return tabFilter('overdue', t); }).length
    };

    var tasks = all.filter(function (t) { return tabFilter(ui.tab, t); })
      .filter(function (t) { return searchMatch(t, q); })
      .filter(function (t) {
        if (ui.filters.status && t.status !== ui.filters.status) return false;
        if (ui.filters.priority && t.priority !== ui.filters.priority) return false;
        if (ui.filters.category && t.category !== ui.filters.category) return false;
        return true;
      });
    tasks = sortTasks(tasks);

    var active = !!(q || ui.filters.status || ui.filters.priority || ui.filters.category);
    var count = tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + (active ? ' (filtered)' : '');
    var base = PAGE_SUB[ui.page] || '';
    var sub = base ? base + ' · ' + count : count;

    return {
      ui: ui,
      view: effView(),
      s: ZT.stats(),
      tasks: tasks,
      today: ZT.isoDate(),
      showTabs: LIST_PAGES.indexOf(ui.page) !== -1,
      pageTitle: pageTitle(),
      pageSub: sub,
      tabCount: tabCount,
      hasActiveFilters: active
    };
  }

  function pageTitle() {
    return {
      tasks: '✅ My Tasks',
      today: '🌞 Today',
      upcoming: '📆 Upcoming',
      completed: '🎉 Completed',
      kanban: '🗂️ Kanban',
      calendar: '📅 Calendar'
    }[ui.page] || 'My Tasks';
  }

  /* ---------------- render ---------------- */
  function render() {
    var ctx = buildCtx();
    var html;
    switch (ui.page) {
      case 'dashboard': html = Views.dashboard(ctx); break;
      case 'categories': html = Views.categories(ctx); break;
      case 'focus': html = Views.focus(ctx); break;
      case 'stats': html = Views.stats(ctx); break;
      case 'settings': html = Views.settings(ctx); break;
      default: html = Views.tasksPage(ctx);
    }
    view.innerHTML = html;
    updateChrome();
    if (ui.page === 'focus') updateFocusUI();
  }

  function updateChrome() {
    var active = ui.page;
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.page === active);
    });
    document.getElementById('streakDays').textContent = ZT.streak();
    document.getElementById('focusMins').textContent = ZT.focusTodayMinutes();
  }

  function navigate(page) {
    if (page === 'focus' || page === 'settings' || page === 'stats' || page === 'categories' || page === 'dashboard') {
      ui.page = page;
    } else if (LIST_PAGES.indexOf(page) !== -1) {
      ui.page = page;
      ui.tab = page === 'tasks' ? 'all' : page;
      ui.view = 'list';
    } else if (page === 'kanban' || page === 'calendar') {
      ui.page = page;
      ui.tab = 'all';
      ui.view = page;
    } else {
      ui.page = page;
    }
    document.body.classList.remove('nav-open');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- toasts / confirm ---------------- */
  function esc(s) { return Views.esc(s); }

  function toast(msg, type, ms) {
    var wrap = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<span>' + esc(msg) + '</span><button type="button" aria-label="Dismiss">✕</button>';
    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, ms || 3200);
  }

  var confirmYes = document.getElementById('confirmYes');
  var confirmNo = document.getElementById('confirmNo');

  function confirmDialog(title, msg, okLabel) {
    return new Promise(function (resolve) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMsg').textContent = msg;
      confirmYes.textContent = okLabel || 'Delete';
      confirmModal.hidden = false;

      function cleanup() {
        confirmModal.hidden = true;
        confirmYes.onclick = null;
        confirmNo.onclick = null;
        confirmModal.onclick = null;
        document.removeEventListener('keydown', onKey);
      }
      function onKey(e) { if (e.key === 'Escape') { cleanup(); resolve(false); } }
      confirmYes.onclick = function () { cleanup(); resolve(true); };
      confirmNo.onclick = function () { cleanup(); resolve(false); };
      confirmModal.onclick = function (e) { if (e.target === confirmModal) { cleanup(); resolve(false); } };
      document.addEventListener('keydown', onKey);
      confirmYes.focus();
    });
  }

  /* ---------------- task modal ---------------- */
  var modalSubtasks = [];

  function f(name) { return taskForm.elements.namedItem(name); }

  function populateCategories(selected) {
    var sel = document.getElementById('f-category');
    var cats = ZT.categories();
    sel.innerHTML = cats.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
    if (selected && cats.some(function (c) { return c.id === selected; })) sel.value = selected;
  }

  function renderSubtasks() {
    var box = document.getElementById('subtaskList');
    if (!modalSubtasks.length) {
      box.innerHTML = '<p class="muted small">No subtasks yet.</p>';
      return;
    }
    box.innerHTML = modalSubtasks.map(function (s, i) {
      return '<div class="sub-row' + (s.done ? ' done' : '') + '">' +
        '<label class="mini-check"><input type="checkbox" data-sub-toggle="' + i + '"' + (s.done ? ' checked' : '') + ' /><i></i></label>' +
        '<span>' + esc(s.text) + '</span>' +
        '<button type="button" class="icon-btn sm is-danger" data-sub-remove="' + i + '">✕</button>' +
        '</div>';
    }).join('');
  }

  function openModal(task, preset) {
    taskForm.reset();
    document.getElementById('titleErr').hidden = true;
    document.getElementById('newCatRow').hidden = true;
    modalSubtasks = task ? JSON.parse(JSON.stringify(task.subtasks || [])) : [];

    populateCategories(task ? task.category : (preset && preset.category) || '');

    f('id').value = task ? task.id : '';
    f('title').value = task ? task.title : '';
    f('description').value = task ? (task.description || '') : '';
    f('priority').value = task ? task.priority : (preset && preset.priority) || 'medium';
    f('status').value = task ? task.status : 'todo';
    f('dueDate').value = task ? (task.dueDate || '') : (preset && preset.dueDate) || '';
    f('reminder').value = task ? (task.reminder || '') : '';
    f('tags').value = task ? task.tags.join(', ') : '';
    f('notes').value = task ? (task.notes || '') : '';

    document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'New Task';
    document.getElementById('modalDelete').hidden = !task;
    renderSubtasks();

    taskModal.hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(function () { document.getElementById('f-title').focus(); }, 60);
  }

  function closeModal() {
    taskModal.hidden = true;
    document.body.classList.remove('no-scroll');
  }

  function addSubtaskFromInput() {
    var input = document.getElementById('subtaskInput');
    var text = input.value.trim();
    if (!text) return;
    modalSubtasks.push({ id: 'st-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: text, done: false });
    input.value = '';
    renderSubtasks();
    input.focus();
  }

  taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = f('title').value.trim();
    if (!title) {
      document.getElementById('titleErr').hidden = false;
      document.getElementById('f-title').focus();
      return;
    }

    var catId = f('category').value;
    if (catId === '__new') {
      var name = document.getElementById('f-newcat').value.trim();
      var color = document.getElementById('f-newcatcolor').value;
      if (name) catId = (ZT.addCategory(name, color) || {}).id;
      if (!catId) catId = ZT.categories()[0].id;
    }

    var data = {
      title: title,
      description: f('description').value.trim(),
      category: catId,
      priority: f('priority').value,
      status: f('status').value,
      dueDate: f('dueDate').value,
      reminder: f('reminder').value,
      tags: f('tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      notes: f('notes').value.trim(),
      subtasks: modalSubtasks.slice()
    };

    var id = f('id').value;
    if (id) {
      ZT.update(id, data);
      toast('✅ Task updated');
    } else {
      ZT.add(data);
      toast('🌿 Task created');
      if (data.reminder) askNotify();
    }
    closeModal();
    render();
  });

  /* ---------------- global click routing ---------------- */
  var lastDrag = 0;

  document.addEventListener('click', function (e) {
    var pageEl = e.target.closest('[data-page]');
    if (pageEl) { navigate(pageEl.dataset.page); return; }

    var el = e.target.closest('[data-action]');
    if (!el) return;

    /* a click right after a drag would open the task by accident */
    if (Date.now() - lastDrag < 250 && el.classList.contains('task-card')) return;

    var a = el.dataset.action;
    var id = el.dataset.id;

    switch (a) {
      case 'new-task':
        openModal(null, ui.page === 'today' ? { dueDate: ZT.isoDate() } : null);
        break;

      case 'edit':
        openModal(ZT.get(id));
        break;

      case 'toggle': {
        var t = ZT.toggle(id);
        toast(t.status === 'completed' ? '✅ Nice — completed!' : '↩️ Marked as todo');
        render();
        break;
      }

      case 'delete':
        confirmDialog('Delete task?', 'This task will be removed permanently.', 'Delete').then(function (ok) {
          if (!ok) return;
          ZT.remove(id);
          toast('🗑 Task deleted');
          render();
        });
        break;

      case 'delete-modal': {
        var mid = f('id').value;
        if (!mid) break;
        confirmDialog('Delete task?', 'This task will be removed permanently.', 'Delete').then(function (ok) {
          if (!ok) return;
          ZT.remove(mid);
          closeModal();
          toast('🗑 Task deleted');
          render();
        });
        break;
      }

      case 'duplicate':
        ZT.duplicate(id);
        toast('⧉ Task duplicated');
        render();
        break;

      case 'tab':
        ui.tab = el.dataset.tab;
        ui.page = pageForTab(ui.tab);
        render();
        break;

      case 'view': {
        var v = el.dataset.view;
        ui.view = v;
        if (v === 'kanban') ui.page = 'kanban';
        else if (v === 'calendar') ui.page = 'calendar';
        else ui.page = pageForTab(ui.tab);
        render();
        break;
      }

      case 'goto':
        navigate(el.dataset.goto);
        break;

      case 'clear-filters':
        ui.filters = { status: '', priority: '', category: '' };
        ui.query = '';
        searchInput.value = '';
        render();
        break;

      case 'cal-prev':
        ui.calMonth--;
        if (ui.calMonth < 0) { ui.calMonth = 11; ui.calYear--; }
        render();
        break;

      case 'cal-next':
        ui.calMonth++;
        if (ui.calMonth > 11) { ui.calMonth = 0; ui.calYear++; }
        render();
        break;

      case 'cal-today':
        ui.calYear = new Date().getFullYear();
        ui.calMonth = new Date().getMonth();
        render();
        break;

      case 'pick-date':
        openModal(null, { dueDate: el.dataset.date });
        break;

      case 'del-category':
        confirmDialog('Delete category?', 'Its tasks will move to your first category.', 'Delete').then(function (ok) {
          if (!ok) return;
          ZT.removeCategory(id);
          toast('🏷 Category removed');
          render();
        });
        break;

      /* ---------- data ---------- */
      case 'export': exportJSON(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'reset':
        confirmDialog('Reset everything?', 'All tasks, categories and statistics will be erased. Export a backup first!', 'Erase all')
          .then(function (ok) {
            if (!ok) return;
            ZT.reset();
            location.reload();
          });
        break;
      case 'seed-demo':
        confirmDialog('Load demo data?', 'Your current tasks will be replaced by the demo project.', 'Load demo')
          .then(function (ok) {
            if (!ok) return;
            ZT.reseed();
            toast('✨ Demo data loaded');
            render();
          });
        break;

      case 'notify-permission':
        askNotify(true);
        break;

      /* ---------- focus mode ---------- */
      case 'distraction':
        document.body.classList.toggle('zen');
        toast(document.body.classList.contains('zen') ? '⛶ Distraction-free on — Esc to exit' : 'Back to normal view');
        break;

      case 'focus-toggle':
        focusToggle();
        break;

      case 'focus-reset':
        focusStop();
        ui.focus.remaining = modeMinutes(ui.focus.mode) * 60;
        updateFocusUI();
        break;

      case 'focus-skip':
        focusStop();
        focusSetMode(ui.focus.mode === 'work' ? 'short' : 'work');
        updateFocusUI();
        break;

      case 'focus-mode':
        focusStop();
        focusSetMode(el.dataset.mode);
        updateFocusUI();
        break;
    }
  });

  /* form submit for categories */
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'categoryForm') return;
    e.preventDefault();
    var form = e.target;
    var name = form.elements.name.value.trim();
    var color = form.elements.color.value;
    if (!name) return;
    ZT.addCategory(name, color);
    form.reset();
    toast('🏷 Category added');
    render();
  });

  /* ---------------- change events ---------------- */
  document.addEventListener('change', function (e) {
    var el = e.target;

    if (el.dataset.filter) {
      ui.filters[el.dataset.filter] = el.value;
      render();
      return;
    }
    if (el.hasAttribute('data-sort')) {
      ui.sort = el.value;
      render();
      return;
    }
    if (el.dataset.setting) {
      var v = el.type === 'checkbox' ? el.checked : el.value;
      ZT.setSettings(makePatch(el.dataset.setting, v));
      if (el.dataset.setting === 'theme') applyTheme(v);
      toast('⚙ Setting saved');
      if (el.dataset.setting === 'defaultView') ui.view = v;
      return;
    }
    if (el.dataset.pomo) {
      var val = Math.min(120, Math.max(1, parseInt(el.value, 10) || 1));
      el.value = val;
      ZT.setSettings({ pomodoro: makePomodoro(el.dataset.pomo, val) });
      if (!ui.focus.running && ui.page === 'focus' && ui.focus.mode === el.dataset.pomo) {
        ui.focus.remaining = val * 60;
      }
      updateFocusUI();
      toast('⏱ Timer updated');
      return;
    }
    if (el.id === 'autoBreak') {
      ZT.setSettings({ autoStartBreak: el.checked });
      return;
    }
    if (el.dataset.subToggle !== undefined) {
      var idx = +el.dataset.subToggle;
      if (modalSubtasks[idx]) modalSubtasks[idx].done = el.checked;
      renderSubtasks();
    }
  });

  function makePatch(key, value) {
    var patch = {};
    patch[key] = value;
    return patch;
  }

  function makePomodoro(key, value) {
    var p = Object.assign({}, ZT.settings().pomodoro);
    p[key] = value;
    return p;
  }

  /* subtask row clicks */
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-sub-remove]');
    if (rm) {
      modalSubtasks.splice(+rm.dataset.subRemove, 1);
      renderSubtasks();
      return;
    }
    if (e.target.id === 'addSubtaskBtn') addSubtaskFromInput();
    if (e.target.id === 'newCatBtn') {
      var row = document.getElementById('newCatRow');
      row.hidden = !row.hidden;
      if (!row.hidden) document.getElementById('f-newcat').focus();
    }
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.getElementById('subtaskInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addSubtaskFromInput(); }
  });

  /* ---------------- search ---------------- */
  var searchTimer = null;
  searchInput.addEventListener('input', function () {
    ui.query = searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 120);
  });

  /* ---------------- filters / theme / misc controls ---------------- */
  document.getElementById('themeToggle').addEventListener('click', function () {
    var next = ZT.settings().theme === 'dark' ? 'light' : 'dark';
    ZT.setSettings({ theme: next });
    applyTheme(next);
  });

  document.getElementById('menuToggle').addEventListener('click', function () {
    document.body.classList.toggle('nav-open');
    document.getElementById('sidebarScrim').hidden = !document.body.classList.contains('nav-open');
  });

  document.getElementById('sidebarScrim').addEventListener('click', function () {
    document.body.classList.remove('nav-open');
    this.hidden = true;
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeToggle');
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  /* ---------------- modal closing ---------------- */
  taskModal.addEventListener('click', function (e) {
    if (e.target === taskModal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!taskModal.hidden) { closeModal(); return; }
      if (document.body.classList.contains('zen')) {
        document.body.classList.remove('zen');
        toast('Back to normal view');
        return;
      }
    }
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag);
    if (typing || !taskModal.hidden) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal(null); }
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
  });

  /* ---------------- drag & drop ---------------- */
  view.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.task-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });

  view.addEventListener('dragend', function (e) {
    var card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
    view.querySelectorAll('.kcol-body.over').forEach(function (c) { c.classList.remove('over'); });
    lastDrag = Date.now();
  });

  view.addEventListener('dragover', function (e) {
    var col = e.target.closest('[data-drop]');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('over');
  });

  view.addEventListener('dragleave', function (e) {
    var col = e.target.closest('[data-drop]');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('over');
  });

  view.addEventListener('drop', function (e) {
    var col = e.target.closest('[data-drop]');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('over');
    var id = e.dataTransfer.getData('text/plain');
    var status = col.dataset.drop;
    var task = ZT.get(id);
    if (!task || task.status === status) return;
    ZT.move(id, status);
    toast('🗂 Moved to ' + Views.STATUS[status].label);
    render();
  });

  /* ---------------- keyboard on cards ---------------- */
  view.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var card = e.target.closest('.task-card');
    if (card && e.target === card) openModal(ZT.get(card.dataset.id));
  });

  /* ---------------- reminders ---------------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function checkReminders() {
    var now = Date.now();
    ZT.all().forEach(function (t) {
      if (!t.reminder || t.status === 'completed' || t.remindedAt) return;
      var when = new Date(t.reminder).getTime();
      if (isNaN(when)) return;
      if (when <= now && now - when < 6 * 3600000) {
        ZT.update(t.id, { remindedAt: now });
        toast('🔔 Reminder: ' + t.title, 'warn', 7000);
        notify('ZenTask reminder', t.title);
      }
    });
  }

  function askNotify(force) {
    if (!('Notification' in window)) {
      if (force) toast('⚠ Notifications are not supported here', 'warn');
      return;
    }
    if (Notification.permission === 'granted') { toast('🔔 Notifications enabled'); return; }
    if (Notification.permission === 'denied') { toast('⚠ Notifications blocked by the browser', 'warn'); return; }
    Notification.requestPermission().then(function (p) {
      toast(p === 'granted' ? '🔔 Notifications enabled' : 'Notifications not enabled', p === 'granted' ? 'ok' : 'warn');
    });
  }

  function notify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: body });
    } catch (e) {}
  }

  /* ---------------- focus mode ---------------- */
  function focusTotalSec() { return modeMinutes(ui.focus.mode) * 60; }

  function focusToggle() {
    if (ui.focus.running) { focusStop(); updateFocusUI(); return; }
    ui.focus.running = true;
    ui.focus.endAt = Date.now() + ui.focus.remaining * 1000;
    ui.focus.timer = setInterval(focusTick, 250);
    updateFocusUI();
  }

  function focusStop() {
    if (ui.focus.timer) clearInterval(ui.focus.timer);
    ui.focus.timer = null;
    ui.focus.running = false;
  }

  function focusSetMode(mode) {
    ui.focus.mode = mode;
    ui.focus.remaining = modeMinutes(mode) * 60;
    document.querySelectorAll('[data-action="focus-mode"]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  function focusTick() {
    ui.focus.remaining = Math.max(0, (ui.focus.endAt - Date.now()) / 1000);
    if (ui.focus.remaining <= 0) focusComplete();
    updateFocusUI();
  }

  function focusComplete() {
    focusStop();
    var wasWork = ui.focus.mode === 'work';
    var p = ZT.settings().pomodoro;

    if (wasWork) {
      ZT.addFocusSession(modeMinutes('work'));
      chime();
      toast('✅ Focus session complete — stretch, breathe.', 'ok', 6000);
      ui.focus.cycles++;
      var next = (ui.focus.cycles % p.cycles === 0) ? 'long' : 'short';
      focusSetMode(next);
      if (ZT.settings().autoStartBreak) focusToggle();
    } else {
      chime();
      toast('🌿 Break is over — ready when you are.', 'ok', 6000);
      focusSetMode('work');
    }
    render();
    updateFocusUI();
  }

  function updateFocusUI() {
    var timeEl = document.getElementById('focusTime');
    if (!timeEl) return;

    var total = focusTotalSec();
    var remaining = ui.focus.remaining;
    timeEl.textContent = Views.fmtTime(Math.ceil(remaining));

    var sub = document.getElementById('focusSub');
    if (sub) {
      sub.textContent = ui.focus.mode === 'work' ? 'Focus session'
        : ui.focus.mode === 'short' ? 'Short break' : 'Long break';
    }

    var C = 339.292;
    var ring = document.getElementById('ringFg');
    if (ring) {
      ring.style.strokeDasharray = C;
      ring.style.strokeDashoffset = C * (total ? Math.max(0, Math.min(1, remaining / total)) : 1);
      ring.classList.toggle('on-break', ui.focus.mode !== 'work');
    }

    var btn = document.getElementById('focusToggle');
    if (btn) {
      btn.textContent = ui.focus.running ? '⏸ Pause'
        : (remaining < total && remaining > 0 ? '▶ Resume' : '▶ Start');
      btn.classList.toggle('is-running', ui.focus.running);
    }

    var dots = document.getElementById('cycleDots');
    if (dots) {
      var p = ZT.settings().pomodoro;
      var done = ui.focus.cycles % p.cycles;
      var html = '';
      for (var i = 0; i < p.cycles; i++) html += '<i class="' + (i < done ? 'on' : '') + '"></i>';
      html += '<span>' + done + '/' + p.cycles + ' cycles</span>';
      dots.innerHTML = html;
    }

    document.querySelectorAll('[data-action="focus-mode"]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === ui.focus.mode);
    });
  }

  function chime() {
    if (ZT.settings().sound === false) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      [660, 880].forEach(function (freq, i) {
        var start = ctx.currentTime + i * 0.2;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
        osc.start(start);
        osc.stop(start + 0.6);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1600);
    } catch (e) {}
  }

  /* ---------------- export / import ---------------- */
  function exportJSON() {
    try {
      var blob = new Blob([ZT.exportJSON()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'zentask-backup-' + ZT.isoDate() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('⬇️ Backup downloaded');
    } catch (e) {
      toast('⚠ Export failed: ' + e.message, 'warn');
    }
  }

  document.getElementById('importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        ZT.importJSON(String(reader.result));
        toast('⬆️ Backup restored');
        render();
      } catch (err) {
        toast('⚠ Import failed: ' + err.message, 'warn', 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ---------------- save indicator ---------------- */
  var flashTimer = null;
  window.addEventListener('zt:saved', function () {
    saveChip.textContent = '💾 Saved';
    saveChip.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { saveChip.classList.remove('flash'); }, 700);
  });
  window.addEventListener('zt:error', function () {
    saveChip.textContent = '⚠ Storage full';
    saveChip.classList.add('error');
  });

  /* ---------------- boot ---------------- */
  applyTheme(ZT.settings().theme);
  render();
  checkReminders();
  setInterval(checkReminders, 20000);

  /* keep "today" buckets fresh after midnight */
  setInterval(function () {
    var d = new Date();
    if (ui.calYear !== d.getFullYear() && ui.page === 'calendar') { ui.calYear = d.getFullYear(); ui.calMonth = d.getMonth(); }
    render();
  }, 60000);

  toast('🧘 Welcome to ZenTask — press N for a new task', 'ok', 4500);
})();
