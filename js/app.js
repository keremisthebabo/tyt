import {
  ALL_DAYS,
  DAY_FULL_NAMES,
  MACRO_PHASES,
  MOTIVATION_QUOTES,
  SPORT_PROGRAMS,
  TEMPO_OPTIONS
} from './curriculum.js';
import {
  buildUnifiedDailySchedule,
  generateCampaignWeeks,
  getLessonFocusBadge,
  getSlotWithDominoShift,
  normalizeTimeRange,
  parseTimeToMinutes
} from './scheduler.js';
import { createAccountStore, createDefaultUserState } from './auth-storage.js';

const accountStore = createAccountStore();

let currentUser = null;
let userState = createDefaultUserState();
let campaignWeeks = generateCampaignWeeks('balanced');

// Wizard temporary state
let wizardStep = 1;
let wizardSelectedDays = ['Pzt'];
let wizardSchoolConfig = {
  enabled: true,
  title: 'Okul Saatleri',
  days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'],
  start: '08:00',
  end: '16:00'
};
let wizardFixedBlocks = [];
let wizardSportConfig = {
  programId: 'ppl',
  start: '17:00',
  end: '18:30',
  customNote: ''
};
let wizardTempoKey = 'balanced';
let wizardPreviewDayKey = 'Pzt';

// Audio & Alarm state
let audioCtx = null;
let alarmIntervalId = null;
let alarmWallClockId = null;
let alarmSnoozeTimeoutId = null;
let lastTriggeredAlarmStamp = '';
let isAlarmRinging = false;
let currentTriggeredVideoUrl = '';

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.innerText = String(text);
  return d.innerHTML;
}

function showToast(msg, icon = '✨') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  if (!toast || !toastMsg) return;
  if (toastIcon) toastIcon.innerText = icon;
  toastMsg.innerText = msg;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 3200);
}

function toggleModal(modalId, forceState = null) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (forceState === true) {
    modal.classList.remove('hidden');
  } else if (forceState === false) {
    modal.classList.add('hidden');
  } else {
    modal.classList.toggle('hidden');
  }
}

// ================= AUTHENTICATION CONTROLLER =================
function switchAuthTab(mode) {
  const loginForm = document.getElementById('auth-login-form');
  const registerForm = document.getElementById('auth-register-form');
  const loginTabBtn = document.getElementById('auth-tab-login');
  const registerTabBtn = document.getElementById('auth-tab-register');
  const errBox = document.getElementById('auth-error-box');
  if (errBox) errBox.classList.add('hidden');

  if (mode === 'register') {
    loginForm?.classList.add('hidden');
    registerForm?.classList.remove('hidden');
    if (registerTabBtn) {
      registerTabBtn.className = 'flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md';
    }
    if (loginTabBtn) {
      loginTabBtn.className = 'flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#0b101c] text-slate-400 hover:text-white border border-[#1e2c47]';
    }
  } else {
    registerForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
    if (loginTabBtn) {
      loginTabBtn.className = 'flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md';
    }
    if (registerTabBtn) {
      registerTabBtn.className = 'flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#0b101c] text-slate-400 hover:text-white border border-[#1e2c47]';
    }
  }
}

function showAuthError(message) {
  const errBox = document.getElementById('auth-error-box');
  if (!errBox) return;
  errBox.innerText = `⚠️ ${message}`;
  errBox.classList.remove('hidden');
}

function renderSavedAccountsPills() {
  const container = document.getElementById('saved-accounts-pills');
  const wrapper = document.getElementById('saved-accounts-wrapper');
  if (!container || !wrapper) return;
  const users = accountStore.listRegisteredUsers();
  if (users.length === 0) {
    wrapper.classList.add('hidden');
    return;
  }
  wrapper.classList.remove('hidden');
  container.innerHTML = users
    .map(
      u => `
      <button type="button" onclick="fillQuickLogin('${escapeHtml(u.email)}')" class="px-3 py-1.5 rounded-xl bg-[#0b101c] hover:bg-slate-800 border border-[#1e2c47] text-xs text-slate-200 flex items-center gap-1.5 transition">
        <span class="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[10px]">${escapeHtml(u.name.charAt(0).toUpperCase())}</span>
        <span>${escapeHtml(u.name)}</span>
      </button>
    `
    )
    .join('');
}

function fillQuickLogin(email) {
  switchAuthTab('login');
  const emailInput = document.getElementById('login-email-input');
  const passInput = document.getElementById('login-password-input');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.focus();
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('login-email-input')?.value || '';
  const password = document.getElementById('login-password-input')?.value || '';
  try {
    const session = await accountStore.loginUser({ email, password });
    onSessionEstablished(session.user, session.state, false);
    showToast(`Hoş geldin, ${session.user.name}!`, '👋');
  } catch (err) {
    showAuthError(err.message || 'Giriş yapılamadı.');
  }
}

async function handleRegisterSubmit(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('register-name-input')?.value || '';
  const email = document.getElementById('register-email-input')?.value || '';
  const password = document.getElementById('register-password-input')?.value || '';
  try {
    const session = await accountStore.registerUser({ name, email, password });
    onSessionEstablished(session.user, session.state, true);
    showToast(`Hesabın oluşturuldu ${session.user.name}! Şimdi kendi düzenini kuralım.`, '🎉');
  } catch (err) {
    showAuthError(err.message || 'Kayıt oluşturulamadı.');
  }
}

async function handleLogout() {
  await accountStore.logoutUser();
  currentUser = null;
  userState = createDefaultUserState();
  renderSavedAccountsPills();
  toggleModal('auth-modal', true);
  showToast('Hesaptan çıkış yapıldı.', '🔒');
}

function onSessionEstablished(user, state, isNewUser = false) {
  currentUser = user;
  userState = state;
  campaignWeeks = generateCampaignWeeks(userState.tempoKey || 'balanced');

  toggleModal('auth-modal', false);
  updateUserNavbarInfo();

  if (isNewUser || !userState.onboardingCompleted) {
    openOnboardingWizard(true);
  } else {
    refreshFullDashboard();
  }
}

function updateUserNavbarInfo() {
  const nameEl = document.getElementById('nav-user-name');
  const avatarEl = document.getElementById('nav-user-avatar');
  const tempoPillEl = document.getElementById('nav-tempo-pill');
  const sportPillEl = document.getElementById('header-sport-pill');

  if (nameEl && currentUser) nameEl.innerText = currentUser.name;
  if (avatarEl && currentUser) avatarEl.innerText = currentUser.name.charAt(0).toUpperCase();

  const tempoObj = TEMPO_OPTIONS[userState.tempoKey] || TEMPO_OPTIONS.balanced;
  const sportObj = SPORT_PROGRAMS.find(s => s.id === userState.sportConfig?.programId) || SPORT_PROGRAMS[0];

  if (tempoPillEl) tempoPillEl.innerText = tempoObj.badge;
  if (sportPillEl) {
    const timePart = sportObj.id === 'none'
      ? ''
      : ` (${userState.sportConfig?.start || '17:00'}-${userState.sportConfig?.end || '18:30'})`;
    sportPillEl.innerHTML = `<span>${sportObj.badge}${escapeHtml(timePart)}</span>`;
  }
}

