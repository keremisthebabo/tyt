# Kişiye Özel Çok Kullanıcılı Maarif TYT & Spor Kamp Uygulaması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut tek kişilik `index.html` dosyasını; herkesin kendi hesabını açabildiği, kendi sabit saatlerini ve spor programını elle girebildiği ve seçtiği çalışma yoğunluğuna (Rahat 22 Hafta / Dengeli 16 Hafta / Sıkışık 12 Hafta) göre çakışmasız Maarif TYT + Spor birleşik programının otomatik üretildiği çok kullanıcılı bir web ve PWA uygulamasına dönüştürmek.

**Architecture:** Uygulama, derleme (build) adımı gerektirmeyen modüler ES JavaScript (`js/curriculum.js`, `js/scheduler.js`, `js/auth-storage.js`, `js/app.js`), PWA katmanı (`manifest.json`, `sw.js`) ve Supabase PostgreSQL/Auth şeması (`sql/supabase_schema.sql`) üzerine inşa edilir. Veri katmanı hibrit çalışır: Supabase bilgileri tanımlandığında bulut veritabanıyla senkronize olur, tanımlanmadığında cihaz içinde şifrelenmiş/izole çoklu hesap depolamasıyla sıfır kurulumla çalışır.

**Tech Stack:** HTML5, Tailwind CSS, Vanilla ES Modules (JavaScript), Web Audio API, Service Worker / Web App Manifest (PWA), Supabase REST/Auth uyumlu hibrit veri katmanı, Node.js (`node --test` via `scripts/run_tests.py`).

**Spec:** `docs/superpowers/specs/2026-10-28-kisisel-tyt-kampi-design.md`

## Global Constraints

- Yeni kayıt olan hiçbir kullanıcıya ön tanımlı kişisel sabit blok (ör. `"Pazartesi 19:00 Fizik Özel Dersi"`) atanmaz; `fixedBlocks` her yeni hesapta `[]` olarak başlar.
- Sabit blok ekleme formunda haftanın günleri (`Pzt`, `Sal`, `Çar`, `Per`, `Cum`, `Cmt`, `Paz`) tek tek seçilebilir (multi-select) olmalı ve başlangıç/bitiş saatleri (`HH:MM`) elle girilebilmelidir.
- Spor seçim adımında popüler spor sistemleri (`ppl`, `ul`, `fb`, `bro`, `cardio`, `none`) hazır sunulmalı ve spor başlangıç/bitiş saatleri kullanıcı tarafından elle yazılabilmelidir.
- 3. adımda kullanıcıya yalnızca çalışma yoğunluğu somut örneklerle sorulmalı (`relaxed`: ~22 hafta, günde ~1.5-2 saat / 30 soru + konu; `balanced`: 16 hafta, günde ~3 saat / 50 soru + konu tekrarı; `intense`: 12 hafta, günde ~4.5+ saat / 90 soru + 2 konu + deneme) ve sıkışık program isteyenin süresi asla uzatılmamalı, rahat isteyenin süresi esnetilmelidir.
- 4. adımda ve ana ekranda kullanıcının sabit blokları, spor programı/saatleri ve Maarif TYT çalışma blokları çakışmasız olarak tek bir birleşik günlük/haftalık programda birleştirilmelidir.
- Kullanıcılar arası veri (`fixedBlocks`, `sportConfig`, `tempoKey`, `progress`, `offDays`, `notes`, `alarm`) `userId` bazında tamamen izole olmalıdır.

## Review Focus

