/* ============================================================
   ZenTask · storage.js
   Data layer — localStorage persistence, CRUD, stats, backup
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'zentask:data:v1';
  var DAY = 86400000;

  /* ---------- helpers ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function isoOf(ts) { return isoDate(new Date(ts)); }
  function shiftISO(base, days) {
    var d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return isoDate(d);
  }

  var DEFAULT_SETTINGS = {
    theme: 'light',
    defaultView: 'list',
    userName: 'Zen',
    pomodoro: { work: 25, short: 5, long: 15, cycles: 4 },
    autoStartBreak: false
  };

  function blankState() {
    return {
      version: 1,
      tasks: [],
      categories: [
        { id: 'cat-work', name: 'Work', color: '#6366f1' },
        { id: 'cat-personal', name: 'Personal', color: '#f59e0b' },
        { id: 'cat-health', name: 'Health', color: '#10b981' },
        { id: 'cat-learning', name: 'Learning', color: '#ec4899' }
      ],
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      activity: [],
      focus: { sessions: [] }
    };
  }

  function makeTask(o) {
    var now = Date.now();
    var t = Object.assign({
      id: uid(),
      title: '',
      description: '',
      category: 'cat-work',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
      reminder: '',
      tags: [],
      subtasks: [],
      notes: '',
      order: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      remindedAt: null
    }, o || {});
    t.tags = Array.isArray(t.tags) ? t.tags : [];
    t.subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
    return t;
  }

  function sub(text, done) {
    return { id: uid(), text: text, done: !!done };
  }

  /* ---------- demo seed (only on very first visit) ---------- */
  function seedState() {
    var s = blankState();
    var t = isoDate();
    var tasks = [
      makeTask({
        title: 'Plan today’s top 3 priorities',
        description: 'Pick the three tasks that actually matter and block time for them.',
        category: 'cat-work', priority: 'high', status: 'inprogress', dueDate: t,
        tags: ['planning', 'deep-work'],
        subtasks: [sub('Write the list', true), sub('Block calendar', true), sub('Share with team', false)],
        notes: 'Keep it to 3 — everything else is noise.'
      }),
      makeTask({
        title: 'Design landing page hero',
        description: 'Three variations, mobile first.',
        category: 'cat-work', priority: 'urgent', status: 'review', dueDate: shiftISO(t, 1),
        tags: ['design', 'client'],
        subtasks: [sub('Desktop draft', true), sub('Mobile draft', true), sub('Handoff', false)]
      }),
      makeTask({
        title: '30 minutes morning walk',
        description: 'No phone. Just breathing.',
        category: 'cat-health', priority: 'medium', status: 'todo', dueDate: t,
        tags: ['habit']
      }),
      makeTask({
        title: 'Read “Deep Work” — chapter 3',
        category: 'cat-learning', priority: 'low', status: 'todo',
        dueDate: shiftISO(t, 2), tags: ['reading']
      }),
      makeTask({
        title: 'Pay electricity bill',
        description: 'Due date already passed — do this first.',
        category: 'cat-personal', priority: 'urgent', status: 'todo',
        dueDate: shiftISO(t, -1), tags: ['urgent-home']
      }),
      makeTask({
        title: 'Write release notes for v1.0',
        category: 'cat-work', priority: 'high', status: 'completed',
        dueDate: shiftISO(t, -1), completedAt: Date.now() - 6 * 3600000,
        tags: ['shipping']
      }),
      makeTask({
        title: 'Meditate 10 minutes',
        category: 'cat-health', priority: 'medium', status: 'completed',
        completedAt: Date.now() - 2 * 3600000, tags: ['habit', 'calm']
      }),
      makeTask({
        title: 'Team standup notes',
        category: 'cat-work', priority: 'low', status: 'todo',
        description: 'No due date — parked in the backlog.',
        tags: ['meeting']
      })
    ];
    tasks.forEach(function (task, i) { task.order = i; });
    s.tasks = tasks;

    /* a small streak history so Statistics / Streak aren't empty */
    for (var i = 0; i < 4; i++) s.activity.push(isoDate(new Date(Date.now() - i * DAY)));
    s.focus.sessions = [
      { id: uid(), date: isoDate(new Date(Date.now() - DAY)), minutes: 50, at: Date.now() - DAY },
      { id: uid(), date: isoDate(), minutes: 25, at: Date.now() - 3600000 }
    ];
    return s;
  }

  /* ---------- persistence ---------- */
  var state = null;

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      try { window.dispatchEvent(new CustomEvent('zt:saved')); } catch (e) {}
      return true;
    } catch (e) {
      console.warn('[ZenTask] could not save:', e);
      try { window.dispatchEvent(new CustomEvent('zt:error')); } catch (e2) {}
      return false;
    }
  }

  function normalize(s) {
    var base = blankState();
    s = s && typeof s === 'object' ? s : {};
    var out = base;
    out.version = 1;
    out.tasks = Array.isArray(s.tasks) ? s.tasks.map(function (t) { return makeTask(t); }) : [];
    out.categories = Array.isArray(s.categories) && s.categories.length ? s.categories : base.categories;
    out.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
    out.settings.pomodoro = Object.assign({}, DEFAULT_SETTINGS.pomodoro, (s.settings && s.settings.pomodoro) || {});
    out.activity = Array.isArray(s.activity) ? s.activity.slice() : [];
    out.focus = { sessions: Array.isArray(s.focus && s.focus.sessions) ? s.focus.sessions.slice() : [] };
    return out;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) { state = seedState(); persist(); return state; }
    try {
      state = normalize(JSON.parse(raw));
      return state;
    } catch (e) {
      console.warn('[ZenTask] corrupted data, reseeding:', e);
      state = seedState();
      persist();
      return state;
    }
  }

  load();

  /* ---------- derived values ---------- */
  function nextOrder() {
    var max = -1;
    state.tasks.forEach(function (t) { if (t.order > max) max = t.order; });
    return max + 1;
  }

  function markActivity(dateISO) {
    dateISO = dateISO || isoDate();
    if (state.activity.indexOf(dateISO) === -1) {
      state.activity.push(dateISO);
      state.activity = state.activity.slice(-400);
    }
  }

  /* ---------- tasks CRUD ---------- */
  function add(data) {
    var t = makeTask(Object.assign({}, data, { order: nextOrder() }));
    if (t.status === 'completed') { t.completedAt = Date.now(); markActivity(); }
    state.tasks.push(t);
    persist();
    return t;
  }

  function update(id, patch) {
    var t = get(id);
    if (!t) return null;
    var statusChanged = 'status' in patch && patch.status !== t.status;
    Object.assign(t, patch, { updatedAt: Date.now() });
    if (statusChanged) {
      if (t.status === 'completed') { t.completedAt = Date.now(); markActivity(); }
      else t.completedAt = null;
    }
    persist();
    return t;
  }

  function get(id) {
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i];
    return null;
  }

  function remove(id) {
    var i = state.tasks.findIndex(function (t) { return t.id === id; });
    if (i === -1) return false;
    state.tasks.splice(i, 1);
    persist();
    return true;
  }

  function toggle(id) {
    var t = get(id);
    if (!t) return null;
    if (t.status === 'completed') { t.status = 'todo'; t.completedAt = null; }
    else { t.status = 'completed'; t.completedAt = Date.now(); markActivity(); }
    t.updatedAt = Date.now();
    persist();
    return t;
  }

  function move(id, status) {
    return update(id, { status: status });
  }

  function clearCompleted() {
    state.tasks = state.tasks.filter(function (t) { return t.status !== 'completed'; });
    persist();
  }

  function duplicate(id) {
    var t = get(id);
    if (!t) return null;
    var copy = makeTask(Object.assign({}, JSON.parse(JSON.stringify(t)), {
      id: uid(),
      title: t.title + ' (copy)',
      status: 'todo',
      completedAt: null,
      remindedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: nextOrder()
    }));
    state.tasks.push(copy);
    persist();
    return copy;
  }

  /* ---------- categories ---------- */
  function addCategory(name, color) {
    name = String(name || '').trim();
    if (!name) return null;
    var exists = state.categories.find(function (c) { return c.name.toLowerCase() === name.toLowerCase(); });
    if (exists) return exists;
    var cat = { id: 'cat-' + uid(), name: name, color: color || '#6366f1' };
    state.categories.push(cat);
    persist();
    return cat;
  }

  function removeCategory(id) {
    if (state.categories.length <= 1) return false;
    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    var fallback = state.categories[0].id;
    state.tasks.forEach(function (t) { if (t.category === id) t.category = fallback; });
    persist();
    return true;
  }

  function categoryOf(task) {
    return state.categories.find(function (c) { return c.id === task.category; })
      || { id: '', name: 'None', color: '#94a3b8' };
  }

  /* ---------- settings ---------- */
  function setSettings(patch) {
    Object.assign(state.settings, patch || {});
    if (patch && patch.pomodoro) {
      state.settings.pomodoro = Object.assign({}, DEFAULT_SETTINGS.pomodoro, patch.pomodoro);
    }
    persist();
    return state.settings;
  }

  /* ---------- focus ---------- */
  function addFocusSession(minutes) {
    minutes = Math.max(1, Math.round(minutes || 0));
    state.focus.sessions.push({ id: uid(), date: isoDate(), minutes: minutes, at: Date.now() });
    markActivity();
    persist();
    return minutes;
  }

  function focusTodayMinutes() {
    var today = isoDate();
    return state.focus.sessions.reduce(function (sum, s) {
      return sum + (s.date === today ? (s.minutes || 0) : 0);
    }, 0);
  }

  function focusTotal() {
    return state.focus.sessions.reduce(function (sum, s) { return sum + (s.minutes || 0); }, 0);
  }

  /* ---------- streak ---------- */
  function streak() {
    var set = new Set(state.activity);
    var d = new Date();
    if (!set.has(isoDate(d))) d.setDate(d.getDate() - 1); // today still open → start from yesterday
    var s = 0;
    while (set.has(isoDate(d))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  /* ---------- statistics ---------- */
  function stats() {
    var tasks = state.tasks;
    var today = isoDate();
    var completed = tasks.filter(function (t) { return t.status === 'completed'; });
    var active = tasks.filter(function (t) { return t.status !== 'completed'; });
    var todayList = active.filter(function (t) { return t.dueDate === today; });
    var upcoming = active.filter(function (t) { return t.dueDate && t.dueDate > today; })
      .sort(byDue);
    var overdue = active.filter(function (t) { return t.dueDate && t.dueDate < today; })
      .sort(byDue);
    var noDate = active.filter(function (t) { return !t.dueDate; });

    var byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    active.forEach(function (t) { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; });

    var byStatus = { todo: 0, inprogress: 0, review: 0, completed: 0 };
    tasks.forEach(function (t) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    var byCategory = state.categories.map(function (c) {
      return {
        id: c.id, name: c.name, color: c.color,
        count: tasks.filter(function (t) { return t.category === c.id; }).length
      };
    }).sort(function (a, b) { return b.count - a.count; });

    /* last 14 days */
    var daily = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = isoDate(d);
      daily.push({
        date: key,
        label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        completed: completed.filter(function (t) { return t.completedAt && isoOf(t.completedAt) === key; }).length,
        focus: state.focus.sessions.reduce(function (sum, s) {
          return sum + (s.date === key ? (s.minutes || 0) : 0);
        }, 0),
        isToday: key === today
      });
    }

    var subTotal = 0, subDone = 0;
    tasks.forEach(function (t) {
      t.subtasks.forEach(function (s) { subTotal++; if (s.done) subDone++; });
    });

    var weekCompleted = completed.filter(function (t) {
      return t.completedAt && (Date.now() - t.completedAt) < 7 * DAY;
    }).length;

    return {
      total: tasks.length,
      active: active.length,
      completed: completed.length,
      todayList: todayList,
      upcoming: upcoming,
      overdue: overdue,
      noDate: noDate,
      progress: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
      byPriority: byPriority,
      byStatus: byStatus,
      byCategory: byCategory,
      daily: daily,
      streak: streak(),
      focusToday: focusTodayMinutes(),
      focusTotal: focusTotal(),
      focusSessions: state.focus.sessions.length,
      weekCompleted: weekCompleted,
      subtasks: { total: subTotal, done: subDone },
      avgPerDay: daily.length ? +(daily.reduce(function (s, d) { return s + d.completed; }, 0) / daily.length).toFixed(1) : 0
    };
  }

  function byDue(a, b) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  }

  /* ---------- backup ---------- */
  function exportJSON() {
    return JSON.stringify({ app: 'ZenTask', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
      throw new Error('Not a valid ZenTask backup file.');
    }
    state = normalize(data);
    persist();
    return true;
  }

  function reset() {
    state = blankState();
    persist();
  }

  function reseed() {
    state = seedState();
    persist();
  }

  /* ---------- public API ---------- */
  window.ZT = {
    all: function () { return state.tasks; },
    get: get,
    add: add,
    update: update,
    remove: remove,
    toggle: toggle,
    move: move,
    duplicate: duplicate,
    clearCompleted: clearCompleted,
    categories: function () { return state.categories; },
    categoryOf: categoryOf,
    addCategory: addCategory,
    removeCategory: removeCategory,
    settings: function () { return state.settings; },
    setSettings: setSettings,
    state: function () { return state; },
    markActivity: markActivity,
    addFocusSession: addFocusSession,
    focusTodayMinutes: focusTodayMinutes,
    streak: streak,
    stats: stats,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    reseed: reseed,
    isoDate: isoDate,
    shiftISO: shiftISO,
    DAY: DAY
  };
})();