// ================= 4-STEP PERSONAL ONBOARDING WIZARD =================
function openOnboardingWizard(isInitialSetup = false) {
  wizardStep = 1;
  wizardSelectedDays = ['Pzt'];
  wizardSchoolConfig = {
    enabled: userState.schoolConfig?.enabled !== false,
    title: userState.schoolConfig?.title || 'Okul Saatleri',
    days: Array.isArray(userState.schoolConfig?.days) ? [...userState.schoolConfig.days] : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'],
    start: userState.schoolConfig?.start || '08:00',
    end: userState.schoolConfig?.end || '16:00'
  };
  wizardFixedBlocks = Array.isArray(userState.fixedBlocks)
    ? userState.fixedBlocks.map(b => ({ ...b, days: [...(b.days || ['Pzt'])] }))
    : [];
  wizardSportConfig = {
    programId: userState.sportConfig?.programId || 'ppl',
    start: userState.sportConfig?.start || '17:00',
    end: userState.sportConfig?.end || '18:30',
    customNote: userState.sportConfig?.customNote || ''
  };
  wizardTempoKey = userState.tempoKey || 'balanced';
  wizardPreviewDayKey = 'Pzt';

  const closeBtn = document.getElementById('wizard-close-btn');
  if (closeBtn) {
    if (isInitialSetup && !userState.onboardingCompleted) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }

  const sStart = document.getElementById('wizard-sport-start');
  const sEnd = document.getElementById('wizard-sport-end');
  const sNote = document.getElementById('wizard-sport-note');
  if (sStart) sStart.value = wizardSportConfig.start;
  if (sEnd) sEnd.value = wizardSportConfig.end;
  if (sNote) sNote.value = wizardSportConfig.customNote;

  const schEnabled = document.getElementById('wizard-school-enabled');
  const schStart = document.getElementById('wizard-school-start');
  const schEnd = document.getElementById('wizard-school-end');
  if (schEnabled) schEnabled.checked = wizardSchoolConfig.enabled !== false;
  if (schStart) schStart.value = wizardSchoolConfig.start || '08:00';
  if (schEnd) schEnd.value = wizardSchoolConfig.end || '16:00';

  renderWizardDayPills();
  renderWizardFixedBlocks();
  renderWizardSportsGrid();
  renderWizardTempoCards();
  setWizardStep(1);
  toggleModal('onboarding-wizard-modal', true);
}

function setWizardStep(stepNum) {
  wizardStep = stepNum;
  [1, 2, 3, 4].forEach(n => {
    const panel = document.getElementById(`wizard-step-panel-${n}`);
    const tab = document.getElementById(`wizard-step-tab-${n}`);
    if (panel) panel.classList.toggle('hidden', n !== stepNum);
    if (tab) {
      tab.className =
        n === stepNum
          ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md transition'
          : 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0b101c] text-slate-400 border border-[#1e2c47] hover:text-white transition';
    }
  });

  if (stepNum === 4) {
    syncSportInputsFromDom();
    renderWizardUnifiedPreview();
  }
}

function renderWizardDayPills() {
  const container = document.getElementById('wizard-day-pills');
  if (!container) return;
  container.innerHTML = ALL_DAYS.map(day => {
    const active = wizardSelectedDays.includes(day);
    return `
      <button type="button" onclick="toggleWizardDayPill('${day}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${
        active
          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 border border-sky-400'
          : 'bg-[#0b101c] text-slate-400 border border-[#1e2c47] hover:text-white'
      }">
        ${day} ${active ? '✓' : ''}
      </button>
    `;
  }).join('');
}

function toggleWizardDayPill(dayKey) {
  if (wizardSelectedDays.includes(dayKey)) {
    if (wizardSelectedDays.length > 1) {
      wizardSelectedDays = wizardSelectedDays.filter(d => d !== dayKey);
    }
  } else {
    wizardSelectedDays.push(dayKey);
  }
  renderWizardDayPills();
}

function selectAllWeekdaysInWizard() {
  wizardSelectedDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
  renderWizardDayPills();
}

function selectWeekendInWizard() {
  wizardSelectedDays = ['Cmt', 'Paz'];
  renderWizardDayPills();
}

function addWizardFixedBlock() {
  const titleInput = document.getElementById('wizard-block-title');
  const startInput = document.getElementById('wizard-block-start');
  const endInput = document.getElementById('wizard-block-end');

  const rawTitle = (titleInput?.value || '').trim();
  if (!rawTitle) {
    showToast('Lütfen meşguliyet veya ders adını yazın (Örn: Okul, Matematik Özel Ders).', '⚠️');
    titleInput?.focus();
    return;
  }

  const norm = normalizeTimeRange(startInput?.value || '08:30', endInput?.value || '16:00', 60);
  wizardFixedBlocks.push({
    id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: rawTitle,
    days: [...wizardSelectedDays],
    start: norm.start,
    end: norm.end
  });

  if (titleInput) titleInput.value = '';
  renderWizardFixedBlocks();
  showToast(`"${rawTitle}" bloğu (${norm.start} - ${norm.end}) düzenine eklendi!`, '📌');
}

function removeWizardFixedBlock(idx) {
  wizardFixedBlocks.splice(idx, 1);
  renderWizardFixedBlocks();
}