1. **Ters veya geçersiz saat aralığı (`start >= end`):** Kullanıcı sabit blokta veya spor saatinde bitiş saatini başlangıçtan küçük/eşit girdiğinde (ör. `20:00 - 18:00`), `parseTimeRange` / `allocateFreeSlots` sonsuz döngüye girmemeli veya negatif süre üretmemeli; aralığı güvenli şekilde normalize etmeli veya reddetmelidir (Task 2 testlerinde doğrulanır).
2. **Gün içi sabit blokların günü tamamen doldurması:** Kullanıcının bir günde girdiği sabit bloklar + spor saatleri neredeyse tüm günü doldurduğunda (`allocateFreeSlots`), çalışma bloğu mevcut sabit blokların üstüne yazılmamalı; kalan en uygun boşluğa veya gün sonuna yerleştirilip `hasCollisionWarning: true` dönmelidir (Task 2 testlerinde doğrulanır).
3. **Kullanıcılar arası veri sızıntısı:** A kullanıcısı sabit blok, domino kaydırma veya yanlış defteri notu eklediğinde ve çıkış yapıp B kullanıcısı kayıt olduğunda, B kullanıcısının listesinde A'ya ait hiçbir veri (`fixedBlocks`, `offDays`, `notes`, `progress`) görünmemelidir (Task 3 testlerinde doğrulanır).
4. **Domino kaydırmanın (`offDays`) farklı kamp sürelerinde (12, 16, 22 hafta) sınır aşımı:** Kampın son günlerinde "Dışarı Çıktım" işaretlendiğinde `getSlotWithDominoShift` dizi sınırları dışına (`undefined` hatası) düşmemeli, "Genel Tekrar & Deneme" tamamlama kartı döndürmelidir (Task 2 testlerinde doğrulanır).
5. **Yoğunluk/düzen sonradan değiştirildiğinde ilerleme korunumu:** Kullanıcı kurulumu tamamladıktan sonra düzenini veya yoğunluğunu güncellediğinde mevcut `notes` ve `progress` verileri sıfırlanmamalıdır (Task 3 & Task 4 testlerinde doğrulanır).

---

### Task 1: Test Altyapısı, 112 Birimlik Maarif TYT Müfredatı ve Popüler Spor Programları (`js/curriculum.js`)

**Files:**
- Create: `scripts/run_tests.py`
- Create: `js/curriculum.js`
- Test: `tests/curriculum.test.mjs`

**Interfaces:**
- Produces:
  - `DIRECT_CHANNELS`: `Record<string, string>`
  - `MACRO_PHASES`: `Array<{ id: number, name: string, weeks: number[], color: string }>`
  - `WEEKS_DATABASE`: `Array<{ weekNum: number, phaseId: number, title: string, desc: string, days: Array<{ day: string, subj: string, topic: string, teacher: string, target: string, directUrl: string, channelUrl: string, note: string }> }>`
  - `LINEAR_CURRICULUM`: `Array<{ unitIndex: number, origWeek: number, origDay: string, phaseId: number, subj: string, topic: string, teacher: string, target: string, directUrl: string, channelUrl: string, note: string }>`
  - `SPORT_PROGRAMS`: `Array<{ id: string, name: string, badge: string, cycleDesc: string, dayMap: Record<string, { isRest: boolean, label: string, badge: string, color: string }> }>`
  - `TEMPO_OPTIONS`: `Record<'relaxed'|'balanced'|'intense', { id: string, name: string, badge: string, totalWeeks: number, dailyHoursLabel: string, exampleLabel: string, desc: string, studyBlocks: Array<{ durationMin: number, label: string, tag: string }> }>`
  - `MOTIVATION_QUOTES`: `string[]`
  - `ALL_DAYS`: `['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']`
  - `DAY_FULL_NAMES`: `Record<string, string>`

- [ ] **Step 1: Create `scripts/run_tests.py` and write the failing test `tests/curriculum.test.mjs`**

`scripts/run_tests.py` invokes `C:\Users\kanbak\AppData\Local\Programs\antigravity\Antigravity.exe` with `ELECTRON_RUN_AS_NODE=1` and `--test` on passed test files (or `tests/*.test.mjs` by default).

