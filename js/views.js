/* ============================================================
   ZenTask · views.js
   Pure render functions — every page returns an HTML string
   ============================================================ */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var PRIO = {
    low: { label: 'Low', icon: '🔵' },
    medium: { label: 'Medium', icon: '🟡' },
    high: { label: 'High', icon: '🟠' },
    urgent: { label: 'Urgent', icon: '🔴' }
  };

  var STATUS = {
    todo: { label: 'Todo', icon: '📥' },
    inprogress: { label: 'In Progress', icon: '🛠️' },
    review: { label: 'Review', icon: '🔎' },
    completed: { label: 'Completed', icon: '✅' }
  };

  function dueInfo(iso, today) {
    if (!iso) return null;
    if (iso === today) return { text: 'Today', cls: 'is-today' };
    if (iso === ZT.shiftISO(today, 1)) return { text: 'Tomorrow', cls: '' };
    if (iso === ZT.shiftISO(today, -1)) return { text: 'Yesterday', cls: 'is-past' };
    var d = new Date(iso + 'T00:00:00');
    var txt = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return { text: txt, cls: iso < today ? 'is-past' : '' };
  }

  function subProgress(t) {
    if (!t.subtasks.length) return '';
    var done = t.subtasks.filter(function (s) { return s.done; }).length;
    var pct = Math.round((done / t.subtasks.length) * 100);
    return (
      '<div class="subbar" title="' + done + ' of ' + t.subtasks.length + ' subtasks">' +
      '<span style="width:' + pct + '%"></span></div>'
    );
  }

  function emptyState(icon, title, sub, btnLabel, btnAction) {
    return (
      '<div class="empty">' +
      '<div class="empty-ico">' + icon + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(sub) + '</p>' +
      (btnLabel ? '<button class="btn primary" data-action="' + btnAction + '">' + esc(btnLabel) + '</button>' : '') +
      '</div>'
    );
  }

  /* ---------- task card ---------- */
  function taskCard(t, ctx) {
    var cat = ZT.categoryOf(t);
    var due = dueInfo(t.dueDate, ctx.today);
    var overdue = !!(t.dueDate && t.dueDate < ctx.today && t.status !== 'completed');
    var isDone = t.status === 'completed';
    var pr = PRIO[t.priority] || PRIO.medium;
    var st = STATUS[t.status] || STATUS.todo;

    var tags = t.tags.slice(0, 3).map(function (tag) {
      return '<span class="tag">#' + esc(tag) + '</span>';
    }).join('');
    if (t.tags.length > 3) tags += '<span class="tag more">+' + (t.tags.length - 3) + '</span>';

    return (
      '<article class="task-card' + (isDone ? ' is-done' : '') + (overdue ? ' is-overdue' : '') + '"' +
      ' data-id="' + t.id + '" data-action="edit" draggable="true" tabindex="0">' +

      '<button class="check' + (isDone ? ' on' : '') + '" data-action="toggle" data-id="' + t.id + '"' +
      ' aria-label="Toggle complete" type="button"><i></i></button>' +

      '<div class="task-body">' +
      '<div class="task-top">' +
      '<h4>' + esc(t.title) + '</h4>' +
      '<span class="prio prio-' + t.priority + '">' + pr.icon + ' ' + pr.label + '</span>' +
      '</div>' +

      (t.description ? '<p class="task-desc">' + esc(t.description) + '</p>' : '') +

      '<div class="task-meta">' +
      '<span class="meta"><i class="dot" style="background:' + esc(cat.color) + '"></i>' + esc(cat.name) + '</span>' +
      '<span class="meta chip st-' + t.status + '">' + st.icon + ' ' + st.label + '</span>' +
      (due ? '<span class="meta due ' + (overdue ? 'overdue' : due.cls) + '">📅 ' + esc(due.text) + '</span>' : '') +
      (t.reminder && !isDone ? '<span class="meta">🔔 ' + esc(t.reminder.replace('T', ' ')) + '</span>' : '') +
      (t.subtasks.length ? '<span class="meta">☑ ' + t.subtasks.filter(function (s) { return s.done; }).length + '/' + t.subtasks.length + '</span>' : '') +
      (t.notes ? '<span class="meta" title="Has notes">📝</span>' : '') +
      tags +
      '</div>' +
      subProgress(t) +
      '</div>' +

      '<div class="task-actions">' +
      '<button class="icon-btn sm" type="button" data-action="duplicate" data-id="' + t.id + '" title="Duplicate">⧉</button>' +
      '<button class="icon-btn sm" type="button" data-action="edit" data-id="' + t.id + '" title="Edit">✎</button>' +
      '<button class="icon-btn sm is-danger" type="button" data-action="delete" data-id="' + t.id + '" title="Delete">🗑</button>' +
      '</div>' +
      '</article>'
    );
  }

  function taskList(tasks, ctx) {
    if (!tasks.length) {
      return emptyState('🌿', 'All quiet here', 'No tasks match this view. Add one, or enjoy the calm.', '＋ New Task', 'new-task');
    }
    return '<div class="task-list">' + tasks.map(function (t) { return taskCard(t, ctx); }).join('') + '</div>';
  }

  /* ---------- kanban ---------- */
  function kanbanView(tasks, ctx) {
    var cols = ['todo', 'inprogress', 'review', 'completed'];
    var html = '<div class="kanban">';
    cols.forEach(function (key) {
      var list = tasks.filter(function (t) { return t.status === key; });
      var st = STATUS[key];
      html +=
        '<div class="kcol" data-status="' + key + '">' +
        '<div class="kcol-head"><span class="kdot st-' + key + '"></span><h4>' + st.icon + ' ' + st.label + '</h4>' +
        '<span class="kcount">' + list.length + '</span></div>' +
        '<div class="kcol-body" data-drop="' + key + '">' +
        (list.length
          ? list.map(function (t) { return taskCard(t, ctx); }).join('')
          : '<div class="kempty">Drop tasks here</div>') +
        '</div></div>';
    });
    return html + '</div>';
  }

  /* ---------- calendar ---------- */
  function calendarView(ctx) {
    var year = ctx.ui.calYear, month = ctx.ui.calMonth;
    var today = ctx.today;
    var first = new Date(year, month, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();

    var byDate = {};
    ctx.tasks.forEach(function (t) {
      if (!t.dueDate) return;
      (byDate[t.dueDate] = byDate[t.dueDate] || []).push(t);
    });

    var monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    var cells = [];

    for (var i = 0; i < 42; i++) {
      var dayNum, cellMonth = month, cellYear = year, other = false;
      if (i < startDow) {
        dayNum = prevDays - startDow + 1 + i; cellMonth = month - 1; other = true;
      } else if (i >= startDow + daysInMonth) {
        dayNum = i - (startDow + daysInMonth) + 1; cellMonth = month + 1; other = true;
      } else {
        dayNum = i - startDow + 1;
      }
      var dObj = new Date(cellYear, cellMonth, dayNum);
      var iso = ZT.isoDate(dObj);
      var dayTasks = byDate[iso] || [];
      var shown = dayTasks.slice(0, 3);

      cells.push(
        '<div class="cal-day' + (other ? ' is-other' : '') + (iso === today ? ' is-today' : '') + '"' +
        ' data-action="pick-date" data-date="' + iso + '">' +
        '<span class="dnum">' + dayNum + (iso === today ? '<em>Today</em>' : '') + '</span>' +
        '<div class="chips">' +
        shown.map(function (t) {
          var c = ZT.categoryOf(t);
          var short = t.title.length > 22 ? t.title.slice(0, 21) + '…' : t.title;
          return '<button class="chip-task' + (t.status === 'completed' ? ' done' : '') + '" type="button"' +
            ' data-action="edit" data-id="' + t.id + '" style="--c:' + esc(c.color) + '" title="' + esc(t.title) + '">' +
            '<i></i>' + esc(short) + '</button>';
        }).join('') +
        (dayTasks.length > 3 ? '<span class="more-n">+' + (dayTasks.length - 3) + ' more</span>' : '') +
        '</div></div>'
      );
    }

    return (
      '<div class="calendar">' +
      '<div class="cal-head">' +
      '<div class="cal-nav">' +
      '<button class="icon-btn" type="button" data-action="cal-prev" title="Previous month">‹</button>' +
      '<strong>' + monthName + '</strong>' +
      '<button class="icon-btn" type="button" data-action="cal-next" title="Next month">›</button>' +
      '</div>' +
      '<div class="cal-right">' +
      '<span class="muted">' + ctx.tasks.filter(function (t) { return t.dueDate; }).length + ' scheduled</span>' +
      '<button class="btn ghost sm" type="button" data-action="cal-today">Today</button>' +
      '</div></div>' +
      '<div class="cal-grid weekdays">' +
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) { return '<span>' + d + '</span>'; }).join('') +
      '</div>' +
      '<div class="cal-grid">' + cells.join('') + '</div>' +
      '</div>'
    );
  }

  /* ---------- toolbar ---------- */
  var TABS = [
    ['all', 'All Tasks'],
    ['today', 'Today'],
    ['upcoming', 'Upcoming'],
    ['completed', 'Completed'],
    ['overdue', 'Overdue']
  ];

  function toolbar(ctx) {
    var f = ctx.ui.filters;
    var cats = ZT.categories();

    var tabs = '';
    if (ctx.showTabs) {
      tabs = '<div class="seg tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" class="' + (ctx.ui.tab === t[0] ? 'active' : '') + '"' +
          ' data-action="tab" data-tab="' + t[0] + '">' + t[1] +
          (ctx.tabCount && ctx.tabCount[t[0]] != null ? '<em>' + ctx.tabCount[t[0]] + '</em>' : '') +
          '</button>';
      }).join('') + '</div>';
    }

    return (
      '<div class="toolbar">' +
      tabs +
      '<div class="toolbar-right">' +
      '<select class="mini-select" data-filter="status" title="Filter by status">' +
      '<option value="">Status: All</option>' +
      Object.keys(STATUS).map(function (k) {
        return '<option value="' + k + '"' + (f.status === k ? ' selected' : '') + '>' + STATUS[k].label + '</option>';
      }).join('') +
      '</select>' +

      '<select class="mini-select" data-filter="priority" title="Filter by priority">' +
      '<option value="">Priority: All</option>' +
      Object.keys(PRIO).map(function (k) {
        return '<option value="' + k + '"' + (f.priority === k ? ' selected' : '') + '>' + PRIO[k].label + '</option>';
      }).join('') +
      '</select>' +

      '<select class="mini-select" data-filter="category" title="Filter by category">' +
      '<option value="">Category: All</option>' +
      cats.map(function (c) {
        return '<option value="' + c.id + '"' + (f.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') +
      '</select>' +

      '<select class="mini-select" data-sort title="Sort">' +
      '<option value="due"' + (ctx.ui.sort === 'due' ? ' selected' : '') + '>Sort: Due date</option>' +
      '<option value="priority"' + (ctx.ui.sort === 'priority' ? ' selected' : '') + '>Sort: Priority</option>' +
      '<option value="created"' + (ctx.ui.sort === 'created' ? ' selected' : '') + '>Sort: Newest</option>' +
      '<option value="title"' + (ctx.ui.sort === 'title' ? ' selected' : '') + '>Sort: A → Z</option>' +
      '<option value="status"' + (ctx.ui.sort === 'status' ? ' selected' : '') + '>Sort: Status</option>' +
      '</select>' +

      (ctx.hasActiveFilters ? '<button class="btn ghost sm" type="button" data-action="clear-filters">✕ Clear</button>' : '') +

      '<div class="seg view-switch">' +
      [['list', '📋', 'List'], ['kanban', '🗂️', 'Kanban'], ['calendar', '📅', 'Calendar']].map(function (v) {
        return '<button type="button" class="' + (ctx.view === v[0] ? 'active' : '') + '"' +
          ' data-action="view" data-view="' + v[0] + '" title="' + v[2] + '">' + v[1] + '</button>';
      }).join('') +
      '</div>' +
      '</div></div>'
    );
  }

  /* ---------- DASHBOARD ---------- */
  function dashboard(ctx) {
    var s = ctx.s;
    var hour = new Date().getHours();
    var greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    var week = s.daily.slice(-7);
    var maxWeek = Math.max(1, week.reduce(function (m, d) { return Math.max(m, d.completed); }, 0));

    var stat = function (cls, ico, label, value, note) {
      return '<div class="stat-card ' + cls + '">' +
        '<div class="stat-ico">' + ico + '</div>' +
        '<div class="stat-body"><span>' + label + '</span><strong>' + value + '</strong><em>' + note + '</em></div>' +
        '</div>';
    };

    var todayTasks = s.todayList;
    var upcoming = s.upcoming.slice(0, 4);
    var overdue = s.overdue.slice(0, 4);

    return (
      '<section class="page">' +
      '<div class="page-head">' +
      '<div><h1>' + greet + ', ' + esc(ZT.settings().userName || 'Zen') + ' 🧘</h1>' +
      '<p class="sub">' + dateStr + ' · Breathe. Focus. Ship.</p></div>' +
      '<button class="btn primary" type="button" data-action="new-task">＋ New Task</button>' +
      '</div>' +

      '<div class="stat-grid">' +
      stat('c-blue', '🌞', "Today's Tasks", todayTasks.length, s.byStatus.todo + ' todo overall') +
      stat('c-violet', '📆', 'Upcoming', s.upcoming.length, upcoming.length ? 'next: ' + esc(upcoming[0].dueDate) : 'nothing scheduled') +
      stat('c-green', '✅', 'Completed', s.completed, s.weekCompleted + ' in last 7 days') +
      stat('c-red', '⚠️', 'Overdue', s.overdue.length, s.overdue.length ? 'needs attention' : 'all clear') +
      '<div class="stat-card c-amber wide">' +
      '<div class="stat-ico">🎯</div>' +
      '<div class="stat-body"><span>Progress</span><strong>' + s.progress + '%</strong>' +
      '<div class="mini-bar"><i style="width:' + s.progress + '%"></i></div>' +
      '<em>' + s.completed + ' of ' + s.total + ' tasks done</em></div>' +
      '</div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-head"><h3>📈 Productivity Overview</h3><span class="muted">last 7 days</span></div>' +
      '<div class="bars">' +
      week.map(function (d) {
        var h = Math.round((d.completed / maxWeek) * 100);
        return '<div class="bar' + (d.isToday ? ' is-today' : '') + '">' +
          '<em>' + d.completed + '</em>' +
          '<div class="bar-track"><span style="height:' + (d.completed ? Math.max(h, 8) : 4) + '%"></span></div>' +
          '<b>' + d.label + '</b></div>';
      }).join('') +
      '</div>' +
      '<div class="kpi-row">' +
      '<span><b>' + s.weekCompleted + '</b> done this week</span>' +
      '<span><b>' + s.avgPerDay + '</b> avg / day</span>' +
      '<span><b>' + s.subtasks.done + '/' + s.subtasks.total + '</b> subtasks</span>' +
      '</div>' +
      '</div>' +

      '<div class="card focus-mini">' +
      '<div class="card-head"><h3>🔥 Focus & Streak</h3></div>' +
      '<div class="focus-mini-grid">' +
      '<div><strong class="big">' + s.streak + '</strong><span>day streak</span></div>' +
      '<div><strong class="big">' + s.focusToday + '</strong><span>min today</span></div>' +
      '<div><strong class="big">' + s.focusSessions + '</strong><span>sessions</span></div>' +
      '</div>' +
      '<p class="muted small">Focus time builds momentum. One Pomodoro is enough to start.</p>' +
      '<button class="btn soft full" type="button" data-page="focus">🎯 Start Focus Session</button>' +
      '</div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-head"><h3>🌞 Today’s Tasks</h3>' +
      '<button class="link-btn" type="button" data-action="goto" data-goto="today">See all →</button></div>' +
      (todayTasks.length
        ? '<div class="task-list compact">' + todayTasks.slice(0, 5).map(function (t) { return taskCard(t, ctx); }).join('') + '</div>'
        : emptyState('🍵', 'Nothing due today', 'Add a task or enjoy the empty space.', '＋ New Task', 'new-task')) +
      '</div>' +

      '<div class="col-stack">' +
      '<div class="card">' +
      '<div class="card-head"><h3>⚠️ Overdue</h3><span class="count-badge danger">' + s.overdue.length + '</span></div>' +
      (overdue.length
        ? '<div class="task-list compact">' + overdue.map(function (t) { return taskCard(t, ctx); }).join('') + '</div>'
        : '<p class="muted">Nothing overdue. Beautiful. 🌤️</p>') +
      '</div>' +
      '<div class="card">' +
      '<div class="card-head"><h3>📆 Upcoming</h3><span class="count-badge">' + s.upcoming.length + '</span></div>' +
      (upcoming.length
        ? '<div class="task-list compact">' + upcoming.map(function (t) { return taskCard(t, ctx); }).join('') + '</div>'
        : '<p class="muted">No scheduled tasks yet.</p>') +
      '</div>' +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  /* ---------- TASK PAGES (My Tasks / Today / Upcoming / Completed / Kanban / Calendar) ---------- */
  function tasksPage(ctx) {
    var count = ctx.tasks.length;
    var body;

    if (ctx.view === 'kanban') body = kanbanView(ctx.tasks, ctx);
    else if (ctx.view === 'calendar') body = calendarView(ctx);
    else body = taskList(ctx.tasks, ctx);

    return (
      '<section class="page">' +
      '<div class="page-head">' +
      '<div><h1>' + esc(ctx.pageTitle) + '</h1>' +
      '<p class="sub">' + (ctx.pageSub || count + ' task' + (count === 1 ? '' : 's')) + '</p></div>' +
      '<button class="btn primary" type="button" data-action="new-task">＋ New Task</button>' +
      '</div>' +
      toolbar(ctx) +
      '<div class="content">' + body + '</div>' +
      '</section>'
    );
  }

  /* ---------- CATEGORIES ---------- */
  function categories(ctx) {
    var cats = ZT.categories();
    var stats = ZT.stats().byCategory;

    return (
      '<section class="page">' +
      '<div class="page-head">' +
      '<div><h1>🏷️ Categories</h1><p class="sub">Keep your world tidy — ' + cats.length + ' categories</p></div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-head"><h3>Create category</h3></div>' +
      '<form id="categoryForm" class="cat-form">' +
      '<input name="name" placeholder="Category name" maxlength="24" required />' +
      '<input name="color" type="color" value="#6366f1" title="Colour" />' +
      '<button class="btn primary" type="submit">Add</button>' +
      '</form>' +
      '<p class="muted small">Categories appear in the task form, filters and statistics.</p>' +
      '</div>' +

      '<div class="cat-grid">' +
      cats.map(function (c) {
        var info = stats.find(function (x) { return x.id === c.id; }) || { count: 0 };
        var active = info.count;
        return '<div class="cat-card" style="--c:' + esc(c.color) + '">' +
          '<div class="cat-top"><i></i><h4>' + esc(c.name) + '</h4>' +
          '<button class="icon-btn sm is-danger" type="button" data-action="del-category" data-id="' + c.id + '" title="Delete">🗑</button></div>' +
          '<div class="cat-count"><strong>' + active + '</strong><span>task' + (active === 1 ? '' : 's') + '</span></div>' +
          '<div class="cat-bar"><i style="width:' + (ctx.s.total ? Math.round((active / ctx.s.total) * 100) : 0) + '%"></i></div>' +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  /* ---------- FOCUS MODE ---------- */
  function focus(ctx) {
    var p = ZT.settings().pomodoro;
    var s = ctx.s;

    return (
      '<section class="page">' +
      '<div class="page-head">' +
      '<div><h1>🎯 Focus Mode</h1><p class="sub">One task. One breath. One timer.</p></div>' +
      '<button class="btn ghost" type="button" data-action="distraction">⛶ Distraction-Free</button>' +
      '</div>' +

      '<div class="focus-wrap">' +
      '<div class="card focus-card" id="focusCard">' +
      '<div class="seg focus-modes">' +
      '<button type="button" class="active" data-action="focus-mode" data-mode="work">🎧 Focus</button>' +
      '<button type="button" data-action="focus-mode" data-mode="short">☕ Short Break</button>' +
      '<button type="button" data-action="focus-mode" data-mode="long">🌿 Long Break</button>' +
      '</div>' +

      '<div class="ring-wrap">' +
      '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="ring-bg" cx="60" cy="60" r="54"></circle>' +
      '<circle class="ring-fg" id="ringFg" cx="60" cy="60" r="54"></circle>' +
      '</svg>' +
      '<div class="ring-center">' +
      '<div class="time" id="focusTime">' + fmtTime(ctx.ui.focus.remaining) + '</div>' +
      '<div class="time-sub" id="focusSub">Focus session</div>' +
      '</div></div>' +

      '<div class="focus-controls">' +
      '<button class="icon-btn lg" type="button" data-action="focus-reset" title="Reset">↺</button>' +
      '<button class="btn primary xl" type="button" data-action="focus-toggle" id="focusToggle">▶ Start</button>' +
      '<button class="icon-btn lg" type="button" data-action="focus-skip" title="Skip to next">⏭</button>' +
      '</div>' +

      '<div class="cycles" id="cycleDots"></div>' +
      '</div>' +

      '<div class="focus-side">' +
      '<div class="card">' +
      '<div class="card-head"><h3>Today</h3></div>' +
      '<div class="focus-mini-grid">' +
      '<div><strong class="big">' + s.focusToday + '</strong><span>minutes</span></div>' +
      '<div><strong class="big">' + s.focusSessions + '</strong><span>sessions</span></div>' +
      '<div><strong class="big">' + s.streak + '</strong><span>day streak</span></div>' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>⏱️ Timer settings</h3></div>' +
      '<div class="pomo-grid">' +
      pomoInput('work', 'Focus (min)', p.work) +
      pomoInput('short', 'Short break', p.short) +
      pomoInput('long', 'Long break', p.long) +
      pomoInput('cycles', 'Cycles', p.cycles) +
      '</div>' +
      '<label class="switch-row"><input type="checkbox" id="autoBreak"' + (ZT.settings().autoStartBreak ? ' checked' : '') + ' />' +
      '<span>Auto-start breaks</span></label>' +
      '<p class="muted small">Changes save instantly to localStorage.</p>' +
      '</div>' +

      '<div class="card tip-card">' +
      '<h3>🧘 Zen tip</h3>' +
      '<p>Close everything but one tab. Set the timer. When your mind wanders, gently bring it back — that rep <em>is</em> the workout.</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  function pomoInput(key, label, value) {
    return '<div class="field"><label>' + label + '</label>' +
      '<input type="number" min="1" max="120" value="' + value + '" data-pomo="' + key + '" /></div>';
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  /* ---------- STATISTICS ---------- */
  function statsPage(ctx) {
    var s = ctx.s;
    var maxDone = Math.max(1, s.daily.reduce(function (m, d) { return Math.max(m, d.completed); }, 0));
    var maxFocus = Math.max(1, s.daily.reduce(function (m, d) { return Math.max(m, d.focus); }, 0));
    var statusMax = Math.max(1, Object.keys(s.byStatus).reduce(function (m, k) { return Math.max(m, s.byStatus[k]); }, 0));
    var prioMax = Math.max(1, Object.keys(s.byPriority).reduce(function (m, k) { return Math.max(m, s.byPriority[k]); }, 0));
    var catMax = Math.max(1, s.byCategory.reduce(function (m, c) { return Math.max(m, c.count); }, 0));

    var kpi = function (ico, label, value, note, cls) {
      return '<div class="stat-card ' + (cls || '') + '"><div class="stat-ico">' + ico + '</div>' +
        '<div class="stat-body"><span>' + label + '</span><strong>' + value + '</strong><em>' + note + '</em></div></div>';
    };

    var hbar = function (label, value, max, color, extra) {
      var pct = Math.round((value / max) * 100);
      return '<div class="hbar"><div class="hbar-top"><span>' + label + '</span><b>' + (extra || value) + '</b></div>' +
        '<div class="hbar-track"><i style="width:' + pct + '%;background:' + color + '"></i></div></div>';
    };

    return (
      '<section class="page">' +
      '<div class="page-head"><div><h1>📈 Statistics</h1>' +
      '<p class="sub">Your productivity, without the pressure.</p></div></div>' +

      '<div class="stat-grid">' +
      kpi('✅', 'Completion rate', s.progress + '%', s.completed + '/' + s.total + ' tasks') +
      kpi('🔥', 'Current streak', s.streak + 'd', 'consecutive days') +
      kpi('⏱️', 'Focus time', s.focusTotal + 'm', 'all time') +
      kpi('📊', 'Avg / day', s.avgPerDay, 'tasks completed') +
      kpi('☑️', 'Subtasks', s.subtasks.done + '/' + s.subtasks.total, 'checked off') +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>📅 Last 14 days</h3>' +
      '<span class="legend"><i class="lg-indigo"></i>Completed <i class="lg-teal"></i>Focus min</span></div>' +
      '<div class="chart14">' +
      s.daily.map(function (d) {
        var h1 = d.completed ? Math.max(8, Math.round((d.completed / maxDone) * 100)) : 4;
        var h2 = d.focus ? Math.max(8, Math.round((d.focus / maxFocus) * 100)) : 4;
        return '<div class="col' + (d.isToday ? ' is-today' : '') + '" title="' + d.date + ': ' + d.completed + ' done · ' + d.focus + ' min focus">' +
          '<div class="gbars"><span class="g1" style="height:' + h1 + '%"></span>' +
          '<span class="g2" style="height:' + h2 + '%"></span></div>' +
          '<b>' + d.date.slice(8) + '</b></div>';
      }).join('') +
      '</div></div>' +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-head"><h3>🗂️ Status breakdown</h3></div>' +
      Object.keys(s.byStatus).map(function (k) {
        return hbar(STATUS[k].icon + ' ' + STATUS[k].label, s.byStatus[k], statusMax,
          k === 'completed' ? 'var(--ok)' : k === 'review' ? 'var(--warn)' : k === 'inprogress' ? 'var(--primary)' : 'var(--muted)');
      }).join('') +
      '</div>' +

      '<div class="card"><div class="card-head"><h3>🔥 Priority load (active)</h3></div>' +
      Object.keys(s.byPriority).map(function (k) {
        return hbar(PRIO[k].icon + ' ' + PRIO[k].label, s.byPriority[k], prioMax,
          k === 'urgent' ? 'var(--danger)' : k === 'high' ? '#f97316' : k === 'medium' ? 'var(--warn)' : '#38bdf8');
      }).join('') +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>🏷️ By category</h3><span class="muted">' + s.total + ' tasks total</span></div>' +
      '<div class="hbars">' +
      s.byCategory.map(function (c) {
        return hbar('<i class="dot" style="background:' + esc(c.color) + '"></i>' + esc(c.name), c.count, catMax, esc(c.color));
      }).join('') +
      '</div></div>' +
      '</section>'
    );
  }

  /* ---------- SETTINGS ---------- */
  function settings(ctx) {
    var st = ZT.settings();
    var p = st.pomodoro;

    return (
      '<section class="page">' +
      '<div class="page-head"><div><h1>⚙️ Settings</h1>' +
      '<p class="sub">Everything is stored locally in your browser.</p></div></div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-head"><h3>🌙 Appearance</h3></div>' +
      '<div class="field"><label>Theme</label>' +
      '<select data-setting="theme">' +
      '<option value="light"' + (st.theme === 'light' ? ' selected' : '') + '>Light 🌤️</option>' +
      '<option value="dark"' + (st.theme === 'dark' ? ' selected' : '') + '>Dark 🌙</option>' +
      '</select></div>' +
      '<div class="field"><label>Default task view</label>' +
      '<select data-setting="defaultView">' +
      ['list', 'kanban', 'calendar'].map(function (v) {
        return '<option value="' + v + '"' + (st.defaultView === v ? ' selected' : '') + '>' +
          v.charAt(0).toUpperCase() + v.slice(1) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field"><label>Your name (dashboard greeting)</label>' +
      '<input data-setting="userName" value="' + esc(st.userName || '') + '" maxlength="20" /></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>🔔 Reminders</h3></div>' +
      '<p class="muted small">ZenTask checks due reminders while the app is open and shows a gentle toast + desktop notification.</p>' +
      '<button class="btn soft" type="button" data-action="notify-permission">Enable desktop notifications</button>' +
      '<div class="field" style="margin-top:14px"><label>Sound cue when a session ends</label>' +
      '<label class="switch-row"><input type="checkbox" data-setting="sound"' + (st.sound !== false ? ' checked' : '') + ' /><span>Play a soft chime 🔔</span></label>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>⏱️ Pomodoro defaults</h3></div>' +
      '<div class="pomo-grid">' +
      ['work', 'short', 'long', 'cycles'].map(function (k) {
        var labels = { work: 'Focus (min)', short: 'Short break (min)', long: 'Long break (min)', cycles: 'Cycles' };
        return '<div class="field"><label>' + labels[k] + '</label>' +
          '<input type="number" min="1" max="120" value="' + p[k] + '" data-pomo="' + k + '" /></div>';
      }).join('') +
      '</div></div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>💾 Data management</h3>' +
      '<span class="muted">' + ZT.stats().total + ' tasks stored</span></div>' +
      '<div class="btn-row">' +
      '<button class="btn soft" type="button" data-action="export">⬇️ Export JSON</button>' +
      '<button class="btn soft" type="button" data-action="import">⬆️ Import JSON</button>' +
      '<button class="btn ghost" type="button" data-action="seed-demo">✨ Load demo data</button>' +
      '<button class="btn danger" type="button" data-action="reset">🗑 Reset everything</button>' +
      '</div>' +
      '<p class="muted small">Export before clearing your browser data — ZenTask has no server, your tasks never leave this device.</p>' +
      '</div>' +

      '<div class="card about">' +
      '<div class="card-head"><h3>🧘 About</h3></div>' +
      '<p><strong>ZenTask</strong> · built with plain HTML, CSS &amp; JavaScript.</p>' +
      '<ul class="about-list">' +
      '<li>📋 List · 🗂️ Kanban · 📅 Calendar views</li>' +
      '<li>🎯 Focus Mode with Pomodoro, streaks &amp; statistics</li>' +
      '<li>💾 localStorage persistence with JSON export / import</li>' +
      '<li>🌙 Dark mode, search, filters, sorting &amp; drag &amp; drop</li>' +
      '</ul>' +
      '<p class="muted small">Shortcuts: <kbd>N</kbd> new task · <kbd>/</kbd> search · <kbd>Esc</kbd> close</p>' +
      '</div>' +
      '</section>'
    );
  }

  window.Views = {
    dashboard: dashboard,
    tasksPage: tasksPage,
    categories: categories,
    focus: focus,
    stats: statsPage,
    settings: settings,
    taskCard: taskCard,
    emptyState: emptyState,
    fmtTime: fmtTime,
    esc: esc,
    PRIO: PRIO,
    STATUS: STATUS
  };
})();