function renderWizardFixedBlocks() {
  const container = document.getElementById('wizard-fixed-blocks-list');
  const countBadge = document.getElementById('wizard-blocks-count');
  if (countBadge) countBadge.innerText = `${wizardFixedBlocks.length} Blok`;
  if (!container) return;

  if (wizardFixedBlocks.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-5 rounded-2xl bg-[#0b101c] border border-dashed border-[#1e2c47] text-center space-y-1">
        <div class="text-xs font-bold text-slate-300">Henüz sabit bir meşguliyet bloğu eklemediniz</div>
        <p class="text-[11px] text-slate-400">Okul, dershane, özel ders veya kurs saatlerinizi yukarıdan günlerini ve saatlerini seçerek ekleyin. Eklediğiniz saatlere asla TYT dersi koyulmaz.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = wizardFixedBlocks
    .map(
      (b, idx) => `
      <div class="p-3.5 rounded-2xl bg-[#0b101c] border border-[#1e2c47] flex flex-col justify-between gap-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-1.5">
              <span>📌</span> <span>${escapeHtml(b.title)}</span>
            </div>
            <div class="text-[11px] text-sky-400 font-semibold mt-0.5">${escapeHtml(b.days.join(', '))}</div>
          </div>
          <button type="button" onclick="removeWizardFixedBlock(${idx})" class="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded-lg bg-slate-800/70 transition" title="Bloğu Sil">✕</button>
        </div>
        <div class="text-[11px] font-mono text-slate-300 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-[#1e2c47]/80 self-start">
          ⏰ ${escapeHtml(b.start)} - ${escapeHtml(b.end)}
        </div>
      </div>
    `
    )
    .join('');
}

function syncSportInputsFromDom() {
  const schEnabledEl = document.getElementById('wizard-school-enabled');
  const schStartEl = document.getElementById('wizard-school-start');
  const schEndEl = document.getElementById('wizard-school-end');
  if (schEnabledEl) {
    wizardSchoolConfig.enabled = Boolean(schEnabledEl.checked);
  }
  if (schStartEl || schEndEl) {
    const normSch = normalizeTimeRange(
      schStartEl?.value || wizardSchoolConfig.start || '08:00',
      schEndEl?.value || wizardSchoolConfig.end || '16:00',
      480
    );
    wizardSchoolConfig.start = normSch.start;
    wizardSchoolConfig.end = normSch.end;
  }

  const sStart = document.getElementById('wizard-sport-start')?.value || '17:00';
  const sEnd = document.getElementById('wizard-sport-end')?.value || '18:30';
  const sNote = (document.getElementById('wizard-sport-note')?.value || '').trim();
  const norm = normalizeTimeRange(sStart, sEnd, 90);
  wizardSportConfig.start = norm.start;
  wizardSportConfig.end = norm.end;
  wizardSportConfig.customNote = sNote;
}

function selectWizardSportProgram(programId) {
  wizardSportConfig.programId = programId;
  syncSportInputsFromDom();
  renderWizardSportsGrid();
}

function renderWizardSportsGrid() {
  const container = document.getElementById('wizard-sports-grid');
  if (!container) return;

  container.innerHTML = SPORT_PROGRAMS.map(sp => {
    const active = sp.id === wizardSportConfig.programId;
    const sampleDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum']
      .map(d => `${d}: ${sp.dayMap[d].isRest ? 'Off' : sp.dayMap[d].badge.replace('Spor: ', '')}`)
      .join(' • ');
    return `
      <div onclick="selectWizardSportProgram('${sp.id}')" class="cursor-pointer p-3.5 rounded-2xl transition flex flex-col justify-between gap-2 ${
        active
          ? 'bg-gradient-to-b from-amber-500/20 to-[#0b101c] border-2 border-amber-400 shadow-lg shadow-amber-500/10'
          : 'bg-[#0b101c] border border-[#1e2c47] hover:border-slate-600'
      }">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-extrabold text-white">${sp.name}</span>
            ${active ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black">SEÇİLİ ✓</span>' : ''}
          </div>
          <p class="text-[11px] text-slate-400 mt-1">${sp.cycleDesc}</p>
        </div>
        <div class="text-[10px] text-amber-300/90 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-[#1e2c47]/80 truncate">
          ${sampleDays}
        </div>
      </div>
    `;
  }).join('');
}

function selectWizardTempo(tempoKey) {
  wizardTempoKey = tempoKey;
  renderWizardTempoCards();
}

function renderWizardTempoCards() {
  const container = document.getElementById('wizard-tempo-grid');
  if (!container) return;

  container.innerHTML = Object.values(TEMPO_OPTIONS)
    .map(tp => {
      const active = tp.id === wizardTempoKey;
      return `
      <div onclick="selectWizardTempo('${tp.id}')" class="cursor-pointer p-4 rounded-2xl transition flex flex-col justify-between gap-3 ${
        active
          ? 'bg-gradient-to-b from-sky-500/20 to-[#0b101c] border-2 border-sky-400 shadow-lg shadow-sky-500/15'
          : 'bg-[#0b101c] border border-[#1e2c47] hover:border-slate-600'
      }">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-black text-white">${tp.name}</span>
            <span class="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold ${
              active ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'
            }">${tp.totalWeeks} Hafta</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900/90 border border-[#1e2c47] text-xs font-bold text-emerald-400">
            🎯 ${tp.exampleLabel}
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">${tp.desc}</p>
        </div>
        <div class="pt-2 border-t border-[#1e2c47]/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Günlük ${tp.studyBlocks.length} TYT Çalışma Bloğu</span>
          <span class="font-bold ${active ? 'text-sky-400' : 'text-slate-500'}">${active ? '● Seçildi' : '○ Seç'}</span>
        </div>
      </div>
    `;
    })
    .join('');
}

function setWizardPreviewDay(dayKey) {
  wizardPreviewDayKey = dayKey;
  renderWizardUnifiedPreview();
}

function renderWizardUnifiedPreview() {
  syncSportInputsFromDom();
  const previewWeeks = generateCampaignWeeks(wizardTempoKey);
  const dayIdx = Math.max(0, ALL_DAYS.indexOf(wizardPreviewDayKey));
  const sampleLesson = previewWeeks[0].days[dayIdx];

  const unified = buildUnifiedDailySchedule({
    dayKey: wizardPreviewDayKey,
    schoolConfig: wizardSchoolConfig,
    fixedBlocks: wizardFixedBlocks,
    sportConfig: wizardSportConfig,
    tempoKey: wizardTempoKey,
    lesson: sampleLesson
  });

  const summaryBanner = document.getElementById('wizard-unified-summary');
  const tempoObj = TEMPO_OPTIONS[wizardTempoKey] || TEMPO_OPTIONS.balanced;
  const sportObj = SPORT_PROGRAMS.find(s => s.id === wizardSportConfig.programId) || SPORT_PROGRAMS[0];

  if (summaryBanner) {
    summaryBanner.innerHTML = `
      <div class="flex flex-wrap items-center gap-2">
        ${
          wizardSchoolConfig.enabled !== false
            ? `<span class="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">🏫 Okul (${wizardSchoolConfig.start}-${wizardSchoolConfig.end})</span>`
            : ''
        }
        <span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">${sportObj.name} (${wizardSportConfig.start}-${wizardSportConfig.end})</span>
        <span class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold">${tempoObj.badge}</span>
        <span class="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">${wizardFixedBlocks.length} Kişisel Blok</span>
        ${
          unified.hasCollisionWarning
            ? `<span class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">⚠️ Yoğun Gün: Çalışma blokları kalan en geniş aralıklara sıkıştırıldı</span>`
            : ''
        }
      </div>
    `;
  }

  const dayTabs = document.getElementById('wizard-preview-day-tabs');
  if (dayTabs) {
    dayTabs.innerHTML = ALL_DAYS.map(d => `
      <button type="button" onclick="setWizardPreviewDay('${d}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${
        d === wizardPreviewDayKey
          ? 'bg-sky-500 text-white shadow-sm'
          : 'bg-[#0b101c] text-slate-400 border border-[#1e2c47] hover:text-white'
      }">${DAY_FULL_NAMES[d]}</button>
    `).join('');
  }

  const timelineContainer = document.getElementById('wizard-unified-timeline');
  if (timelineContainer) {
    timelineContainer.innerHTML = unified.timeline
      .map(
        item => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border ${
          item.highlight
            ? 'bg-emerald-950/25 border-emerald-500/50 text-white'
            : 'bg-[#0b101c] border-[#1e2c47] text-slate-200'
        }">
          <div class="flex items-center gap-2.5">
            <span class="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 border border-[#1e2c47] text-sky-300 shrink-0">${item.time}</span>
            <span class="text-xs font-semibold">${escapeHtml(item.title)}</span>
          </div>
          <span class="text-[10px] px-2.5 py-0.5 rounded-md border ${item.color} self-start sm:self-auto shrink-0">
            ${escapeHtml(item.tag)}
          </span>
        </div>
      `
      )
      .join('');
  }
}

async function saveAndFinishOnboarding() {
  if (!currentUser) return;
  syncSportInputsFromDom();
  userState = await accountStore.updateOnboardingConfig(currentUser.id, {
    schoolConfig: wizardSchoolConfig,
    fixedBlocks: wizardFixedBlocks,
    sportConfig: wizardSportConfig,
    tempoKey: wizardTempoKey
  });

  campaignWeeks = generateCampaignWeeks(userState.tempoKey);
  if (userState.activeWeek > campaignWeeks.length) {
    userState = await accountStore.saveUserState(currentUser.id, { activeWeek: 1 });
  }

  toggleModal('onboarding-wizard-modal', false);
  updateUserNavbarInfo();
  refreshFullDashboard();
  showToast('Kişisel Maarif TYT ve Spor programın birleştirildi ve kaydedildi!', '🚀');
}

// ================= DASHBOARD & SCHEDULE RENDERING =================
function refreshFullDashboard() {
  campaignWeeks = generateCampaignWeeks(userState.tempoKey || 'balanced');
  const activeWeek = Math.min(Math.max(1, userState.activeWeek || 1), campaignWeeks.length);
  renderWeekTabs();
  loadWeek(activeWeek);
  renderNotes();
  buildFullRoadmapModal();
  renderShiftedModal();
  initAlarmSystem();
}

