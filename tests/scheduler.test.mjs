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
  assert.equal(formatMinutesToTime(510), '08:30');

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
  assert.ok(slots[0].startMin >= parseTimeToMinutes('20:45'));
  assert.equal(slots[0].endMin - slots[0].startMin, 90);
});

test('allocateFreeSlots sets hasCollisionWarning when day is overpacked and never overlaps busy intervals or sibling study slots', () => {
  const busy = [
    { startMin: parseTimeToMinutes('08:00'), endMin: parseTimeToMinutes('23:00'), bufferAfterMin: 15 }
  ];
  const { slots, hasCollisionWarning } = allocateFreeSlots(busy, [90, 90]);
  assert.equal(hasCollisionWarning, true);
  assert.equal(slots.length, 2);
  // Neither fallback slot may start before busy end + buffer (23:15 = 1395), nor overlap each other
  assert.ok(slots[0].startMin >= parseTimeToMinutes('23:15'));
  assert.ok(slots[1].startMin >= slots[0].endMin);
});

test('allocateFreeSlots defaults day start to 08:00 and buildUnifiedDailySchedule skips study blocks on Domino off-days', () => {
  const { slots } = allocateFreeSlots([], [60]);
  assert.equal(slots[0].start, '08:00');

  const offDaySchedule = buildUnifiedDailySchedule({
    dayKey: 'Pzt',
    fixedBlocks: [{ title: 'Okul', days: ['Pzt'], start: '08:30', end: '15:30' }],
    sportConfig: { programId: 'ppl', start: '16:00', end: '17:30', customNote: '' },
    tempoKey: 'balanced',
    lesson: null,
    isOffDay: true
  });
  assert.equal(offDaySchedule.isOffDay, true);
  assert.equal(offDaySchedule.timeline.filter(t => t.type === 'study').length, 0);
  assert.ok(offDaySchedule.timeline.some(t => t.type === 'offday'));
});

test('generateCampaignWeeks scales duration: 22w relaxed, 16w balanced, 12w intense without losing curriculum', () => {
  const relaxed = generateCampaignWeeks('relaxed');
  const balanced = generateCampaignWeeks('balanced');
  const intense = generateCampaignWeeks('intense');

  assert.equal(relaxed.length, 22);
  assert.equal(balanced.length, 16);
  assert.equal(intense.length, 12);

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
  for (let i = 1; i < unified.timeline.length; i++) {
    assert.ok(unified.timeline[i].startMin >= unified.timeline[i - 1].startMin);
  }
  assert.ok(unified.timeline.some(t => t.title.includes('Kimya Özel Ders')));
  assert.ok(unified.timeline.some(t => t.type === 'sport'));
  assert.equal(unified.timeline.filter(t => t.type === 'study').length, 2);
});

test('Weekday school hours (08:00 - 16:00) block morning slots so TYT lessons are never scheduled during school, while allowing schoolConfig.enabled = false for graduates', () => {
  const weeks = generateCampaignWeeks('balanced');

  // Exact scenario from user screenshot: Pzt has Fizik Özel Ders 19:30-21:00 and Upper/Lower sport 16:30-18:30, plus default weekday school until 16:00
  const monday = buildUnifiedDailySchedule({
    dayKey: 'Pzt',
    fixedBlocks: [
      { title: 'Fizik Özel Ders', days: ['Pzt'], start: '19:30', end: '21:00' }
    ],
    sportConfig: {
      programId: 'ul',
      start: '16:30',
      end: '18:30',
      customNote: 'hafta içleri okuldan sonra hafta sonu spor yok. Eve 7 de ulaşıyorum genelde'
    },
    tempoKey: 'balanced',
    lesson: weeks[0].days[0]
  });

  // School block must be present on Monday (08:00 - 16:00)
  const schoolBlock = monday.timeline.find(t => t.type === 'fixed' && t.title.toLowerCase().includes('okul'));
  assert.ok(schoolBlock, 'Expected weekday school block (08:00 - 16:00) on Monday');
  assert.equal(schoolBlock.startMin, parseTimeToMinutes('08:00'));
  assert.equal(schoolBlock.endMin, parseTimeToMinutes('16:00'));

  // No TYT study block may be scheduled during school hours (before 16:00)
  const studyBlocks = monday.timeline.filter(t => t.type === 'study');
  assert.equal(studyBlocks.length, 2);
  for (const sb of studyBlocks) {
    assert.ok(sb.startMin >= parseTimeToMinutes('16:00'), `Study block ${sb.time} was scheduled during school hours!`);
  }

  // Graduate student who explicitly disables schoolConfig should NOT get a school block
  const graduateMonday = buildUnifiedDailySchedule({
    dayKey: 'Pzt',
    schoolConfig: { enabled: false },
    fixedBlocks: [],
    sportConfig: { programId: 'none', start: '17:00', end: '18:30', customNote: '' },
    tempoKey: 'balanced',
    lesson: weeks[0].days[0]
  });
  assert.equal(graduateMonday.timeline.some(t => t.title.toLowerCase().includes('okul')), false);
});

