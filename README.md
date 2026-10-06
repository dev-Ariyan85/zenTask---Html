# 🧘 ZenTask

> **Calm productivity — one task at a time.**
> A complete, offline-first task manager built with **plain HTML, CSS and JavaScript** — no frameworks, no build step, no server.

---

## 📁 Project Structure

```
html/
├── index.html              # Entry point — sidebar, topbar, task modal, confirm dialog, toasts
├── README.md               # This file
│
├── css/
│   └── style.css           # All styling — design tokens, light/dark theme, components,
│                           #   kanban, calendar, focus ring, charts, responsive layout
│
└── js/
    ├── storage.js          # Data layer — localStorage, CRUD, categories, settings,
    │                       #   statistics, streak, focus sessions, export / import JSON
    ├── views.js            # Rendering — every page returns an HTML string
    │                       #   dashboard, tasks, kanban, calendar, categories,
    │                       #   focus, statistics, settings, task card, toolbar
    └── app.js              # App logic — routing, event delegation, search / filter / sort,
                            #   task modal, drag & drop, focus timer, reminders,
                            #   theme, backup, keyboard shortcuts
```

| File | Lines | Responsibility |
|------|------:|----------------|
| `index.html` | 200 | Static shell + modals |
| `css/style.css` | 688 | All visuals |
| `js/storage.js` | 484 | Data & persistence |
| `js/views.js` | 682 | Page templates |
| `js/app.js` | 945 | Behaviour & interactions |

Scripts load in order: `storage.js` → `views.js` → `app.js`.
`storage.js` exposes `window.ZT` (data API), `views.js` exposes `window.Views`.

---

## 🗂️ Menu

```
ZenTask
│
├── 📊  Dashboard      │  Today's · Upcoming · Completed · Overdue · Progress % · Productivity
├── ✅  My Tasks       │  All Tasks · Today · Upcoming · Completed · Overdue
├── 🌞  Today
├── 📆  Upcoming
├── 📅  Calendar       │  Month grid · click a day to plan · prev / next / today
├── 🗂️  Kanban         │  Todo → In Progress → Review → Completed  (drag & drop)
├── 🎉  Completed
├── 🏷️  Categories     │  Create / delete categories with colours
├── 🎯  Focus Mode     │  Pomodoro · distraction-free · cycle dots
├── 📈  Statistics     │  14-day chart · status · priority · category
└── ⚙️  Settings       │  Theme · default view · pomodoro · data management
```

---

## ✨ Features

### 1. Task model
Title · Description · Category · Priority · Status · Due date · Reminder · Tags · Subtasks (checkable) · Notes

### 2. Status flow
```
📥 Todo  →  🛠️ In Progress  →  🔎 Review  →  ✅ Completed
```

### 3. Priority
🔵 Low · 🟡 Medium · 🟠 High · 🔴 Urgent

### 4. Organization
- **Search** — title, description, notes, tags, category, subtasks (`/` to focus)
- **Filter** — status, priority, category
- **Sort** — due date, priority, newest, A→Z, status
- **Drag & Drop** — move cards between kanban columns

### 5. Views
📋 List · 🗂️ Kanban · 📅 Calendar

### 6. Zen features ⭐
| | Feature |
|---|---|
| 🎯 | Focus Mode with animated progress ring |
| ⏱️ | Pomodoro timer — focus / short / long break, cycles, chime |
| ⛶ | Distraction-free mode (hides chrome, `Esc` to exit) |
| 🔥 | Daily streak |
| 📈 | Productivity statistics |
| 🌙 | Dark mode |
| 🔔 | Gentle reminder — toast + desktop notification |

### 7. Data management
- `localStorage` persistence — everything survives reload
- Add / Edit / Delete · Complete / Undo
- **Export JSON** backup · **Import JSON** restore
- Reset all data · Load demo data

---

## 🚀 Run it

No build, no dependencies.

```bash
# option 1 — just open the file
open index.html          # macOS
xdg-open index.html      # Linux
# or double-click index.html

# option 2 — local server (identical result)
python3 -m http.server 8000
# → http://localhost:8000
```

> Google Fonts are loaded from the internet; offline the app falls back to system fonts and keeps working.

---

## ⌨️ Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New task |
| `/` | Focus search |
| `Esc` | Close modal / exit distraction-free |

---

## 🧪 Quality checks

Verified with headless Chrome (CDP) — **0 JavaScript errors**:

- **56 / 56** functional checks — all 11 pages, CRUD, edit, delete confirm, kanban drag & drop, search, filters, tabs, focus countdown, pomodoro persistence, dark mode, export/import round-trip, reload persistence
- **29 / 29** layout checks — mobile (375 px) with **0 px** horizontal overflow, off-canvas sidebar, kanban title wrapping, independent chart scaling, distraction-free toggle

---

## 🌐 Browser support

Modern Chrome / Edge / Firefox / Safari (CSS grid, `aspect-ratio`, `localStorage`, `CustomEvent`).
Mobile responsive: sidebar becomes an off-canvas drawer below 900 px.

---

*Made with plain HTML, CSS & JavaScript.* 🧘
