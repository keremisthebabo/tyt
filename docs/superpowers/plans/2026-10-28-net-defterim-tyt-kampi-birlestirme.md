# Net Defterim & TYT Kampı Birleştirme Uygulama Planı (TDD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development` to implement this plan task-by-task.

**Goal:** Merge `https://github.com/yusufkaya5482/net-defterim` and `TYT Kampı` into a single multi-user web & PWA application using the `Net Defterim` visual design system and `TYT Kampı`'s multi-user authentication & Supabase cloud sync.

**Architecture:** Modular ES Modules (`js/meb-topics.js`, `js/net-defterim-core.js`, `js/curriculum.js`, `js/scheduler.js`, `js/auth-storage.js`, `js/app.js`) + `Net Defterim` CSS (`css/net-defterim.css`) + `public/` brand assets.

---

### Task 1: MEB Maarif Topic Tree & Net Defterim Core Engine (`js/meb-topics.js` & `js/net-defterim-core.js`)
- **Files:**
  - Create: `js/meb-topics.js`
  - Create: `js/net-defterim-core.js`
  - Create: `tests/net-defterim-core.test.mjs`
- **Responsibilities:**
  - Export `mebTopics`, `mebGrades`, `subjects`, `topicOptions`, `topicList`, `topicMeta`, `normalizeTopic`.
  - Export `genitive` (Turkish possessive suffix), `initials`, `reviewIntervals` (`[1, 3, 7, 14, 30, 60]`), `scheduleReview`, `reviewStageLabel`, `dueQuestions`, `monthlyTopics`, `daysUntil`, `calculateExamNet`, `generateStudyNoteTemplate`.

### Task 2: Unified Multi-User Account & Cloud State (`js/auth-storage.js`)
- **Files:**
  - Modify: `js/auth-storage.js`
  - Modify: `tests/auth-storage.test.mjs`
- **Responsibilities:**
  - Extend `createDefaultUserState()` to include `profile`, `questions: []`, `exams: []`, `reports: {}`, `studyNotes: []` alongside `schoolConfig`, `fixedBlocks: []`, `sportConfig`, `tempoKey`, `progress`, `offDays`, `notes`, `alarm`.
  - Automatically sync the user's `name` during `registerUser` into `state.profile.name`.

### Task 3: Net Defterim Design Shell, Auth Welcome Screen & Unified 7-View Controller (`css/net-defterim.css`, `index.html`, `js/app.js`)
- **Files:**
  - Create: `css/net-defterim.css`
  - Modify: `index.html`
  - Modify: `js/app.js`
  - Modify: `sw.js`
  - Modify: `tests/app-integration.test.mjs`
- **Responsibilities:**
  - Apply the exact `Net Defterim` CSS variables, dark emerald sidebar (`#0f2b29`), dark slate workspace (`#1b1f23`), topbar, mobile bottom bar, and `.welcome-card` login/register screen.
  - Render all 7 views (`home`, `camp`, `archive`, `report`, `exams`, `notes`, `settings`), question upload dialog, question detail/review dialog, and the 4-step TYT & Sport onboarding wizard.