```javascript
// tests/curriculum.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_DAYS,
  LINEAR_CURRICULUM,
  WEEKS_DATABASE,
  SPORT_PROGRAMS,
  TEMPO_OPTIONS
} from '../js/curriculum.js';

test('WEEKS_DATABASE contains all 16 weeks and 112 Maarif TYT units', () => {
  assert.equal(WEEKS_DATABASE.length, 16);
  assert.equal(LINEAR_CURRICULUM.length, 112);
  assert.equal(LINEAR_CURRICULUM[0].subj, 'TYT Matematik');
  assert.ok(LINEAR_CURRICULUM[0].directUrl.startsWith('https://www.youtube.com/'));
  assert.equal(LINEAR_CURRICULUM[111].origWeek, 16);
});

test('SPORT_PROGRAMS defines all 6 popular workout splits across all 7 days', () => {
  const ids = SPORT_PROGRAMS.map(s => s.id);
  assert.deepEqual(ids, ['ppl', 'ul', 'fb', 'bro', 'cardio', 'none']);
  for (const sp of SPORT_PROGRAMS) {
    for (const d of ALL_DAYS) {
      assert.ok(sp.dayMap[d], `Missing day ${d} in sport program ${sp.id}`);
      assert.equal(typeof sp.dayMap[d].isRest, 'boolean');
    }
  }
});

test('TEMPO_OPTIONS defines relaxed (22w), balanced (16w), and intense (12w)', () => {
  assert.equal(TEMPO_OPTIONS.relaxed.totalWeeks, 22);
  assert.equal(TEMPO_OPTIONS.balanced.totalWeeks, 16);
  assert.equal(TEMPO_OPTIONS.intense.totalWeeks, 12);
  assert.equal(TEMPO_OPTIONS.relaxed.studyBlocks.length, 1);
  assert.equal(TEMPO_OPTIONS.balanced.studyBlocks.length, 2);
  assert.equal(TEMPO_OPTIONS.intense.studyBlocks.length, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/run_tests.py tests/curriculum.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../js/curriculum.js`.

- [ ] **Step 3: Implement `js/curriculum.js`**

Extract `directChannels`, `macroPhases`, `weeksDatabase`, `motivationQuotes` from `index.html`, build `LINEAR_CURRICULUM` (112 units), and export `SPORT_PROGRAMS`, `TEMPO_OPTIONS`, `ALL_DAYS`, and `DAY_FULL_NAMES`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/run_tests.py tests/curriculum.test.mjs`
Expected: PASS (3/3 tests passing).

---

### Task 2: Boş Saat Bulma, Tempo Müfredat Dağıtımı ve Domino Kaydırma Motoru (`js/scheduler.js`)

**Files:**
- Create: `js/scheduler.js`
- Test: `tests/scheduler.test.mjs`

**Interfaces:**
- Consumes: `ALL_DAYS`, `DAY_FULL_NAMES`, `LINEAR_CURRICULUM`, `SPORT_PROGRAMS`, `TEMPO_OPTIONS`, `MACRO_PHASES`, `DIRECT_CHANNELS` from `js/curriculum.js`
- Produces:
  - `parseTimeToMinutes(timeStr: string) -> number`
  - `formatMinutesToTime(minutes: number) -> string`
  - `normalizeTimeRange(startStr: string, endStr: string, fallbackDurationMin?: number) -> { startMin: number, endMin: number, start: string, end: string, isValid: boolean }`
  - `allocateFreeSlots(busyIntervals: Array<{ startMin: number, endMin: number, bufferAfterMin?: number }>, blockDurations: number[], dayWindow?: { startMin: number, endMin: number }) -> { slots: Array<{ startMin: number, endMin: number, start: string, end: string, fitted: boolean }>, hasCollisionWarning: boolean }`
  - `generateCampaignWeeks(tempoKey: 'relaxed'|'balanced'|'intense', linearUnits?: Array) -> Array<{ weekNum: number, phaseId: number, phaseName: string, phaseColor: string, title: string, desc: string, days: Array<{ dayKey: string, dayName: string, subj: string, topic: string, teacher: string, target: string, directUrl: string, channelUrl: string, note: string }> }>`
  - `getSlotWithDominoShift(campaignWeeks: Array, globalSlotIndex: number, offDaysMap: Record<number, object>) -> { isOffDay: boolean, offInfo?: object, isCascadeShifted: boolean, effectiveIndex: number, totalSlots: number, lesson: object }`
  - `buildUnifiedDailySchedule(params: { dayKey: string, fixedBlocks: Array<{ id?: string, title: string, days: string[], start: string, end: string }>, sportConfig: { programId: string, start: string, end: string, customNote?: string }, tempoKey: 'relaxed'|'balanced'|'intense', lesson: object }) -> { dayKey: string, dayName: string, sportInfo: object, timeline: Array<{ startMin: number, endMin: number, time: string, title: string, tag: string, type: 'fixed'|'sport'|'study'|'rest', color: string, highlight: boolean }>, hasCollisionWarning: boolean }`

- [ ] **Step 1: Write the failing test `tests/scheduler.test.mjs`**

```javascript
// tests/scheduler.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizeTimeRange,
  allocateFreeSlots,
  generateCampaignWeeks,
  getSlotWithDominoShift,
  buildUnifiedDailySchedule
} from '../js/scheduler.js';

