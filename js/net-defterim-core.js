import { mebTopics } from './meb-topics.js';

export const subjects = [
  'Matematik',
  'Geometri',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türkçe',
  'Edebiyat',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü',
  'İngilizce'
];

export const examTypes = [
  'TYT',
  'AYT',
  'YDT',
  'LGS',
  '9. Sınıf',
  '10. Sınıf',
  '11. Sınıf',
  '12. Sınıf',
  'Mezun'
];

export const grades = [
  '9. Sınıf',
  '10. Sınıf',
  '11. Sınıf',
  '12. Sınıf',
  'Mezun'
];

export const mistakes = [
  { id: 'knowledge', label: 'Bilgi eksiği' },
  { id: 'attention', label: 'Dikkat hatası' },
  { id: 'interpretation', label: 'Yorum / okuma' },
  { id: 'time', label: 'Süre yetmedi' },
  { id: 'unsolved', label: 'Boş bıraktım' }
];

export const statuses = [
  { id: 'pending', label: 'Bekliyor' },
  { id: 'reviewing', label: 'Tekrarda' },
  { id: 'solved', label: 'Öğrenildi' }
];

export const intervals = [1, 3, 7, 14, 30, 60];

export const examSubjects = {
  TYT: [
    { name: 'Türkçe', count: 40 },
    { name: 'Matematik', count: 40 },
    { name: 'Fen Bilimleri', count: 20 },
    { name: 'Sosyal Bilimler', count: 20 }
  ],
  AYT: [
    { name: 'Matematik', count: 40 },
    { name: 'Fizik', count: 14 },
    { name: 'Kimya', count: 13 },
    { name: 'Biyoloji', count: 13 },
    { name: 'Edebiyat', count: 24 },
    { name: 'Tarih', count: 10 },
    { name: 'Coğrafya', count: 6 }
  ]
};

export const fallbackTopics = {
  Geometri: [
    'Doğruda ve Üçgende Açılar',
    'Özel Üçgenler ve Benzerlik',
    'Üçgende Alan ve Yardımcı Elemanlar',
    'Çokgenler ve Dörtgenler',
    'Çember ve Daire',
    'Analitik Geometri',
    'Katı Cisimler',
    'Dönüşüm Geometrisi'
  ],
  Türkçe: [
    'Sözcükte ve Söz Öbeklerinde Anlam',
    'Cümlede Anlam ve Yorum',
    'Paragrafta Yapı ve Ana Düşünce',
    'Paragrafta Yardımcı Düşünce',
    'Ses Bilgisi ve Yazım Kuralları',
    'Noktalama İşaretleri',
    'Sözcük Yapısı ve Ekler',
    'Sözcük Türleri ve Tamlamalar',
    'Fiiller, Fiilimsiler ve Ek Fiil',
    'Cümlenin Ögeleri ve Cümle Türleri',
    'Anlatım Bozuklukları'
  ],
  Edebiyat: [
    'Metinlerin Sınıflandırılması ve Şiir Bilgisi',
    'Söz Sanatları ve Edebi Akımlar',
    'İslamiyet Öncesi ve Geçiş Dönemi',
    'Halk Edebiyatı',
    'Divan Edebiyatı',
    'Tanzimat ve Servetifünun Edebiyatı',
    'Milli Edebiyat Dönemi',
    'Cumhuriyet Dönemi Şiir ve Roman'
  ],
  Felsefe: [
    'Felsefeyi Tanıma ve Düşünme',
    'Varlık Felsefesi',
    'Bilgi Felsefesi',
    'Bilim Felsefesi',
    'Ahlak Felsefesi',
    'Din, Siyaset ve Sanat Felsefesi',
    'MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi',
    'MS 2. Yüzyıl - 15. Yüzyıl Felsefesi',
    '15. Yüzyıl - 17. Yüzyıl Felsefesi',
    '18. Yüzyıl - 19. Yüzyıl Felsefesi',
    '20. Yüzyıl Felsefesi'
  ],
  'Din Kültürü': [
    'Bilgi ve İnanç',
    'Din ve İslam',
    'İslam ve İbadet',
    'Ahlak ve Değerler',
    'Allah-İnsan İlişkisi',
    'Hz. Muhammed (s.a.v.) ve Gençlik',
    'Vahiy, Akıl ve İslam Düşüncesi',
    'Yaşayan Dünya Dinleri'
  ],
  İngilizce: [
    'Tenses ve Modals',
    'Passive Voice ve Causatives',
    'If Clauses ve Wish Clauses',
    'Relative Clauses ve Noun Clauses',
    'Conjunctions ve Transitions',
    'Gerund, Infinitive ve Participles',
    'Vocabulary ve Phrasal Verbs',
    'Reading Comprehension',
    'Cloze Test ve Cümle Tamamlama',
    'Paragraf Tamamlama ve İlgisiz Cümle',
    'Diyalog, Restatement ve Çeviri'
  ]
};

export const mebSubjectAliases = {
  Türkçe: 'Türk Dili ve Edebiyatı',
  Edebiyat: 'Türk Dili ve Edebiyatı',
  'Din Kültürü': 'Din Kültürü ve Ahlak Bilgisi'
};