function renderWeekTabs() {
  const container = document.getElementById('week-tabs-container');
  const labelRange = document.getElementById('week-selector-range-label');
  if (labelRange) labelRange.innerText = `Kamp Haftasını Seç (1 - ${campaignWeeks.length}):`;
  if (!container) return;
  container.innerHTML = '';

  campaignWeeks.forEach(w => {
    const isCurrent = w.weekNum === userState.activeWeek;
    let weekCompletedDays = 0;
    let weekShiftedDays = 0;
    for (let d = 0; d < 7; d++) {
      const globalSlot = (w.weekNum - 1) * 7 + d;
      if (userState.progress?.[`slot_${globalSlot}`]) {
        weekCompletedDays++;
      } else if (userState.offDays?.[globalSlot]) {
        weekShiftedDays++;
      }
    }

    const btn = document.createElement('button');
    btn.id = `week-tab-btn-${w.weekNum}`;
    btn.onclick = () => loadWeek(w.weekNum);
    btn.className = `flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border select-none ${
      isCurrent
        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white border-sky-400 shadow-md shadow-sky-500/25 scale-[1.02]'
        : 'bg-[#131b2e] text-slate-300 border-[#1e2c47] hover:border-slate-600 hover:bg-slate-800'
    }`;

    let statusBadges = '';
    if (weekCompletedDays > 0) {
      statusBadges += `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${
        isCurrent ? 'bg-black/30 text-emerald-300' : 'bg-emerald-500/20 text-emerald-400 font-bold'
      }">${weekCompletedDays}/7✓</span>`;
    }
    if (weekShiftedDays > 0) {
      statusBadges += `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${
        isCurrent ? 'bg-rose-950/60 text-rose-200' : 'bg-rose-500/20 text-rose-300 font-bold'
      }">${weekShiftedDays}🏖️</span>`;
    }

    btn.innerHTML = `<span>${w.weekNum}. Hafta</span>${statusBadges}`;
    container.appendChild(btn);
  });
}

async function loadWeek(weekNum) {
  userState.activeWeek = weekNum;
  if (currentUser) {
    await accountStore.saveUserState(currentUser.id, { activeWeek: weekNum });
  }

  const weekData = campaignWeeks.find(w => w.weekNum === weekNum) || campaignWeeks[0];

  const phaseBadge = document.getElementById('current-phase-badge');
  if (phaseBadge && weekData) {
    phaseBadge.innerText = weekData.phaseName;
    phaseBadge.className = `text-[11px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-md border ${weekData.phaseColor}`;
  }

  const activeTitle = document.getElementById('active-week-title');
  if (activeTitle && weekData) activeTitle.innerText = weekData.title;

  const activeDesc = document.getElementById('active-week-desc');
  if (activeDesc && weekData) activeDesc.innerText = weekData.desc;

  const weekLabel = document.getElementById('week-header-label');
  if (weekLabel && weekData) {
    weekLabel.innerHTML = `<span>📅</span> ${weekData.weekNum}. Hafta Kişisel Ders & Spor Birleşik Akışı`;
  }

  renderActiveDays(weekData);
  renderWeekTabs();
  updateMacroStats();
}