test('normalizeTimeRange handles valid and reversed time ranges safely', () => {
  const valid = normalizeTimeRange('08:30', '16:00');
  assert.equal(valid.startMin, 510);
  assert.equal(valid.endMin, 960);
  assert.equal(valid.isValid, true);

  const reversed = normalizeTimeRange('20:00', '18:00', 60);
  assert.equal(reversed.isValid, false);
  assert.equal(reversed.startMin, 1200);
  assert.equal(reversed.endMin, 1260);
});

test('allocateFreeSlots places study blocks outside school, tutoring, and sport with buffers', () => {
  const busy = [
    { startMin: parseTimeToMinutes('08:30'), endMin: parseTimeToMinutes('16:00'), bufferAfterMin: 15 },
    { startMin: parseTimeToMinutes('16:30'), endMin: parseTimeToMinutes('18:00'), bufferAfterMin: 30 },
    { startMin: parseTimeToMinutes('19:00'), endMin: parseTimeToMinutes('20:30'), bufferAfterMin: 15 }
  ];
  const { slots, hasCollisionWarning } = allocateFreeSlots(busy, [90]);
  assert.equal(hasCollisionWarning, false);
  assert.equal(slots.length, 1);
  // Must start at or after 20:45 (20:30 + 15m buffer)
  assert.ok(slots[0].startMin >= parseTimeToMinutes('20:45'));
  assert.equal(slots[0].endMin - slots[0].startMin, 90);
});

test('allocateFreeSlots sets hasCollisionWarning when day is overpacked', () => {
  const busy = [
    { startMin: parseTimeToMinutes('08:00'), endMin: parseTimeToMinutes('23:00'), bufferAfterMin: 15 }
  ];
  const { slots, hasCollisionWarning } = allocateFreeSlots(busy, [90, 90]);
  assert.equal(hasCollisionWarning, true);
  assert.equal(slots.length, 2);
});

test('generateCampaignWeeks scales duration: 22w relaxed, 16w balanced, 12w intense without losing curriculum', () => {
  const relaxed = generateCampaignWeeks('relaxed');
  const balanced = generateCampaignWeeks('balanced');
  const intense = generateCampaignWeeks('intense');

  assert.equal(relaxed.length, 22);
  assert.equal(balanced.length, 16);
  assert.equal(intense.length, 12);

  // Every week has 7 days
  assert.ok(relaxed.every(w => w.days.length === 7));
  assert.ok(balanced.every(w => w.days.length === 7));
  assert.ok(intense.every(w => w.days.length === 7));
});

test('getSlotWithDominoShift cascades lessons by 1 day and handles end-of-camp overflow safely', () => {
  const weeks = generateCampaignWeeks('balanced');
  const offDays = { 0: { weekNum: 1, dayIndex: 0, dayName: 'Pazartesi', shiftedDate: '28.10.2026' } };

  const slot0 = getSlotWithDominoShift(weeks, 0, offDays);
  assert.equal(slot0.isOffDay, true);

  const slot1 = getSlotWithDominoShift(weeks, 1, offDays);
  assert.equal(slot1.isOffDay, false);
  assert.equal(slot1.isCascadeShifted, true);
  assert.equal(slot1.effectiveIndex, 0);
  assert.equal(slot1.lesson.topic, weeks[0].days[0].topic);

  // Overflow slot at the very end (slot 111 when 1 day is shifted -> effectiveIndex 110; if 5 days shifted, overflow check)
  const manyOffs = { 0: {}, 1: {}, 2: {} };
  const lastSlot = getSlotWithDominoShift(weeks, 111, manyOffs);
  assert.equal(lastSlot.isOffDay, false);
  assert.ok(lastSlot.lesson.topic);
});

