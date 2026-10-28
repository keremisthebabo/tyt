import {
  ALL_DAYS,
  DAY_FULL_NAMES,
  DIRECT_CHANNELS,
  LINEAR_CURRICULUM,
  MACRO_PHASES,
  SPORT_PROGRAMS,
  TEMPO_OPTIONS,
  WEEKS_DATABASE
} from './curriculum.js';

export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) return 9 * 60;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9 * 60;
  const clampedH = Math.max(0, Math.min(23, h));
  const clampedM = Math.max(0, Math.min(59, m));
  return clampedH * 60 + clampedM;
}

export function formatMinutesToTime(minutes) {
  const safeMin = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function normalizeTimeRange(startStr, endStr, fallbackDurationMin = 60) {
  const startMin = parseTimeToMinutes(startStr);
  const rawEndMin = parseTimeToMinutes(endStr);
  if (rawEndMin <= startMin) {
    const fixedEnd = Math.min(23 * 60 + 59, startMin + fallbackDurationMin);
    return {
      startMin,
      endMin: fixedEnd,
      start: formatMinutesToTime(startMin),
      end: formatMinutesToTime(fixedEnd),
      isValid: false
    };
  }
  return {
    startMin,
    endMin: rawEndMin,
    start: formatMinutesToTime(startMin),
    end: formatMinutesToTime(rawEndMin),
    isValid: true
  };
}

export function allocateFreeSlots(
  busyIntervals = [],
  blockDurations = [90],
  dayWindow = { startMin: 8 * 60, endMin: 23 * 60 + 30 }
) {
  const workingBusy = busyIntervals
    .map(b => ({
      startMin: Math.max(0, b.startMin),
      endMin: Math.min(24 * 60, b.endMin + (b.bufferAfterMin ?? 15))
    }))
    .filter(b => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const slots = [];
  let hasCollisionWarning = false;

  for (let i = 0; i < blockDurations.length; i++) {
    const duration = blockDurations[i];
    const remainingCount = blockDurations.length - i;
    let cursor = dayWindow.startMin;
    let placed = null;
    let largestGap = null;

    const merged = [...workingBusy].sort((a, b) => a.startMin - b.startMin);
    for (const interval of merged) {
      if (interval.startMin > cursor) {
        const gapLen = interval.startMin - cursor;
        if (!largestGap || gapLen > largestGap.len) {
          largestGap = { startMin: cursor, endMin: interval.startMin, len: gapLen };
        }
        if (gapLen >= duration) {
          placed = {
            startMin: cursor,
            endMin: cursor + duration,
            start: formatMinutesToTime(cursor),
            end: formatMinutesToTime(cursor + duration),
            fitted: true
          };
          break;
        }
      }
      if (interval.endMin > cursor) {
        cursor = interval.endMin;
      }
    }

    if (!placed) {
      if (dayWindow.endMin > cursor) {
        const tailLen = dayWindow.endMin - cursor;
        if (!largestGap || tailLen > largestGap.len) {
          largestGap = { startMin: cursor, endMin: dayWindow.endMin, len: tailLen };
        }
      }

      if (cursor + duration <= dayWindow.endMin) {
        placed = {
          startMin: cursor,
          endMin: cursor + duration,
          start: formatMinutesToTime(cursor),
          end: formatMinutesToTime(cursor + duration),
          fitted: true
        };
      } else {
        hasCollisionWarning = true;
        const lateEveningAvailable = 23 * 60 + 50 - cursor;
        if (lateEveningAvailable >= 45) {
          const fitLen = Math.min(duration, Math.floor(lateEveningAvailable / remainingCount));
          placed = {
            startMin: cursor,
            endMin: cursor + fitLen,
            start: formatMinutesToTime(cursor),
            end: formatMinutesToTime(cursor + fitLen),
            fitted: false
          };
        } else if (largestGap && largestGap.len >= 30) {
          const fitLen = Math.min(duration, Math.max(20, Math.floor(largestGap.len / remainingCount)));
          const fallbackStart = largestGap.startMin;
          const fallbackEnd = fallbackStart + fitLen;
          placed = {
            startMin: fallbackStart,
            endMin: fallbackEnd,
            start: formatMinutesToTime(fallbackStart),
            end: formatMinutesToTime(fallbackEnd),
            fitted: false
          };
        } else {
          const safeStart = Math.min(23 * 60 + 50, cursor);
          const availableToMidnight = Math.max(10, 23 * 60 + 59 - safeStart);
          const sliceLen = Math.max(5, Math.floor(availableToMidnight / remainingCount));
          const fallbackEnd = Math.min(23 * 60 + 59, safeStart + sliceLen);
          placed = {
            startMin: safeStart,
            endMin: fallbackEnd,
            start: formatMinutesToTime(safeStart),
            end: formatMinutesToTime(fallbackEnd),
            fitted: false
          };
        }
      }
    }

    slots.push(placed);
    workingBusy.push({
      startMin: placed.startMin,
      endMin: placed.fitted ? placed.endMin + 15 : placed.endMin
    });
  }

  return { slots, hasCollisionWarning };
}

export function generateCampaignWeeks(tempoKey = 'balanced', linearUnits = LINEAR_CURRICULUM) {
  if (tempoKey === 'balanced') {
    return WEEKS_DATABASE.map(w => {
      const phase = MACRO_PHASES.find(p => p.id === w.phaseId) || MACRO_PHASES[0];
      return {
        weekNum: w.weekNum,
        phaseId: w.phaseId,
        phaseName: phase.name,
        phaseColor: phase.color,
        title: w.title,
        desc: w.desc,
        days: w.days.map((d, idx) => ({
          dayKey: ALL_DAYS[idx],
          dayName: DAY_FULL_NAMES[ALL_DAYS[idx]],
          origWeek: w.weekNum,
          origDay: d.day,
          subj: d.subj,
          topic: d.topic,
          teacher: d.teacher,
          target: '50 Soru + Konu Tekrarı + 20 Paragraf',
          directUrl: d.directUrl,
          channelUrl: d.channelUrl,
          note: d.note
        }))
      };
    });
  }

  if (tempoKey === 'relaxed') {
    // 22 Weeks (154 days): 5 core units + 2 Maarif consolidation/review days per week (with last weeks finishing remaining units)
    const totalWeeks = 22;
    const weeks = [];
    let unitCursor = 0;

    for (let wNum = 1; wNum <= totalWeeks; wNum++) {
      const phaseIdx = Math.min(3, Math.floor(((wNum - 1) / totalWeeks) * 4));
      const phase = MACRO_PHASES[phaseIdx];
      const weekDays = [];
      let firstTopicOfWeek = '';

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const dayKey = ALL_DAYS[dIdx];
        const dayName = DAY_FULL_NAMES[dayKey];
        const isReviewDay = (dIdx === 2 || dIdx === 6) && (linearUnits.length - unitCursor) > (totalWeeks - wNum) * 5;

        if (!isReviewDay && unitCursor < linearUnits.length) {
          const u = linearUnits[unitCursor++];
          if (!firstTopicOfWeek) firstTopicOfWeek = u.topic;
          weekDays.push({
            dayKey,
            dayName,
            origWeek: wNum,
            origDay: dayName,
            subj: u.subj,
            topic: u.topic,
            teacher: u.teacher,
            target: '30 Soru + 1 Konu Videosu + 15 Paragraf (Rahat Tempo)',
            directUrl: u.directUrl,
            channelUrl: u.channelUrl,
            note: u.note
          });
        } else if (unitCursor < linearUnits.length && isReviewDay) {
          const prevUnit = linearUnits[Math.max(0, unitCursor - 1)];
          weekDays.push({
            dayKey,
            dayName,
            origWeek: wNum,
            origDay: dayName,
            subj: `${prevUnit.subj} Pekiştirme`,
            topic: `${prevUnit.topic} — Esnek Soru Çözümü & Tekrar`,
            teacher: prevUnit.teacher,
            target: '30 Pekiştirme Sorusu + 15 Paragraf + Yanlış Defteri',
            directUrl: prevUnit.directUrl,
            channelUrl: prevUnit.channelUrl,
            note: `Rahat tempo pekiştirme günü: ${prevUnit.topic} konusundaki soru kalıplarını sindirerek tekrar et.`
          });
        } else {
          weekDays.push({
            dayKey,
            dayName,
            origWeek: wNum,
            origDay: dayName,
            subj: 'Maarif Genel Deneme & Tekrar',
            topic: 'TYT Karma Branş Denemesi & Yanlış Defteri Analizi',
            teacher: 'Tüm Kadro',
            target: '30 Seçme Soru + Yanlış Defteri Taraması',
            directUrl: 'https://www.youtube.com/results?search_query=tyt+genel+tekrar+deneme+cozumu',
            channelUrl: DIRECT_CHANNELS.mertHoca,
            note: '22 haftalık esnek programın zirve tekrar ve deneme günü.'
          });
        }
      }

      weeks.push({
        weekNum: wNum,
        phaseId: phase.id,
        phaseName: phase.name,
        phaseColor: phase.color,
        title: `${wNum}. Hafta (Rahat Tempo): ${firstTopicOfWeek || 'Genel Deneme & Pekiştirme'}`,
        desc: 'Esnetilmiş 22 haftalık Maarif programı: Günlük 1.5-2 saatlik sindirerek ilerleme akışı.',
        days: weekDays
      });
    }

    return weeks;
  }

  // 'intense' -> 12 Weeks (84 days covering all 112 units; never stretches beyond 12 weeks)
  const totalWeeks = 12;
  const totalSlots = totalWeeks * 7; // 84
  const weeks = [];
  let unitCursor = 0;

  for (let wNum = 1; wNum <= totalWeeks; wNum++) {
    const phaseIdx = Math.min(3, Math.floor(((wNum - 1) / totalWeeks) * 4));
    const phase = MACRO_PHASES[phaseIdx];
    const weekDays = [];
    let firstTopicOfWeek = '';

    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const globalDay = (wNum - 1) * 7 + dIdx;
      const remainingSlots = totalSlots - globalDay;
      const remainingUnits = linearUnits.length - unitCursor;
      const takeTwo = remainingUnits > remainingSlots && unitCursor + 1 < linearUnits.length;

      const dayKey = ALL_DAYS[dIdx];
      const dayName = DAY_FULL_NAMES[dayKey];

      if (takeTwo) {
        const u1 = linearUnits[unitCursor++];
        const u2 = linearUnits[unitCursor++];
        if (!firstTopicOfWeek) firstTopicOfWeek = u1.topic;
        weekDays.push({
          dayKey,
          dayName,
          origWeek: wNum,
          origDay: dayName,
          subj: u1.subj === u2.subj ? u1.subj : `${u1.subj} + ${u2.subj}`,
          topic: `${u1.topic} & ${u2.topic}`,
          teacher: u1.teacher === u2.teacher ? u1.teacher : `${u1.teacher} / ${u2.teacher}`,
          target: '90 Soru + 2 Konu Videosu + Branş Taraması (Sıkışık Tempo)',
          directUrl: u1.directUrl,
          channelUrl: u1.channelUrl,
          note: `Yoğun birleştirilmiş gün: 1) ${u1.note} 2) ${u2.note}`
        });
      } else if (unitCursor < linearUnits.length) {
        const u1 = linearUnits[unitCursor++];
        if (!firstTopicOfWeek) firstTopicOfWeek = u1.topic;
        weekDays.push({
          dayKey,
          dayName,
          origWeek: wNum,
          origDay: dayName,
          subj: u1.subj,
          topic: u1.topic,
          teacher: u1.teacher,
          target: '90 Soru + Konu & İleri Soru Çözümü + Branş Denemesi',
          directUrl: u1.directUrl,
          channelUrl: u1.channelUrl,
          note: u1.note
        });
      }
    }

    weeks.push({
      weekNum: wNum,
      phaseId: phase.id,
      phaseName: phase.name,
      phaseColor: phase.color,
      title: `${wNum}. Hafta (Yoğun Kamp): ${firstTopicOfWeek}`,
      desc: 'Sıkıştırılmış 12 haftalık Maarif programı: Günlük 4.5+ saatlik maksimum odak akışı.',
      days: weekDays
    });
  }

  return weeks;
}