function renderActiveDays(weekData) {
  const grid = document.getElementById('active-days-grid');
  if (!grid || !weekData) return;
  grid.innerHTML = '';

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const globalSlotIndex = (weekData.weekNum - 1) * 7 + dayIndex;
    const dayKey = ALL_DAYS[dayIndex];
    const dayName = DAY_FULL_NAMES[dayKey];
    const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlotIndex, userState.offDays || {});
    const storageKey = `slot_${globalSlotIndex}`;
    const isDone = Boolean(userState.progress?.[storageKey]);

    const unified = buildUnifiedDailySchedule({
      dayKey,
      schoolConfig: userState.schoolConfig,
      fixedBlocks: userState.fixedBlocks || [],
      sportConfig: userState.sportConfig,
      tempoKey: userState.tempoKey || 'balanced',
      lesson: slotResult.lesson,
      isOffDay: slotResult.isOffDay,
      dayStartMin: parseTimeToMinutes(userState.alarm?.time || '08:00')
    });

    const card = document.createElement('div');

    if (slotResult.isOffDay) {
      card.className =
        'rounded-2xl p-5 border border-amber-500/50 bg-[#161a29] shadow-lg flex flex-col justify-between space-y-4 ring-1 ring-amber-500/20';
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-1.5 mb-2.5">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1">
              <span>🏖️</span> Sosyal / Dinlenme Günü
            </span>
            <button onclick="undoShiftDay(${globalSlotIndex})" class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1">
              <span>↩</span> Kaydırmayı Geri Al
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 mb-3">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${unified.sportInfo.color}">
              ${unified.sportInfo.badge}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
              🏖️ Ders Kaydırıldı
            </span>
          </div>

          <h4 class="text-sm sm:text-base font-bold text-white mb-1.5 leading-snug">
            <span class="text-amber-400">${dayName}:</span> Dışarı Çıkıldı & Zihin Şarjı
          </h4>

          <div class="bg-[#0b101c] rounded-xl p-3 border border-amber-500/20 space-y-1.5 my-3 text-xs">
            <div class="text-amber-300 font-semibold flex items-center gap-1.5">
              <span>⚡</span> Domino Kaydırma Aktif:
            </div>
            <p class="text-slate-300 text-[11px] leading-relaxed">
              Bu günün dersi ve takip eden tüm müfredat tam olarak <strong>1 gün sonraya</strong> ötelendi.
            </p>
          </div>
        </div>

        <div class="pt-2 border-t border-[#1e2c47] flex items-center justify-between gap-2">
          <button onclick="openHourlyModal(${dayIndex})" class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition">
            <span>⏱️</span> Günün Birleşik Saatleri
          </button>
          <button onclick="undoShiftDay(${globalSlotIndex})" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition">
            Normal Derse Dön
          </button>
        </div>
      `;
      grid.appendChild(card);
      continue;
    }

    const item = slotResult.lesson;
    const isCascadeShifted = slotResult.isCascadeShifted;
    const dynamicLessonBadge = getLessonFocusBadge(item.subj, item.topic);
    const todaysUserFixed = (userState.fixedBlocks || []).filter(b => b.days?.includes(dayKey));
    const studySlots = unified.timeline.filter(t => t.type === 'study');
    const studyTimesSummary = studySlots.map(s => s.time).join(' & ');

    card.className = `rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
      isDone
        ? 'bg-[#0c1424]/80 border-emerald-500/40 shadow-sm opacity-90'
        : isCascadeShifted
        ? 'bg-[#151d33] border-amber-500/40 hover:border-amber-400/60 shadow-lg ring-1 ring-amber-500/10'
        : 'bg-[#131b2e] border-[#1e2c47] hover:border-slate-700 hover:bg-[#1a243d] shadow-lg'
    }`;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-1.5 mb-2.5">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-400 border-sky-500/25">
              ${escapeHtml(item.subj)}
            </span>
            ${
              isCascadeShifted
                ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1">
                    <span>⚡</span> ${item.origWeek}. Hafta ${escapeHtml(item.origDay)}'den Kaydı
                  </span>`
                : ''
            }
          </div>

          <div class="flex items-center gap-2">
            <button onclick="markDayShifted(${weekData.weekNum}, ${dayIndex})" class="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-400 border border-slate-700 transition flex items-center gap-1" title="Dışarı çıktıysan dersi ileri kaydır">
              <span>🏖️</span> Dışarı Çıktım
            </button>

            <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${isDone ? 'text-emerald-400' : 'text-slate-400'}">
              <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleDayStatus('${storageKey}')" class="w-4 h-4 rounded accent-emerald-500 cursor-pointer">
              <span>${isDone ? 'Bitti ✓' : 'Hedef'}</span>
            </label>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 mb-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${unified.sportInfo.color}">
            ${unified.sportInfo.badge} ${!unified.sportInfo.isRest ? `(${unified.sportInfo.timeLabel})` : ''}
          </span>
          ${
            todaysUserFixed.length > 0
              ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                  📌 ${escapeHtml(todaysUserFixed[0].title)} (${todaysUserFixed[0].start}-${todaysUserFixed[0].end})${todaysUserFixed.length > 1 ? ` +${todaysUserFixed.length - 1}` : ''}
                </span>`
              : `<span class="text-[10px] font-bold px-2 py-0.5 rounded border ${dynamicLessonBadge.style}">
                  ${escapeHtml(dynamicLessonBadge.badge)}
                </span>`
          }
        </div>

        <h4 class="text-sm sm:text-base font-bold text-white mb-1.5 leading-snug">
          <span class="${isCascadeShifted ? 'text-amber-300' : 'text-sky-400'}">${dayName}:</span> ${escapeHtml(item.topic)}
        </h4>

        <div class="bg-[#0b101c] rounded-xl p-3 border border-[#1e2c47] space-y-1.5 my-3 text-xs">
          <div class="flex items-center justify-between text-slate-300 gap-2">
            <span class="text-slate-400 shrink-0">⏰ TYT Saatlerin:</span>
            <span class="font-mono font-bold text-emerald-400 text-right">${escapeHtml(studyTimesSummary)}</span>
          </div>
          ${
            unified.hasCollisionWarning
              ? `<div class="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1">
                  ⚠️ Yoğun program: Çalışma saatleri mevcut en geniş boş aralıklara sıkıştırıldı.
                </div>`
              : ''
          }
          <div class="flex items-center justify-between text-slate-300 gap-2">
            <span class="text-slate-400 shrink-0">🎯 TYT Hedefi:</span>
            <span class="font-medium text-slate-200 text-right">${escapeHtml(item.target)}</span>
          </div>
          <div class="flex items-center justify-between text-slate-300 gap-2">
            <span class="text-slate-400 shrink-0">👨‍🏫 Eğitmen:</span>
            <span class="font-semibold text-sky-400 text-right">${escapeHtml(item.teacher)}</span>
          </div>
          <div class="text-[11px] text-slate-400 pt-1.5 border-t border-[#1e2c47]/80 italic">
            💡 <span>${escapeHtml(item.note)}</span>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-[#1e2c47] space-y-2">
        <a href="${item.directUrl}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-red-900/30 transition active:scale-95">
          <span>▶ Doğrudan Dersi Başlat (YouTube)</span>
        </a>

        <div class="flex items-center gap-2">
          <button onclick="openHourlyModal(${dayIndex})" class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition">
            <span>⏱️</span> Birleşik Saatlik Plan
          </button>

          <button onclick="shareSlotTelegram(${globalSlotIndex})" title="Günün Planını Telegram'a Gönder" class="inline-flex items-center justify-center p-2.5 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] border border-[#229ED9]/30 transition shrink-0 text-xs font-bold">
            ✈️
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  }
}

async function toggleDayStatus(storageKey) {
  if (!currentUser) return;
  const nextProgress = { ...(userState.progress || {}) };
  nextProgress[storageKey] = !nextProgress[storageKey];
  userState = await accountStore.saveUserState(currentUser.id, { progress: nextProgress });

  const weekData = campaignWeeks.find(w => w.weekNum === userState.activeWeek);
  renderActiveDays(weekData);
  renderWeekTabs();
  updateMacroStats();

  if (nextProgress[storageKey]) {
    showToast('Harika! Günlük hedef tamamlandı!', '🎉');
  } else {
    showToast('Görev tekrar aktif edildi.', '🔄');
  }
}

function updateMacroStats() {
  const totalDaysInCamp = campaignWeeks.length * 7;
  let totalCompletedDays = 0;
  let totalShiftedDays = 0;

  for (let slot = 0; slot < totalDaysInCamp; slot++) {
    if (userState.progress?.[`slot_${slot}`]) {
      totalCompletedDays++;
    } else if (userState.offDays?.[slot]) {
      totalShiftedDays++;
    }
  }

  const totalRemainingDays = Math.max(0, totalDaysInCamp - (totalCompletedDays + totalShiftedDays));
  const macroPercent = Math.round((totalCompletedDays / totalDaysInCamp) * 100);
  const macroShiftedPercent = (totalShiftedDays / totalDaysInCamp) * 100;
  const macroDonePercent = (totalCompletedDays / totalDaysInCamp) * 100;

  const totalLabel = document.getElementById('macro-total-days-label');
  if (totalLabel) totalLabel.innerText = `Genel TYT Başarısı (${totalDaysInCamp} Gün / ${campaignWeeks.length} Hafta):`;

  const pEl = document.getElementById('macro-percent');
  if (pEl) pEl.innerText = `${macroPercent}%`;
  const mDone = document.getElementById('macro-bar-fill-done');
  if (mDone) mDone.style.width = `${macroDonePercent}%`;
  const mShift = document.getElementById('macro-bar-fill-shifted');
  if (mShift) mShift.style.width = `${macroShiftedPercent}%`;

  const mDoneCount = document.getElementById('macro-done-count');
  if (mDoneCount) mDoneCount.innerText = `${totalCompletedDays}`;
  const mShiftCount = document.getElementById('macro-shifted-count');
  if (mShiftCount) mShiftCount.innerText = `${totalShiftedDays}`;
  const mRemCount = document.getElementById('macro-remaining-count');
  if (mRemCount) mRemCount.innerText = `${totalRemainingDays}`;

  let currentWeekCompleted = 0;
  let currentWeekShifted = 0;
  for (let d = 0; d < 7; d++) {
    const slot = (userState.activeWeek - 1) * 7 + d;
    if (userState.progress?.[`slot_${slot}`]) {
      currentWeekCompleted++;
    } else if (userState.offDays?.[slot]) {
      currentWeekShifted++;
    }
  }

  const currentWeekRemaining = Math.max(0, 7 - (currentWeekCompleted + currentWeekShifted));
  const weekPercent = Math.round((currentWeekCompleted / 7) * 100);
  const weekDonePercent = (currentWeekCompleted / 7) * 100;
  const weekShiftedPercent = (currentWeekShifted / 7) * 100;

  const wPer = document.getElementById('week-percent');
  if (wPer) wPer.innerText = `${weekPercent}%`;
  const wDone = document.getElementById('week-bar-fill-done');
  if (wDone) wDone.style.width = `${weekDonePercent}%`;
  const wShift = document.getElementById('week-bar-fill-shifted');
  if (wShift) wShift.style.width = `${weekShiftedPercent}%`;

  const wDet = document.getElementById('week-details-text');
  if (wDet) wDet.innerText = `${currentWeekCompleted} Bitti • ${currentWeekShifted} Kaydırıldı`;
  const wRem = document.getElementById('week-remaining-text');
  if (wRem) wRem.innerText = `${currentWeekRemaining} Gün Kalan`;
}

// ================= DOMINO DAY-SHIFTING =================
async function markDayShifted(weekNum, dayIndex) {
  if (!currentUser) return;
  const globalSlotIndex = (weekNum - 1) * 7 + dayIndex;
  const slotData = getSlotWithDominoShift(campaignWeeks, globalSlotIndex, userState.offDays || {});
  const dayName = DAY_FULL_NAMES[ALL_DAYS[dayIndex]];

  const nextOffDays = { ...(userState.offDays || {}) };
  nextOffDays[globalSlotIndex] = {
    weekNum,
    dayIndex,
    dayName,
    shiftedDate: new Date().toLocaleDateString('tr-TR'),
    originalTopic: slotData.isOffDay ? 'Dinlenme Günü' : slotData.lesson.topic
  };

  const nextProgress = { ...(userState.progress || {}) };
  delete nextProgress[`slot_${globalSlotIndex}`];

  userState = await accountStore.saveUserState(currentUser.id, {
    offDays: nextOffDays,
    progress: nextProgress
  });

  loadWeek(userState.activeWeek);
  renderShiftedModal();
  showToast(`${dayName} dinlenme yapıldı! Kalan tüm dersler 1 gün ileri kaydırıldı.`, '⚡');
}

async function undoShiftDay(globalSlotIndex) {
  if (!currentUser || !userState.offDays?.[globalSlotIndex]) return;
  const item = userState.offDays[globalSlotIndex];
  const nextOffDays = { ...userState.offDays };
  delete nextOffDays[globalSlotIndex];

  userState = await accountStore.saveUserState(currentUser.id, { offDays: nextOffDays });
  loadWeek(userState.activeWeek);
  renderShiftedModal();
  showToast(`Hafta ${item.weekNum} ${item.dayName} kaydırması geri alındı.`, '↩️');
}

function renderShiftedModal() {
  const container = document.getElementById('shifted-lessons-container');
  const badge = document.getElementById('shifted-count-badge');
  const headerBadge = document.getElementById('shifted-header-badge');

  const offDays = userState.offDays || {};
  const offKeys = Object.keys(offDays).map(Number).sort((a, b) => a - b);
  const count = offKeys.length;

  if (badge) badge.innerText = count;
  if (headerBadge) {
    if (count > 0) {
      headerBadge.classList.remove('hidden');
      headerBadge.innerHTML = `<span>⚡</span> Zincirleme Kaydırma Aktif (${count} Gün)`;
    } else {
      headerBadge.classList.add('hidden');
    }
  }

  if (!container) return;
  container.innerHTML = '';

  if (count === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-500 text-xs border border-dashed border-[#1e2c47] rounded-2xl">
        Henüz kaydırılan bir gün yok. Dışarı çıktığın günlerde karttaki <strong>"🏖️ Dışarı Çıktım"</strong> tuşuna basarsan o gün dinlenme olur ve sonraki tüm dersler domino gibi 1 gün ileri kayar.
      </div>
    `;
    return;
  }

  offKeys.forEach(slotIdx => {
    const item = offDays[slotIdx];
    const div = document.createElement('div');
    div.className =
      'bg-[#0b101c] border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs';
    div.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-amber-400">Hafta ${item.weekNum} • ${escapeHtml(item.dayName)}</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">🏖️ Dinlenme Günü</span>
        </div>
        <div class="text-white font-medium">Ötelenen Konu: ${escapeHtml(item.originalTopic || '')}</div>
        <div class="text-[11px] text-slate-400">📅 Tarih: ${escapeHtml(item.shiftedDate)}</div>
      </div>
      <div>
        <button onclick="undoShiftDay(${slotIdx})" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition flex items-center gap-1.5">
          <span>↩</span> Kaydırmayı Geri Al
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function resetCurrentWeek() {
  if (!currentUser) return;
  const nextProgress = { ...(userState.progress || {}) };
  const nextOffDays = { ...(userState.offDays || {}) };
  for (let d = 0; d < 7; d++) {
    const globalSlot = (userState.activeWeek - 1) * 7 + d;
    delete nextProgress[`slot_${globalSlot}`];
    delete nextOffDays[globalSlot];
  }
  userState = await accountStore.saveUserState(currentUser.id, {
    progress: nextProgress,
    offDays: nextOffDays
  });
  loadWeek(userState.activeWeek);
  renderShiftedModal();
  showToast(`Hafta ${userState.activeWeek} sıfırlandı.`, '🔄');
}

// ================= UNIFIED HOURLY ROUTINE MODAL =================
function openHourlyModal(preSelectDay = 'all') {
  filterRoutineDay(preSelectDay);
  toggleModal('hourly-routine-modal', true);
}

function filterRoutineDay(filter) {
  const btns = document.querySelectorAll('.routine-filter-btn');
  btns.forEach((b, idx) => {
    const isMatch = (filter === 'all' && idx === 7) || filter === idx;
    b.className = isMatch
      ? 'routine-filter-btn px-3 py-1.5 rounded-xl font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30'
      : 'routine-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 border border-slate-700';
  });
  buildRoutineScheduleModal(filter);
}

function buildRoutineScheduleModal(filter = 'all') {
  const container = document.getElementById('routine-schedule-container');
  if (!container) return;
  container.innerHTML = '';

  const indices = filter === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [Number(filter)];
  const currentWeek = campaignWeeks.find(w => w.weekNum === userState.activeWeek) || campaignWeeks[0];

  indices.forEach(dIdx => {
    const globalSlot = (currentWeek.weekNum - 1) * 7 + dIdx;
    const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlot, userState.offDays || {});
    const dayKey = ALL_DAYS[dIdx];
    const unified = buildUnifiedDailySchedule({
      dayKey,
      schoolConfig: userState.schoolConfig,
      fixedBlocks: userState.fixedBlocks || [],
      sportConfig: userState.sportConfig,
      tempoKey: userState.tempoKey || 'balanced',
      lesson: slotResult.lesson,
      isOffDay: slotResult.isOffDay,
      dayStartMin: parseTimeToMinutes(userState.alarm?.time || '08:00')
    });

    const blockWrapper = document.createElement('div');
    blockWrapper.className = 'bg-[#0b101c] border border-[#1e2c47] rounded-2xl p-4 space-y-3';

    const blocksHtml = unified.timeline
      .map(
        b => `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border ${b.color} gap-2 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono text-slate-300 font-bold shrink-0 text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-[#1e2c47]">${b.time}</span>
          <span class="text-white font-medium">${escapeHtml(b.title)}</span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-md border ${b.color} self-start sm:self-auto font-semibold">
          ${escapeHtml(b.tag)}
        </span>
      </div>
    `
      )
      .join('');

    blockWrapper.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1e2c47]/60">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-white">${unified.dayName} (${currentWeek.weekNum}. Hafta)</span>
          <span class="text-[10px] px-2 py-0.5 rounded border ${unified.sportInfo.color} font-semibold">${unified.sportInfo.badge}</span>
          ${
            unified.hasCollisionWarning
              ? `<span class="text-[10px] px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-300 font-semibold">⚠️ Sıkıştırılmış Gün</span>`
              : ''
          }
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300 font-semibold">
          ${TEMPO_OPTIONS[userState.tempoKey]?.badge || 'Dengeli Program'}
        </span>
      </div>
      <div class="space-y-1.5">
        ${blocksHtml}
      </div>
    `;
    container.appendChild(blockWrapper);
  });
}

// ================= MISTAKE NOTEBOOK (YANLIŞ DEFTERİ) =================
function renderNotes() {
  const container = document.getElementById('notes-container');
  const countEl = document.getElementById('saved-notes-count');
  if (!container || !countEl) return;
  const notes = userState.notes || [];
  container.innerHTML = '';
  countEl.innerText = `${notes.length} Not`;

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 text-xs border border-dashed border-[#1e2c47] rounded-xl">
        Henüz eklenmiş soru analizi yok. Özel derste, okulda veya denemelerde takıldığın soruları buraya kaydet.
      </div>
    `;
    return;
  }

  notes
    .slice()
    .reverse()
    .forEach((note, index) => {
      const actualIdx = notes.length - 1 - index;
      const div = document.createElement('div');
      div.className = 'bg-[#0b101c] border border-[#1e2c47] rounded-xl p-3.5 flex flex-col justify-between gap-2 text-xs';
      div.innerHTML = `
        <div>
          <div class="flex justify-between items-start gap-2 mb-1">
            <span class="font-bold text-sky-400">${escapeHtml(note.topic)}</span>
            <span class="text-[10px] text-slate-500">${escapeHtml(note.date)}</span>
          </div>
          <p class="text-slate-300 leading-relaxed">${escapeHtml(note.body)}</p>
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-[#1e2c47]/70">
          <button onclick="shareSingleNoteTelegram(${actualIdx})" class="text-[#229ED9] hover:underline text-[11px] flex items-center gap-1 font-medium">
            <span>✈️</span> Telegram'a Gönder
          </button>
          <button onclick="deleteNote(${actualIdx})" class="text-rose-400 hover:text-rose-300 text-[11px]">Sil</button>
        </div>
      `;
      container.appendChild(div);
    });
}

async function addMistakeNote() {
  if (!currentUser) return;
  const tInput = document.getElementById('note-topic-input');
  const bInput = document.getElementById('note-body-input');
  const topic = (tInput?.value || '').trim();
  const body = (bInput?.value || '').trim();

  if (!topic || !body) {
    showToast('Lütfen konu başlığı ve hata analizi açıklaması gir.', '⚠️');
    return;
  }

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const nextNotes = [...(userState.notes || []), { topic, body, date: dateStr }];
  userState = await accountStore.saveUserState(currentUser.id, { notes: nextNotes });

  if (tInput) tInput.value = '';
  if (bInput) bInput.value = '';
  renderNotes();
  showToast('Yanlış defterine eklendi!', '📝');
}

async function deleteNote(index) {
  if (!currentUser) return;
  const nextNotes = [...(userState.notes || [])];
  nextNotes.splice(index, 1);
  userState = await accountStore.saveUserState(currentUser.id, { notes: nextNotes });
  renderNotes();
  showToast('Not silindi.', '🗑️');
}

// ================= ROADMAP, TELEGRAM & CLOUD SETTINGS =================
function buildFullRoadmapModal() {
  const container = document.getElementById('roadmap-table-content');
  if (!container) return;
  container.innerHTML = '';

  MACRO_PHASES.forEach(phase => {
    const phaseWeeks = campaignWeeks.filter(w => w.phaseId === phase.id);
    if (phaseWeeks.length === 0) return;

    const phaseDiv = document.createElement('div');
    phaseDiv.className = 'bg-[#0b101c] border border-[#1e2c47] rounded-2xl p-4 space-y-3';

    const weeksHtml = phaseWeeks
      .map(
        wData => `
      <div onclick="selectWeekFromRoadmap(${wData.weekNum})" class="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-[#1e2c47] hover:border-sky-500/40 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div class="font-bold text-slate-200 text-xs">${escapeHtml(wData.title)}</div>
          <div class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(wData.desc)}</div>
        </div>
        <span class="text-[10px] text-sky-400 font-semibold px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 shrink-0 self-start sm:self-auto">
          Bu Haftaya Git ➔
        </span>
      </div>
    `
      )
      .join('');

    phaseDiv.innerHTML = `
      <div class="flex items-center gap-2 pb-2 border-b border-[#1e2c47]/70">
        <span class="text-[11px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-md border ${phase.color}">
          ${phase.name}
        </span>
      </div>
      <div class="space-y-2">${weeksHtml}</div>
    `;
    container.appendChild(phaseDiv);
  });
}

function selectWeekFromRoadmap(weekNum) {
  toggleModal('full-roadmap-modal', false);
  loadWeek(weekNum);
  showToast(`Hafta ${weekNum} görüntülendi.`, '🗓️');
}

function openCloudSettingsModal() {
  const cfg = accountStore.getCloudConfig();
  const urlInput = document.getElementById('cloud-url-input');
  const keyInput = document.getElementById('cloud-key-input');
  const statusEl = document.getElementById('cloud-status-badge');
  if (urlInput) urlInput.value = cfg.url;
  if (keyInput) keyInput.value = cfg.anonKey;
  if (statusEl) {
    statusEl.innerText = cfg.enabled ? '🟢 Supabase Bulut Senkronizasyonu Aktif' : '🟡 Cihaz İçi Çoklu Hesap Modu Aktif';
  }
  toggleModal('cloud-settings-modal', true);
}

function saveCloudSettingsForm() {
  const url = document.getElementById('cloud-url-input')?.value || '';
  const anonKey = document.getElementById('cloud-key-input')?.value || '';
  const cfg = accountStore.saveCloudConfig({ url, anonKey });
  toggleModal('cloud-settings-modal', false);
  showToast(
    cfg.enabled
      ? 'Supabase Bulut bağlantısı kaydedildi ve aktif edildi!'
      : 'Cihaz içi çoklu hesap modu kullanılıyor.',
    '☁️'
  );
}

// ================= ALARM & MOTIVATION =================
function triggerAlarmModal() {
  if (isAlarmRinging) return;
  isAlarmRinging = true;

  const currentWeek = campaignWeeks.find(w => w.weekNum === userState.activeWeek) || campaignWeeks[0];
  const jsDay = new Date().getDay();
  const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const globalSlot = ((currentWeek?.weekNum || 1) - 1) * 7 + dayIdx;
  const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlot, userState.offDays || {});
  const activeLesson = slotResult.lesson || currentWeek?.days?.[0] || {
    subj: 'TYT Matematik',
    topic: 'Temel Kavramlar & Sayı Kümeleri',
    target: '50 Soru + Konu Tekrarı',
    directUrl: 'https://www.youtube.com'
  };

  currentTriggeredVideoUrl = activeLesson.directUrl || '';
  const subjEl = document.getElementById('alarm-modal-subject');
  const topicEl = document.getElementById('alarm-modal-topic');
  const quoteEl = document.getElementById('alarm-modal-quote');

  if (subjEl) subjEl.innerText = `${activeLesson.subj} • ${activeLesson.target || ''}`;
  if (topicEl) topicEl.innerText = activeLesson.topic;
  if (quoteEl) {
    quoteEl.innerText = `"${MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)]}"`;
  }

  toggleModal('alarm-trigger-modal', true);
  playBeep(784, 0.18);
  if (alarmIntervalId) clearInterval(alarmIntervalId);
  alarmIntervalId = setInterval(() => {
    playBeep(784, 0.18);
    setTimeout(() => playBeep(988, 0.22), 200);
  }, 1500);
}