test('buildUnifiedDailySchedule merges user fixedBlocks, custom sport hours, and Maarif TYT blocks in chronological order', () => {
  const weeks = generateCampaignWeeks('balanced');
  const unified = buildUnifiedDailySchedule({
    dayKey: 'Pzt',
    fixedBlocks: [
      { title: 'Okul', days: ['Pzt'], start: '08:30', end: '15:30' },
      { title: 'Kimya Özel Ders', days: ['Pzt'], start: '18:30', end: '19:30' }
    ],
    sportConfig: { programId: 'ppl', start: '16:00', end: '17:30', customNote: '' },
    tempoKey: 'balanced',
    lesson: weeks[0].days[0]
  });

  assert.equal(unified.dayName, 'Pazartesi');
  assert.ok(unified.sportInfo.label.includes('Push'));
  // Check chronological sorting
  for (let i = 1; i < unified.timeline.length; i++) {
    assert.ok(unified.timeline[i].startMin >= unified.timeline[i - 1].startMin);
  }
  // Ensure Kimya Özel Ders, Sport, and 2 study blocks are all present
  assert.ok(unified.timeline.some(t => t.title.includes('Kimya Özel Ders')));
  assert.ok(unified.timeline.some(t => t.type === 'sport'));
  assert.equal(unified.timeline.filter(t => t.type === 'study').length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/run_tests.py tests/scheduler.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../js/scheduler.js`.

- [ ] **Step 3: Implement `js/scheduler.js`**

Implement time parsing/formatting, `allocateFreeSlots` (with 15m buffer after fixed blocks and 30m buffer after sport blocks), `generateCampaignWeeks` for `relaxed` (22 weeks: 5 core units Mon–Fri + 2 Maarif consolidation/review days Sat–Sun), `balanced` (16 weeks: 112 units 1-to-1), and `intense` (12 weeks: 84 days combining 2 units on 28 high-focus days and 1 unit + branch drill on 56 days so all 112 units complete in 12 weeks), `getSlotWithDominoShift`, and `buildUnifiedDailySchedule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/run_tests.py tests/scheduler.test.mjs`
Expected: PASS (6/6 tests passing).

---

### Task 3: Çok Kullanıcılı Hesap, İzole Veri Depolama ve Supabase Bulut Senkronizasyonu (`js/auth-storage.js` & `sql/supabase_schema.sql`)

**Files:**
- Create: `js/auth-storage.js`
- Create: `sql/supabase_schema.sql`
- Test: `tests/auth-storage.test.mjs`

**Interfaces:**
- Produces:
  - `createDefaultUserState() -> UserState` (guaranteed `fixedBlocks: []`, `onboardingCompleted: false`)
  - `createAccountStore(options?: { storage?: Storage, cloudAdapter?: object })` with methods:
    - `registerUser({ name: string, email: string, password: string }) -> Promise<{ user: UserProfile, state: UserState }>`
    - `loginUser({ email: string, password: string }) -> Promise<{ user: UserProfile, state: UserState }>`
    - `logoutUser() -> Promise<void>`
    - `getCurrentSession() -> { user: UserProfile, state: UserState } | null`
    - `saveUserState(userId: string, partialState: object) -> Promise<UserState>`
    - `updateOnboardingConfig(userId: string, config: { fixedBlocks: Array, sportConfig: object, tempoKey: string }) -> Promise<UserState>` (updates schedule config while preserving `progress` and `notes`)
    - `getCloudConfig() -> { url: string, anonKey: string, enabled: boolean }`
    - `saveCloudConfig({ url: string, anonKey: string }) -> { url: string, anonKey: string, enabled: boolean }`

- [ ] **Step 1: Write the failing test `tests/auth-storage.test.mjs`**

```javascript
// tests/auth-storage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore, createDefaultUserState } from '../js/auth-storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

test('New user starts with empty fixedBlocks and onboardingCompleted = false', async () => {
  const store = createAccountStore({ storage: createMemoryStorage() });
  const { user, state } = await store.registerUser({
    name: 'Ayşe Yılmaz',
    email: 'ayse@example.com',
    password: 'secret123'
  });

  assert.ok(user.id);
  assert.equal(user.name, 'Ayşe Yılmaz');
  assert.equal(state.onboardingCompleted, false);
  assert.deepEqual(state.fixedBlocks, []);
  assert.deepEqual(state.notes, []);
});

test('User A and User B have strictly isolated schedules, progress, and mistake notes', async () => {
  const storage = createMemoryStorage();
  const store = createAccountStore({ storage });

  const userA = await store.registerUser({ name: 'Ali', email: 'ali@test.com', password: '123' });
  await store.updateOnboardingConfig(userA.user.id, {
    fixedBlocks: [{ title: 'Fizik Özel Ders', days: ['Pzt'], start: '19:00', end: '20:30' }],
    sportConfig: { programId: 'ul', start: '16:30', end: '18:00', customNote: '' },
    tempoKey: 'intense'
  });
  await store.saveUserState(userA.user.id, {
    progress: { slot_0: true },
    notes: [{ topic: 'Fizik', body: 'Vektörler notu', date: '28.10' }]
  });

  await store.logoutUser();
  assert.equal(store.getCurrentSession(), null);

  const userB = await store.registerUser({ name: 'Zeynep', email: 'zeynep@test.com', password: '456' });
  assert.deepEqual(userB.state.fixedBlocks, []);
  assert.deepEqual(userB.state.progress, {});
  assert.deepEqual(userB.state.notes, []);
  assert.equal(userB.state.tempoKey, 'balanced');

  // Re-login as User A and verify User A data is intact
  await store.logoutUser();
  const reloginA = await store.loginUser({ email: 'ali@test.com', password: '123' });
  assert.equal(reloginA.state.fixedBlocks.length, 1);
  assert.equal(reloginA.state.fixedBlocks[0].title, 'Fizik Özel Ders');
  assert.equal(reloginA.state.tempoKey, 'intense');
  assert.equal(reloginA.state.progress.slot_0, true);
  assert.equal(reloginA.state.notes.length, 1);
});

test('updateOnboardingConfig preserves existing progress and mistake notes when routine is edited', async () => {
  const store = createAccountStore({ storage: createMemoryStorage() });
  const { user } = await store.registerUser({ name: 'Can', email: 'can@test.com', password: '123' });

  await store.saveUserState(user.id, {
    progress: { slot_0: true, slot_1: true },
    notes: [{ topic: 'Matematik', body: 'EBOB EKOK kuralı', date: '28.10' }]
  });

  const updated = await store.updateOnboardingConfig(user.id, {
    fixedBlocks: [{ title: 'Dershane', days: ['Cmt', 'Paz'], start: '09:00', end: '13:00' }],
    sportConfig: { programId: 'fb', start: '18:00', end: '19:30', customNote: '' },
    tempoKey: 'relaxed'
  });

  assert.equal(updated.onboardingCompleted, true);
  assert.equal(updated.tempoKey, 'relaxed');
  assert.equal(updated.progress.slot_0, true);
  assert.equal(updated.notes.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/run_tests.py tests/auth-storage.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../js/auth-storage.js`.

- [ ] **Step 3: Implement `js/auth-storage.js` and `sql/supabase_schema.sql`**

Implement `createDefaultUserState`, `createAccountStore` (supporting email/password registration, login validation, isolated per-user state persistence, `updateOnboardingConfig` preserving progress/notes, and optional Supabase REST/Auth sync adapter when `cloudConfig` is set), and write the Supabase SQL schema + RLS policies to `sql/supabase_schema.sql`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/run_tests.py tests/auth-storage.test.mjs`
Expected: PASS (3/3 tests passing).

---

### Task 4: 4 Adımlı Kişisel Kurulum Sihirbazı, Çok Kullanıcılı Ana Arayüz ve PWA Entegrasyonu (`js/app.js`, `index.html`, `manifest.json`, `sw.js`)

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `js/app.js`
- Modify: `index.html`
- Test: `tests/app-integration.test.mjs`

**Interfaces:**
- Consumes: `js/curriculum.js`, `js/scheduler.js`, `js/auth-storage.js`
- Produces:
  - `js/app.js` controller exposing `window.appController` for HTML event handlers (auth login/register/logout, 4-step wizard state machine: manual day-pill selection `toggleWizardDayPill`, manual time block addition `addWizardFixedBlock`, sport program & manual sport time inputs, tempo selection, unified program generation, domino shift `markDayShifted`/`undoShiftDay`, mistake notes CRUD, alarm & Telegram sharing).
  - Updated `index.html` with Auth Overlay, 4-Step Personal Setup Wizard Modal, User Profile Header Badge (`⚙️ Düzenimi & Sporumu Güncelle`, `☁️ Bulut`, `Çıkış Yap`), Dynamic Week Tabs (`1..12`, `1..16`, or `1..22`), Unified Daily Schedule Modal, and PWA registration.

- [ ] **Step 1: Write the failing integration test `tests/app-integration.test.mjs`**

```javascript
// tests/app-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createAccountStore } from '../js/auth-storage.js';
import { generateCampaignWeeks, buildUnifiedDailySchedule } from '../js/scheduler.js';

test('End-to-end user onboarding flow produces personalized conflict-free unified schedule', async () => {
  const mem = new Map();
  const storage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k)
  };
  const store = createAccountStore({ storage });

  // 1. Register a brand new user
  const { user, state } = await store.registerUser({
    name: 'Mert Demir',
    email: 'mert@tytkampi.com',
    password: 'password123'
  });
  assert.equal(state.fixedBlocks.length, 0);

  // 2. Complete 4-step wizard with custom manual days/hours, Full Body sport, and Relaxed tempo (22 weeks)
  const updatedState = await store.updateOnboardingConfig(user.id, {
    fixedBlocks: [
      { id: 'b1', title: 'Lise Okul Saatleri', days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], start: '08:00', end: '15:00' },
      { id: 'b2', title: 'İngilizce Kursu', days: ['Pzt', 'Çar'], start: '18:30', end: '20:00' }
    ],
    sportConfig: {
      programId: 'fb',
      start: '16:00',
      end: '17:30',
      customNote: 'Salondan eve dönüş 20 dk'
    },
    tempoKey: 'relaxed'
  });

  assert.equal(updatedState.onboardingCompleted, true);
  const weeks = generateCampaignWeeks(updatedState.tempoKey);
  assert.equal(weeks.length, 22);

  const mondaySchedule = buildUnifiedDailySchedule({
    dayKey: 'Pzt',
    fixedBlocks: updatedState.fixedBlocks,
    sportConfig: updatedState.sportConfig,
    tempoKey: updatedState.tempoKey,
    lesson: weeks[0].days[0]
  });

  // Verify Monday contains Lise Okul Saatleri, İngilizce Kursu, Full Body at 16:00-17:30, and 1 Relaxed TYT block after 20:15
  assert.ok(mondaySchedule.timeline.some(b => b.title.includes('Lise Okul Saatleri')));
  assert.ok(mondaySchedule.timeline.some(b => b.title.includes('İngilizce Kursu')));
  assert.ok(mondaySchedule.timeline.some(b => b.type === 'sport' && b.time === '16:00 - 17:30'));
  const studyBlocks = mondaySchedule.timeline.filter(b => b.type === 'study');
  assert.equal(studyBlocks.length, 1);
  assert.ok(studyBlocks[0].startMin >= 20 * 60 + 15);
});

test('PWA manifest.json, sw.js, and index.html module wiring exist and are valid', () => {
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(manifest.name);
  assert.equal(manifest.display, 'standalone');

  const swContent = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(swContent.includes('install'));

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('type="module"'));
  assert.ok(html.includes('js/app.js'));
  assert.ok(html.includes('auth-modal'));
  assert.ok(html.includes('onboarding-wizard-modal'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/run_tests.py tests/app-integration.test.mjs`
Expected: FAIL because `manifest.json`, `sw.js`, `js/app.js`, and the new `index.html` modals do not exist yet.

- [ ] **Step 3: Implement `manifest.json`, `sw.js`, `js/app.js`, and update `index.html`**

Create `manifest.json` and `sw.js`, implement the full application controller in `js/app.js`, and update `index.html` to replace the single-user hardcoded script with the multi-user Auth screen, 4-Step Personal Setup Wizard (1. Manual Fixed Blocks with day pills & time inputs, 2. Popular Sport Programs & manual sport hours, 3. Study Intensity selector only, 4. Unified Program merger), user profile controls, and PWA registration.

- [ ] **Step 4: Run the full test suite to verify everything passes**

Run: `python scripts/run_tests.py`
Expected: PASS (all test files and all assertions passing with 0 failures).

- [ ] **Step 5: Commit changes**

```bash
git add index.html manifest.json sw.js js/ sql/ tests/ scripts/ docs/
git commit -m "feat: transform single-user TYT page into multi-user personalized Maarif TYT & sport app"
```
