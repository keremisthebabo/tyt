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