function checkAlarmWallClock() {
  if (!userState.alarm || userState.alarm.enabled === false) return;
  const targetTime = (userState.alarm.time || '08:00').trim();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const nowHM = `${hh}:${mm}`;
  const dateStamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${nowHM}`;

  if (nowHM === targetTime && lastTriggeredAlarmStamp !== dateStamp) {
    lastTriggeredAlarmStamp = dateStamp;
    triggerAlarmModal();
  }
}

function initAlarmSystem() {
  const alarmTime = userState.alarm?.time || '08:00';
  const isAlarmEnabled = userState.alarm?.enabled !== false;

  const timeInput = document.getElementById('alarm-time-input');
  const toggleInput = document.getElementById('alarm-toggle-input');
  const navText = document.getElementById('nav-alarm-text');
  const pill = document.getElementById('alarm-status-pill');

  if (timeInput) timeInput.value = alarmTime;
  if (toggleInput) toggleInput.checked = isAlarmEnabled;
  if (navText) navText.innerText = alarmTime;
  if (pill) {
    pill.innerHTML = isAlarmEnabled ? `<span>🔔</span> Alarm Aktif: ${alarmTime}` : `<span>🔕</span> Alarm Kapalı`;
  }

  if (!alarmWallClockId) {
    alarmWallClockId = setInterval(checkAlarmWallClock, 15000);
  }
}

async function toggleAlarmSetting(enabled) {
  if (!currentUser) return;
  userState = await accountStore.saveUserState(currentUser.id, {
    alarm: { ...(userState.alarm || {}), enabled: Boolean(enabled) }
  });
  initAlarmSystem();
  showToast(enabled ? 'Hatırlatıcı açıldı.' : 'Hatırlatıcı kapatıldı.', '⏰');
}

async function saveAlarmTime(val) {
  if (!val || !currentUser) return;
  userState = await accountStore.saveUserState(currentUser.id, {
    alarm: { ...(userState.alarm || {}), time: val }
  });
  initAlarmSystem();
  showToast(`Alarm saati güncellendi: ${val}`, '⏰');
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) audioCtx = new AudioCtxClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playBeep(freq = 650, duration = 0.15) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function testAlarmRing() {
  playBeep(784, 0.18);
  setTimeout(() => playBeep(988, 0.22), 200);
  showToast('Zil sesi başarıyla test edildi.', '🔔');
}

function stopContinuousAlarm() {
  isAlarmRinging = false;
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
}

function stopAlarmAndGoLesson() {
  stopContinuousAlarm();
  toggleModal('alarm-trigger-modal', false);
  if (currentTriggeredVideoUrl) window.open(currentTriggeredVideoUrl, '_blank');
}

function snoozeAlarm(mins) {
  stopContinuousAlarm();
  toggleModal('alarm-trigger-modal', false);
  if (alarmSnoozeTimeoutId) clearTimeout(alarmSnoozeTimeoutId);
  const safeMins = Math.max(1, Number(mins) || 10);
  alarmSnoozeTimeoutId = setTimeout(() => {
    triggerAlarmModal();
  }, safeMins * 60 * 1000);
  showToast(`Alarm ${safeMins} dakika ertelendi.`, '💤');
}

function triggerImmediateMotivation() {
  const quote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
  const liveText = document.getElementById('live-motivation-text');
  if (liveText) liveText.innerText = `"${quote}"`;
  showToast('Teşvik ateşlendi! Hedefe odaklan!', '🔥');
}

function generateRandomMotivation() {
  const quote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
  const liveText = document.getElementById('live-motivation-text');
  if (liveText) liveText.innerText = `"${quote}"`;
}

function scrollWeeks(distance) {
  const container = document.getElementById('week-tabs-container');
  if (container) container.scrollBy({ left: distance, behavior: 'smooth' });
}

function shareSlotTelegram(globalSlotIndex) {
  const dayIndex = globalSlotIndex % 7;
  const weekNum = Math.floor(globalSlotIndex / 7) + 1;
  const dayKey = ALL_DAYS[dayIndex];
  const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlotIndex, userState.offDays || {});
  const unified = buildUnifiedDailySchedule({
    dayKey,
    fixedBlocks: userState.fixedBlocks || [],
    sportConfig: userState.sportConfig,
    tempoKey: userState.tempoKey || 'balanced',
    lesson: slotResult.lesson
  });

  const item = slotResult.lesson || { subj: 'Dinlenme', topic: 'Sosyal Mola', target: '-', teacher: '-', directUrl: window.location.href };
  const text =
    `⚡ *KİŞİSEL TYT & SPOR KAMPI - HAFTA ${weekNum}*\n` +
    `📅 *${unified.dayName}:* ${item.topic}\n` +
    `🏋️‍♂️ *Spor:* ${unified.sportInfo.badge}\n` +
    `📚 *Ders:* ${item.subj} (${item.teacher})\n` +
    `🎯 *Hedef:* ${item.target}`;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(item.directUrl)}&text=${encodeURIComponent(text)}`, '_blank');
}

