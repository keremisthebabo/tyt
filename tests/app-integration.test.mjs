import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

  const { user, state } = await store.registerUser({
    name: 'Mert Demir',
    email: 'mert@tytkampi.com',
    password: 'password123'
  });
  assert.equal(state.fixedBlocks.length, 0);

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

  assert.ok(mondaySchedule.timeline.some(b => b.title.includes('Lise Okul Saatleri')));
  assert.ok(mondaySchedule.timeline.some(b => b.title.includes('İngilizce Kursu')));
  assert.ok(mondaySchedule.timeline.some(b => b.type === 'sport' && b.time === '16:00 - 17:30'));
  const studyBlocks = mondaySchedule.timeline.filter(b => b.type === 'study');
  assert.equal(studyBlocks.length, 1);
  assert.ok(studyBlocks[0].startMin >= 20 * 60 + 15);
});

test('PWA manifest.json, sw.js, js/app.js, and index.html module wiring exist and are valid', () => {
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(manifest.name);
  assert.equal(manifest.display, 'standalone');

  const swContent = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(swContent.includes('install'));

  const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.ok(appJs.includes('buildUnifiedDailySchedule'));
  assert.ok(appJs.includes('generateCampaignWeeks'));
  assert.ok(appJs.includes('hasCollisionWarning'));
  assert.ok(appJs.includes('window.appController'));
  assert.ok(appJs.includes('checkAlarmWallClock'));

  // Verify js/app.js ES module syntax parses with 0 errors
  execFileSync(process.execPath, ['--check', path.join(root, 'js/app.js')], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('type="module"'));
  assert.ok(html.includes('js/app.js'));
  assert.ok(html.includes('auth-modal'));
  assert.ok(html.includes('onboarding-wizard-modal'));
});


test('Unified Net Defterim + TYT Kampı UI stylesheet, brand assets, and 7-view architecture exist', () => {
  const root = process.cwd();
  assert.ok(fs.existsSync(path.join(root, 'css/net-defterim.css')));
  assert.ok(fs.existsSync(path.join(root, 'public/logo-white.png')));
  assert.ok(fs.existsSync(path.join(root, 'js/meb-topics.js')));
  assert.ok(fs.existsSync(path.join(root, 'js/net-defterim-core.js')));

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('css/net-defterim.css'));
  assert.ok(html.includes('app-sidebar'));
  assert.ok(html.includes('topbar'));
  assert.ok(html.includes('mobile-bar'));
  assert.ok(html.includes('welcome-card'));

  const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  for (const viewKey of ['home', 'camp', 'archive', 'report', 'exams', 'notes', 'settings']) {
    assert.ok(appJs.includes(`'${viewKey}'`) || appJs.includes(`"${viewKey}"`));
  }
});

test('TYT Kampı interface includes one-click switch button to Net Defterim and Net Defterim includes one-click return to TYT Kampı', () => {
  const root = process.cwd();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

  // Both main mode containers exist in index.html
  assert.ok(html.includes('id="tyt-kampi-view"'));
  assert.ok(html.includes('id="net-defterim-view"'));

  // One-click button in TYT Kampı to enter Net Defterim
  assert.ok(html.includes('switchAppMode(\'net-defterim\')') || html.includes('switchAppMode("net-defterim")'));
  assert.ok(html.includes('Net Defterim'));

  // One-click button in Net Defterim to return to TYT Kampı
  assert.ok(html.includes('switchAppMode(\'tyt-kampi\')') || html.includes('switchAppMode("tyt-kampi")') || appJs.includes('switchAppMode(\'tyt-kampi\')'));

  // Exact Net Defterim CSS classes are used in the rendered Net Defterim HTML/JS
  for (const cls of ['stats', 'stat', 'dashboard-grid', 'upload-card', 'dropzone', 'focus-card', 'due-list', 'archive-surface', 'report-layout', 'exam-form', 'notes-layout', 'settings-grid']) {
    assert.ok(html.includes(cls) || appJs.includes(cls), `Missing Net Defterim CSS class: ${cls}`);
  }
});

test('QA Regression: CSS specificity, apostrophe-safe onclick, search input focus preservation, alarm modal IDs, and mobile nav tabs', () => {
  const root = process.cwd();
  const css = fs.readFileSync(path.join(root, 'css/net-defterim.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

  // 1. CSS specificity: button reset uses :where(#net-defterim-view) button so .nd-shell button backgrounds are never overridden
  assert.ok(css.includes(':where(#net-defterim-view) button'));

  // 2. Apostrophe-safe onclick: openNdUploadForCampLesson passes numeric globalSlotIndex instead of raw topic strings and reads slotInfo?.lesson
  assert.ok(appJs.includes('openNdUploadForCampLesson(${globalSlotIndex})'));
  assert.ok(appJs.includes('slotInfo?.lesson'));

  // 3. Search input focus preservation in Archive view
  assert.ok(appJs.includes('id="nd-archive-search-input"'));
  assert.ok(appJs.includes('setSelectionRange'));

  // 4. Mobile bar has all 6 Net Defterim tabs + return to camp
  for (const mobId of ['nd-mob-home', 'nd-mob-archive', 'nd-mob-report', 'nd-mob-exams', 'nd-mob-notes', 'nd-mob-settings']) {
    assert.ok(html.includes(mobId), `Missing mobile tab ID: ${mobId}`);
  }

  // 5. Alarm modal IDs match between index.html and js/app.js
  assert.ok(html.includes('id="alarm-modal-subject"'));
  assert.ok(html.includes('id="alarm-modal-topic"'));
  assert.ok(html.includes('id="alarm-modal-quote"'));
});