export function getSlotWithDominoShift(campaignWeeks, globalSlotIndex, offDaysMap = {}) {
  const flatSlots = [];
  campaignWeeks.forEach(w => {
    w.days.forEach(d => {
      flatSlots.push({
        ...d,
        origWeek: w.weekNum,
        origDay: d.dayName
      });
    });
  });

  if (offDaysMap[globalSlotIndex]) {
    return {
      isOffDay: true,
      offInfo: offDaysMap[globalSlotIndex],
      isCascadeShifted: false,
      effectiveIndex: globalSlotIndex,
      totalSlots: flatSlots.length,
      lesson: null
    };
  }

  let shiftsBefore = 0;
  for (let i = 0; i < globalSlotIndex; i++) {
    if (offDaysMap[i]) shiftsBefore++;
  }

  const effectiveIndex = globalSlotIndex - shiftsBefore;
  const isCascadeShifted = effectiveIndex !== globalSlotIndex;

  if (effectiveIndex >= 0 && effectiveIndex < flatSlots.length) {
    return {
      isOffDay: false,
      isCascadeShifted,
      effectiveIndex,
      totalSlots: flatSlots.length,
      lesson: flatSlots[effectiveIndex]
    };
  }

  return {
    isOffDay: false,
    isCascadeShifted,
    effectiveIndex,
    totalSlots: flatSlots.length,
    lesson: {
      dayKey: ALL_DAYS[globalSlotIndex % 7],
      dayName: DAY_FULL_NAMES[ALL_DAYS[globalSlotIndex % 7]],
      origWeek: campaignWeeks.length,
      origDay: DAY_FULL_NAMES[ALL_DAYS[globalSlotIndex % 7]],
      subj: 'Genel Tekrar & Deneme',
      topic: 'Kamp Müfredatı Tamamlandı! Serbest TYT Genel Deneme & Eksik Kapatma',
      teacher: 'Kendi Tekrarın',
      target: '1x Tam TYT Denemesi + Yanlış Defteri Analizi',
      directUrl: 'https://www.youtube.com/results?search_query=tyt+genel+deneme+cozumu',
      channelUrl: DIRECT_CHANNELS.mertHoca,
      note: 'Müfredatın tüm konuları tamamlandı. Artık eksik kapatma ve deneme çözme dönemindesin.'
    }
  };
}