function shareActiveWeekTelegram() {
  const week = campaignWeeks.find(w => w.weekNum === userState.activeWeek) || campaignWeeks[0];
  let text = `📌 *KİŞİSEL MAARİF TYT KAMPI - ${week.title.toUpperCase()}*\n\n`;
  week.days.forEach(d => {
    text += `▫️ *${d.dayName} (${d.subj}):* ${d.topic}\n   🎯 ${d.target}\n\n`;
  });
  window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}

function shareHourlyScheduleTelegram() {
  let text = `🏋️‍♂️ *KİŞİSEL BİRLEŞİK SPOR & TYT SAATLİK PROGRAMIM*\n\n`;
  const currentWeek = campaignWeeks.find(w => w.weekNum === userState.activeWeek) || campaignWeeks[0];
  ALL_DAYS.forEach((dayKey, idx) => {
    const unified = buildUnifiedDailySchedule({
      dayKey,
      schoolConfig: userState.schoolConfig,
      fixedBlocks: userState.fixedBlocks || [],
      sportConfig: userState.sportConfig,
      tempoKey: userState.tempoKey || 'balanced',
      lesson: currentWeek.days[idx]
    });
    text += `📌 *${unified.dayName}* (${unified.sportInfo.badge}):\n`;
    unified.timeline.forEach(b => {
      text += `  • ${b.time} -> ${b.title}\n`;
    });
    text += `\n`;
  });
  window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}

