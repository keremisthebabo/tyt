import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_DAYS,
  DAY_FULL_NAMES,
  DIRECT_CHANNELS,
  MACRO_PHASES,
  WEEKS_DATABASE,
  LINEAR_CURRICULUM,
  SPORT_PROGRAMS,
  TEMPO_OPTIONS,
  MOTIVATION_QUOTES
} from '../js/curriculum.js';

test('WEEKS_DATABASE contains all 16 weeks and 112 Maarif TYT units', () => {
  assert.equal(WEEKS_DATABASE.length, 16);
  assert.equal(LINEAR_CURRICULUM.length, 112);
  assert.equal(LINEAR_CURRICULUM[0].subj, 'TYT Matematik');
  assert.equal(LINEAR_CURRICULUM[0].origWeek, 1);
  assert.equal(LINEAR_CURRICULUM[0].origDay, 'Pazartesi');
  assert.ok(LINEAR_CURRICULUM[0].directUrl.startsWith('https://www.youtube.com/'));
  assert.equal(LINEAR_CURRICULUM[111].origWeek, 16);
  assert.equal(MACRO_PHASES.length, 4);
  assert.ok(DIRECT_CHANNELS.mertHoca);
  assert.ok(MOTIVATION_QUOTES.length >= 5);
});

test('SPORT_PROGRAMS defines all 6 popular workout splits across all 7 days', () => {
  assert.deepEqual(ALL_DAYS, ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
  assert.equal(DAY_FULL_NAMES.Pzt, 'Pazartesi');
  assert.equal(DAY_FULL_NAMES.Paz, 'Pazar');

  const ids = SPORT_PROGRAMS.map(s => s.id);
  assert.deepEqual(ids, ['ppl', 'ul', 'fb', 'bro', 'cardio', 'none']);
  for (const sp of SPORT_PROGRAMS) {
    for (const d of ALL_DAYS) {
      assert.ok(sp.dayMap[d], `Missing day ${d} in sport program ${sp.id}`);
      assert.equal(typeof sp.dayMap[d].isRest, 'boolean');
      assert.equal(typeof sp.dayMap[d].label, 'string');
      assert.equal(typeof sp.dayMap[d].badge, 'string');
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