export function buildUnifiedDailySchedule({
  dayKey = 'Pzt',
  schoolConfig = {
    enabled: true,
    title: 'Okul Saatleri',
    days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'],
    start: '08:00',
    end: '16:00'
  },
  fixedBlocks = [],
  sportConfig = { programId: 'ul', start: '17:00', end: '18:30', customNote: '' },
  tempoKey = 'balanced',
  lesson = null,
  isOffDay = false,
  dayStartMin = 8 * 60
}) {
  const dayName = DAY_FULL_NAMES[dayKey] || 'Pazartesi';
  const sportProg = SPORT_PROGRAMS.find(s => s.id === (sportConfig?.programId || 'ul')) || SPORT_PROGRAMS[1];
  const rawSportDayInfo = sportProg.dayMap[dayKey] || sportProg.dayMap.Pzt;
  const noteLower = (sportConfig?.customNote || '').toLowerCase();
  const isWeekendNoSport =
    (dayKey === 'Cmt' || dayKey === 'Paz') &&
    (noteLower.includes('hafta sonu spor yok') || noteLower.includes('haftasonu spor yok'));
  const sportDayInfo = isWeekendNoSport
    ? {
        ...rawSportDayInfo,
        isRest: true,
        badge: 'Dinlenme (Hafta Sonu)',
        label: 'Dinlenme Günü (Hafta Sonu Spor Yok)'
      }
    : rawSportDayInfo;
  const tempo = TEMPO_OPTIONS[tempoKey] || TEMPO_OPTIONS.balanced;

  const timeline = [];
  const busyIntervals = [];

  // 1. User's personal fixed blocks for this day + weekday school hours (if enabled)
  const todaysFixed = (fixedBlocks || []).filter(b => Array.isArray(b.days) && b.days.includes(dayKey));
  const hasExplicitSchoolBlock = todaysFixed.some(b => {
    const t = (b.title || '').toLowerCase();
    return t.includes('okul') || t.includes('lise') || t.includes('dershane');
  });

  const schoolDays = Array.isArray(schoolConfig?.days) ? schoolConfig.days : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
  if (schoolConfig?.enabled !== false && schoolDays.includes(dayKey) && !hasExplicitSchoolBlock) {
    const normSchool = normalizeTimeRange(schoolConfig?.start || '08:00', schoolConfig?.end || '16:00', 480);
    busyIntervals.push({
      startMin: normSchool.startMin,
      endMin: normSchool.endMin,
      bufferAfterMin: 15
    });
    timeline.push({
      startMin: normSchool.startMin,
      endMin: normSchool.endMin,
      time: `${normSchool.start} - ${normSchool.end}`,
      title: `🏫 ${schoolConfig?.title || 'Okul Saatleri'}`,
      tag: 'Okul Düzeni',
      type: 'fixed',
      color: 'text-indigo-300 border-indigo-500/40 font-semibold',
      highlight: false
    });
  }

  todaysFixed.forEach(block => {
    const norm = normalizeTimeRange(block.start || '08:30', block.end || '16:00', 60);
    busyIntervals.push({
      startMin: norm.startMin,
      endMin: norm.endMin,
      bufferAfterMin: 15
    });
    timeline.push({
      startMin: norm.startMin,
      endMin: norm.endMin,
      time: `${norm.start} - ${norm.end}`,
      title: `📌 ${block.title || 'Sabit Meşguliyet'}`,
      tag: 'Kişisel Düzen',
      type: 'fixed',
      color: 'text-indigo-300 border-indigo-500/40 font-semibold',
      highlight: false
    });
  });

  // 2. User's chosen workout program and custom hours
  if (!sportDayInfo.isRest && sportProg.id !== 'none') {
    const normSport = normalizeTimeRange(sportConfig?.start || '17:00', sportConfig?.end || '18:30', 90);
    let sportBufferMin = 30;
    if ((noteLower.includes('eve 7') || noteLower.includes('19:00')) && normSport.endMin < 19 * 60) {
      sportBufferMin = Math.max(30, 19 * 60 - normSport.endMin);
    }
    busyIntervals.push({
      startMin: normSport.startMin,
      endMin: normSport.endMin,
      bufferAfterMin: sportBufferMin
    });
    const noteSuffix = sportConfig?.customNote ? ` (${sportConfig.customNote})` : '';
    timeline.push({
      startMin: normSport.startMin,
      endMin: normSport.endMin,
      time: `${normSport.start} - ${normSport.end}`,
      title: `🏋️‍♂️ ${sportDayInfo.label}${noteSuffix}`,
      tag: 'Spor Antrenmanı',
      type: 'sport',
      color: 'text-amber-400 border-amber-500/40 font-bold',
      highlight: false
    });
  }

  // 3. Allocate Maarif TYT study blocks into free time windows (unless today is a Domino-shifted off-day)
  let hasCollisionWarning = false;
  if (isOffDay) {
    timeline.push({
      startMin: dayStartMin,
      endMin: dayStartMin + 60,
      time: 'Tam Gün Esnek',
      title: '🏖️ Sosyal / Dinlenme Günü (Domino Kaydırma Aktif — TYT dersleri sonraki güne aktarıldı)',
      tag: 'Domino Tatili',
      type: 'offday',
      color: 'text-amber-300 border-amber-500/40 font-bold',
      highlight: false
    });
  } else {
    const durations = tempo.studyBlocks.map(sb => sb.durationMin);
    const allocation = allocateFreeSlots(busyIntervals, durations, {
      startMin: dayStartMin,
      endMin: 23 * 60 + 30
    });
    hasCollisionWarning = allocation.hasCollisionWarning;

    const activeLesson = lesson || {
      subj: 'TYT Matematik',
      topic: 'Temel Kavramlar & Sayı Kümeleri',
      teacher: 'Mert Hoca'
    };

    tempo.studyBlocks.forEach((sb, idx) => {
      const slot = allocation.slots[idx];
      const titlePrefix = idx === 0
        ? `📘 ${activeLesson.subj}: ${activeLesson.topic} (${activeLesson.teacher}) — ${sb.label}`
        : `🎯 ${sb.label}`;
      timeline.push({
        startMin: slot.startMin,
        endMin: slot.endMin,
        time: `${slot.start} - ${slot.end}`,
        title: titlePrefix,
        tag: sb.tag,
        type: 'study',
        color: idx === 0
          ? 'text-emerald-400 border-emerald-500/50 font-bold'
          : 'text-sky-400 border-sky-500/40 font-semibold',
        highlight: true
      });
    });
  }

  timeline.sort((a, b) => a.startMin - b.startMin);

  return {
    dayKey,
    dayName,
    isOffDay: Boolean(isOffDay),
    sportInfo: {
      programName: sportProg.name,
      ...sportDayInfo,
      timeLabel: (!sportDayInfo.isRest && sportProg.id !== 'none')
        ? `${sportConfig?.start || '17:00'} - ${sportConfig?.end || '18:30'}`
        : 'Dinlenme / Spor Yok'
    },
    timeline,
    hasCollisionWarning
  };
}

export function getLessonFocusBadge(subj, topic) {
  const s = (subj || '').toLowerCase();
  const firstTopicWord = (topic || '').split(' ')[0] || '';

  if (s.includes('matematik') || s.includes('geometri')) {
    return {
      badge: `📐 ${subj}: ${firstTopicWord}`,
      style: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    };
  } else if (s.includes('türkçe')) {
    return {
      badge: `📚 ${subj}: Paragraf & Dil`,
      style: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    };
  } else if (s.includes('fizik')) {
    return {
      badge: `⚡ ${subj}: Kavram & Formül`,
      style: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    };
  } else if (s.includes('kimya')) {
    return {
      badge: `🧪 ${subj}: Madde & Reaksiyon`,
      style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    };
  } else if (s.includes('biyoloji')) {
    return {
      badge: `🧬 ${subj}: Sistem & Yaşam`,
      style: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
    };
  } else if (s.includes('deneme')) {
    return {
      badge: `📝 Genel TYT Prova & Analiz`,
      style: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    };
  }
  return {
    badge: `📖 ${subj}`,
    style: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
  };
}