function shareSingleNoteTelegram(idx) {
  const n = userState.notes?.[idx];
  if (!n) return;
  const text = `📝 *TYT YANLIŞ DEFTERİ*\n\n📌 *Konu:* ${n.topic}\n💡 *Açıklama:* ${n.body}\n📅 *Tarih:* ${n.date}`;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}

function sendNotesToTelegram() {
  const notes = userState.notes || [];
  if (notes.length === 0) {
    showToast('Gönderilecek not bulunmuyor.', '⚠️');
    return;
  }
  let full = `📝 *TYT YANLIŞ DEFTERİ - TÜM ANALİZLERİM*\n\n`;
  notes.forEach((n, i) => {
    full += `${i + 1}) *${n.topic}* (${n.date}):\n${n.body}\n\n`;
  });
  window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(full)}`, '_blank');
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Tarayıcınız bildirim desteklemiyor.', '⚠️');
    return;
  }
  Notification.requestPermission().then(p => {
    showToast(p === 'granted' ? 'Bildirim izinleri aktif!' : 'Bildirim izni verilmedi.', '🔔');
  });
}

// Expose handlers globally for HTML attributes and window.appController
const appHandlers = {
  toggleModal,
  switchAuthTab,
  fillQuickLogin,
  handleLoginSubmit,
  handleRegisterSubmit,
  handleLogout,
  openOnboardingWizard,
  setWizardStep,
  toggleWizardDayPill,
  selectAllWeekdaysInWizard,
  selectWeekendInWizard,
  addWizardFixedBlock,
  removeWizardFixedBlock,
  selectWizardSportProgram,
  selectWizardTempo,
  setWizardPreviewDay,
  saveAndFinishOnboarding,
  loadWeek,
  toggleDayStatus,
  markDayShifted,
  undoShiftDay,
  resetCurrentWeek,
  openHourlyModal,
  filterRoutineDay,
  addMistakeNote,
  deleteNote,
  selectWeekFromRoadmap,
  openCloudSettingsModal,
  saveCloudSettingsForm,
  toggleAlarmSetting,
  saveAlarmTime,
  testAlarmRing,
  stopAlarmAndGoLesson,
  snoozeAlarm,
  checkAlarmWallClock,
  triggerAlarmModal,
  triggerImmediateMotivation,
  generateRandomMotivation,
  scrollWeeks,
  shareSlotTelegram,
  shareActiveWeekTelegram,
  shareHourlyScheduleTelegram,
  shareSingleNoteTelegram,
  sendNotesToTelegram,
  requestNotificationPermission
};
window.appController = appHandlers;
Object.assign(window, appHandlers);

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  generateRandomMotivation();
  renderSavedAccountsPills();

  const existingSession = accountStore.getCurrentSession();
  if (existingSession) {
    onSessionEstablished(existingSession.user, existingSession.state, false);
    accountStore.saveUserState(existingSession.user.id, {}).catch(() => {});
  } else {
    toggleModal('auth-modal', true);
  }
});

