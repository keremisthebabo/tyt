import test from 'node:test';
import assert from 'node:assert/strict';
import { mebTopics } from '../js/meb-topics.js';
import {
  subjects,
  examTypes,
  grades,
  mistakes,
  statuses,
  intervals,
  genitive,
  initials,
  topicOptions,
  normalizeTopic,
  scheduleReview,
  dueQuestions,
  monthlyTopics,
  calculateExamNet
} from '../js/net-defterim-core.js';

test('mebTopics and topicOptions return valid MEB Maarif curriculum topics', () => {
  assert.ok(mebTopics['Matematik']);
  const matTopics = topicOptions('Matematik');
  assert.ok(matTopics.length > 10);
  assert.ok(matTopics.includes('Gerçek Sayıların Üslü ve Köklü Gösterimleri ile Yapılan İşlemler'));

  const normalized = normalizeTopic('Matematik', 'üslü ve köklü');
  assert.equal(normalized, 'Gerçek Sayıların Üslü ve Köklü Gösterimleri ile Yapılan İşlemler');
});

test('Turkish vowel harmony genitive and initials work accurately', () => {
  assert.equal(genitive('Yusuf'), "Yusuf'un");
  assert.equal(genitive('Kerem'), "Kerem'in");
  assert.equal(genitive('Ayşe'), "Ayşe'nin");
  assert.equal(genitive('Burak'), "Burak'ın");
  assert.equal(initials('Yusuf Kaya'), 'YK');
  assert.equal(initials('Kerem'), 'K');
});

test('Spaced repetition scheduleReview advances or resets stages accurately', () => {
  assert.deepEqual(intervals, [1, 3, 7, 14, 30, 60]);

  const r1 = scheduleReview(0, 'hard', '2026-10-01');
  assert.equal(r1.stage, 0);
  assert.equal(r1.status, 'pending');
  assert.equal(r1.nextReview, '2026-10-02');

  const r2 = scheduleReview(0, 'ok', '2026-10-01');
  assert.equal(r2.stage, 1);
  assert.equal(r2.status, 'reviewing');
  assert.equal(r2.nextReview, '2026-10-04');

  const r3 = scheduleReview(4, 'easy', '2026-10-01');
  assert.equal(r3.stage, 5);
  assert.equal(r3.status, 'solved');
  assert.equal(r3.nextReview, '2026-11-30');
});

test('dueQuestions filters pending/reviewing questions due on or before date and monthlyTopics aggregates topics', () => {
  const sampleQuestions = [
    { id: 'q1', subject: 'Matematik', topic: 'Fonksiyonlar', status: 'pending', nextReview: '2026-10-20', createdAt: '2026-10-19' },
    { id: 'q2', subject: 'Matematik', topic: 'Fonksiyonlar', status: 'reviewing', nextReview: '2026-10-28', createdAt: '2026-10-25' },
    { id: 'q3', subject: 'Fizik', topic: 'Kuvvet ve Hareket', status: 'solved', nextReview: '2026-10-20', createdAt: '2026-10-15' },
    { id: 'q4', subject: 'Kimya', topic: 'Atom ve Periyodik Sistem', status: 'pending', nextReview: '2026-11-05', createdAt: '2026-10-28' }
  ];

  const due = dueQuestions(sampleQuestions, '2026-10-28');
  assert.equal(due.length, 2);
  assert.deepEqual(due.map((q) => q.id), ['q1', 'q2']);

  const ranked = monthlyTopics(sampleQuestions, '2026-10');
  assert.equal(ranked[0].subject, 'Matematik');
  assert.equal(ranked[0].topic, 'Fonksiyonlar');
  assert.equal(ranked[0].total, 2);
  assert.equal(ranked[0].unsolved, 2);
});

test('calculateExamNet computes 4 wrong cancels 1 right net score', () => {
  assert.equal(calculateExamNet(30, 4), 29);
  assert.equal(calculateExamNet(35, 5), 33.75);
  assert.equal(calculateExamNet(0, 10), 0);
});