export function mebTopicsFor(subject, grade) {
  const key = mebSubjectAliases[subject] ?? subject;
  const byGrade = mebTopics[key];
  if (!byGrade) return [];
  const gradeKey = grade ? String(grade).replace(/\D/g, '') || grade : null;
  const targetGrades = gradeKey && byGrade[gradeKey] ? [byGrade[gradeKey]] : Object.values(byGrade);
  const seen = new Set();
  const list = [];
  for (const units of targetGrades) {
    for (const item of units) {
      if (Array.isArray(item.topics) && item.topics.length) {
        for (const t of item.topics) {
          if (t && !seen.has(t)) {
            seen.add(t);
            list.push(t);
          }
        }
      } else {
        const title = item.title || String(item.unit || '').replace(/^(\d+\.\s*(Ünite|Tema)|Theme\s*\d+):\s*/, '');
        if (title && !seen.has(title)) {
          seen.add(title);
          list.push(title);
        }
      }
    }
  }
  return list;
}

export function topicOptions(subject, grade) {
  const meb = mebTopicsFor(subject, grade);
  const extra = fallbackTopics[subject] ?? [];
  return Array.from(new Set([...meb, ...extra]));
}

function cleanText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTopic(subject, raw, grade) {
  const options = topicOptions(subject, grade);
  const trimmed = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return options[0] ?? 'Genel tekrar';

  const needle = cleanText(trimmed);
  const exact = options.find((opt) => cleanText(opt) === needle);
  if (exact) return exact;

  const partial = options.find((opt) => {
    const hay = cleanText(opt);
    return hay.includes(needle) || needle.includes(hay);
  });
  if (partial) return partial;

  const words = needle.split(' ').filter((w) => w.length > 2);
  let best = '';
  let bestScore = 0;
  for (const opt of options) {
    const hay = cleanText(opt);
    const score = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  if (best && bestScore > 0) return best;

  return trimmed.charAt(0).toLocaleUpperCase('tr-TR') + trimmed.slice(1);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(dateKey) {
  if (!dateKey) return '';
  const date = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function formatMonth(monthKey) {
  const [year, month] = String(monthKey || currentMonthKey()).split('-').map(Number);
  const date = new Date(year || 2026, (month || 1) - 1, 1);
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export function daysUntil(dateKey) {
  if (!dateKey) return null;
  const target = new Date(`${dateKey}T12:00:00`);
  const now = new Date(`${todayKey()}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function genitive(name) {
  const clean = String(name || '').trim().split(/\s+/)[0] || 'Öğrenci';
  const lower = clean.toLocaleLowerCase('tr-TR');
  const vowels = 'aeıioöuü';
  let lastVowel = 'e';
  for (let i = lower.length - 1; i >= 0; i -= 1) {
    if (vowels.includes(lower[i])) {
      lastVowel = lower[i];
      break;
    }
  }
  const endsWithVowel = vowels.includes(lower[lower.length - 1]);
  const suffixBase =
    lastVowel === 'a' || lastVowel === 'ı'
      ? 'ın'
      : lastVowel === 'e' || lastVowel === 'i'
        ? 'in'
        : lastVowel === 'o' || lastVowel === 'u'
          ? 'un'
          : 'ün';
  return `${clean}'${endsWithVowel ? 'n' : ''}${suffixBase}`;
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ND';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('');
}

export function scheduleReview(stage, result, fromDate = todayKey()) {
  if (result === 'hard') {
    return {
      stage: 0,
      status: 'pending',
      nextReview: addDays(fromDate, intervals[0])
    };
  }
  const jump = result === 'easy' ? 2 : 1;
  const nextStage = Math.min(intervals.length - 1, stage + jump);
  return {
    stage: nextStage,
    status: nextStage >= intervals.length - 1 ? 'solved' : 'reviewing',
    nextReview: addDays(fromDate, intervals[nextStage])
  };
}

export function dueQuestions(questions, dateKey = todayKey()) {
  return (questions || [])
    .filter((item) => item.status !== 'solved' && item.nextReview <= dateKey)
    .sort((a, b) => String(a.nextReview).localeCompare(String(b.nextReview)));
}

export function mistakeLabel(id) {
  return mistakes.find((item) => item.id === id)?.label ?? 'Bilgi eksiği';
}

export function statusLabel(id) {
  return statuses.find((item) => item.id === id)?.label ?? 'Bekliyor';
}

export function monthlyTopics(questions, monthKey) {
  const counts = new Map();
  for (const item of questions || []) {
    if (monthKey !== 'all' && !String(item.createdAt || '').startsWith(monthKey)) continue;
    const topic = item.topic?.trim() || 'Belirtilmemiş konu';
    const key = `${item.subject}__${topic}`;
    const existing = counts.get(key) ?? {
      subject: item.subject,
      topic,
      total: 0,
      unsolved: 0
    };
    existing.total += 1;
    if (item.status !== 'solved') existing.unsolved += 1;
    counts.set(key, existing);
  }
  return Array.from(counts.values()).sort(
    (a, b) => b.unsolved - a.unsolved || b.total - a.total
  );
}

export function calculateExamNet(correct, wrong) {
  const c = Math.max(0, Number(correct) || 0);
  const w = Math.max(0, Number(wrong) || 0);
  return Math.max(0, Math.round((c - w / 4) * 100) / 100);
}
