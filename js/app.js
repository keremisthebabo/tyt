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
import { mebTopics } from './meb-topics.js';
import {
  subjects,
  examTypes,
  grades,
  mistakes,
  statuses,
  intervals,
  examSubjects,
  topicOptions,
  normalizeTopic,
  todayKey,
  currentMonthKey,
  addDays,
  formatShortDate,
  formatMonth,
  daysUntil,
  genitive,
  initials,
  scheduleReview,
  dueQuestions,
  mistakeLabel,
  statusLabel,
  monthlyTopics,
  calculateExamNet
} from './net-defterim-core.js';

const accountStore = createAccountStore();

let currentUser = null;
let userState = createDefaultUserState();
let campaignWeeks = generateCampaignWeeks('balanced');

// Active Navigation View ('home' | 'camp' | 'archive' | 'report' | 'exams' | 'notes' | 'settings')
let activeView = 'home';

// Archive & Report & Notes UI filters
let archiveFilter = {
  search: '',
  subject: 'all',
  status: 'all',
  mistake: 'all',
  month: 'all',
  groupByTopic: false
};
let reportMonth = currentMonthKey();
let examFormType = 'TYT';
let noteFilterSubject = 'Matematik';
let noteFilterGrade = '12. Sınıf';

// Upload Modal temporary state
let uploadPhotoDataUrl = '';
let uploadSubject = 'Matematik';

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

// Alarm state
let audioCtx = null;
let alarmWallClockId = null;
let lastTriggeredAlarmStamp = '';

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// 1. OTURUM AÇMA / KAYIT / HIZLI HESAP GEÇİŞİ
// ============================================================================
function switchAuthTab(mode) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-register-btn');
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) errEl.style.display = 'none';

  if (mode === 'register') {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'grid';
    loginBtn?.classList.remove('active');
    regBtn?.classList.add('active');
  } else {
    if (regForm) regForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'grid';
    regBtn?.classList.remove('active');
    loginBtn?.classList.add('active');
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-error-msg');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

function renderSavedAccounts() {
  const box = document.getElementById('saved-accounts-container');
  const list = document.getElementById('saved-accounts-list');
  if (!box || !list) return;
  const users = accountStore.listRegisteredUsers();
  if (!users.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  list.innerHTML = users
    .map(
      (u) => `
      <button type="button" class="saved-account-chip" onclick="window.appController.quickFillAccount('${escapeHtml(u.email)}')">
        <span style="width:20px;height:20px;border-radius:6px;background:var(--accent);color:#fff;display:inline-grid;place-items:center;font-size:0.7rem;font-weight:800;">
          ${escapeHtml(initials(u.name))}
        </span>
        <span>${escapeHtml(u.name)}</span>
      </button>
    `
    )
    .join('');
}

function quickFillAccount(email) {
  switchAuthTab('login');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.focus();
}

async function handleLogin(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('login-email')?.value || '';
  const password = document.getElementById('login-password')?.value || '';
  try {
    const session = await accountStore.loginUser({ email, password });
    enterAuthenticatedApp(session.user, session.state, false);
  } catch (err) {
    showAuthError(err.message || 'Giriş yapılamadı.');
  }
}

async function handleRegister(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('reg-name')?.value || '';
  const grade = document.getElementById('reg-grade')?.value || '12. Sınıf';
  const target = document.getElementById('reg-target')?.value || 'TYT + AYT';
  const email = document.getElementById('reg-email')?.value || '';
  const password = document.getElementById('reg-password')?.value || '';
  try {
    const session = await accountStore.registerUser({ name, email, password });
    const enrichedState = await accountStore.saveUserState(session.user.id, {
      profile: {
        ...session.state.profile,
        name: session.user.name,
        grade,
        target
      }
    });
    enterAuthenticatedApp(session.user, enrichedState, true);
  } catch (err) {
    showAuthError(err.message || 'Kayıt oluşturulamadı.');
  }
}

async function handleLogout() {
  await accountStore.logoutUser();
  currentUser = null;
  userState = createDefaultUserState();
  const authModal = document.getElementById('auth-modal');
  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.style.display = 'none';
  if (authModal) authModal.style.display = 'grid';
  renderSavedAccounts();
}

function enterAuthenticatedApp(user, state, isNewRegistration = false) {
  currentUser = user;
  userState = state;
  campaignWeeks = generateCampaignWeeks(userState.tempoKey || 'balanced');

  const authModal = document.getElementById('auth-modal');
  const appShell = document.getElementById('app-shell');
  if (authModal) authModal.style.display = 'none';
  if (appShell) appShell.style.display = 'grid';

  initAlarmLoop();
  renderAll();

  if (isNewRegistration || !userState.onboardingCompleted) {
    openWizardModal();
  }
}

// ============================================================================
// 2. ANA KABUK (SIDEBAR, TOPBAR, MOBILE BAR) VE GÖRÜNÜM YÖNETİMİ
// ============================================================================
const NAV_ITEMS = [
  { id: 'home', label: 'Genel bakış', mobileLabel: 'Bugün' },
  { id: 'camp', label: 'TYT Kamp & Spor', mobileLabel: 'Kampım' },
  { id: 'archive', label: 'Yanlış arşivim', mobileLabel: 'Arşiv' },
  { id: 'report', label: 'Aylık raporum', mobileLabel: 'Rapor' },
  { id: 'exams', label: 'Denemelerim', mobileLabel: 'Deneme' },
  { id: 'notes', label: 'Ders notlarım', mobileLabel: 'Notlar' },
  { id: 'settings', label: 'Ayarlar', mobileLabel: 'Ayarlar' }
];

function setView(viewId) {
  activeView = viewId;
  renderAll();
}

function renderAll() {
  if (!currentUser) return;
  campaignWeeks = generateCampaignWeeks(userState.tempoKey || 'balanced');
  renderSidebar();
  renderTopbar();
  renderMobileNav();
  renderWorkspaceView();
}

function renderSidebar() {
  const navContainer = document.getElementById('side-nav-container');
  const dueCard = document.getElementById('sidebar-due-card');
  const profileWrapper = document.getElementById('sidebar-profile-wrapper');

  const questions = userState.questions || [];
  const due = dueQuestions(questions);
  const solvedCount = questions.filter((q) => q.status === 'solved').length;

  if (navContainer) {
    navContainer.innerHTML = NAV_ITEMS.map((item) => {
      let badge = '';
      if (item.id === 'archive' && questions.length > 0) {
        badge = `<em>${questions.length}</em>`;
      } else if (item.id === 'camp') {
        badge = `<em>H${userState.activeWeek || 1}</em>`;
      } else if (item.id === 'exams' && (userState.exams || []).length > 0) {
        badge = `<em>${userState.exams.length}</em>`;
      }
      return `
        <button type="button" class="${activeView === item.id ? 'active' : ''}" onclick="window.appController.setView('${item.id}')">
          <span>${escapeHtml(item.label)}</span>
          ${badge}
        </button>
      `;
    }).join('');
  }

  if (dueCard) {
    const sportObj = SPORT_PROGRAMS.find((s) => s.id === userState.sportConfig?.programId) || SPORT_PROGRAMS[0];
    dueCard.innerHTML = `
      <span class="sidebar-label">Bugünkü tekrar &amp; kamp</span>
      <strong>${due.length ? `${due.length} soru bekliyor` : 'Bugün tekrar temiz'}</strong>
      <p>
        ${
          due.length
            ? 'Zamanı gelen soruları tekrar edip kalıcı hafızaya taşı.'
            : `${ solvedCount } soru öğrenildi • ${escapeHtml(sportObj.name)}`
        }
      </p>
    `;
  }

  if (profileWrapper) {
    const displayName = userState.profile?.name || currentUser.name || 'Öğrenci';
    const subLine = [userState.profile?.grade || '12. Sınıf', userState.profile?.target || 'TYT + AYT']
      .filter(Boolean)
      .join(' · ');

    profileWrapper.innerHTML = `
      <div class="sidebar-profile" onclick="window.appController.setView('settings')">
        <span class="avatar">${escapeHtml(initials(displayName))}</span>
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <small>${escapeHtml(subLine)}</small>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button type="button" class="btn-ghost" style="flex:1;padding:7px 10px;font-size:0.76rem;color:#c9e9e2;border-color:rgba(255,255,255,0.16);" onclick="window.appController.openWizardModal()">
          ⚙️ Kamp Sihirbazı
        </button>
        <button type="button" class="btn-ghost" style="padding:7px 10px;font-size:0.76rem;color:#fca5a5;border-color:rgba(248,113,113,0.28);" onclick="window.appController.handleLogout()">
          Çıkış
        </button>
      </div>
    `;
  }
}

function renderTopbar() {
  const topbar = document.getElementById('workspace-topbar');
  if (!topbar) return;
  const displayName = userState.profile?.name || currentUser?.name || 'Öğrenci';
  const examDays = daysUntil(userState.profile?.examDate || '2027-06-20');
  const tempoObj = TEMPO_OPTIONS[userState.tempoKey] || TEMPO_OPTIONS.balanced;

  topbar.innerHTML = `
    <div>
      <p class="eyebrow">
        ${escapeHtml(userState.profile?.grade || '12. Sınıf')} · ${escapeHtml(userState.profile?.target || 'TYT + AYT')} hedefi
        · ${escapeHtml(tempoObj.badge)}
        ${examDays !== null && examDays >= 0 ? ` · Sınava ${examDays} gün` : ''}
      </p>
      <h1>${escapeHtml(genitive(displayName))} çalışma defteri</h1>
    </div>
    <div class="topbar-actions">
      <button type="button" class="btn-ghost" onclick="window.appController.openWizardModal()">
        🗓️ Kamp &amp; Spor Düzeni
      </button>
      <button type="button" class="btn-primary" onclick="window.appController.openUploadModal()">
        + Soru Yükle
      </button>
    </div>
  `;
}

function renderMobileNav() {
  const mobileBar = document.getElementById('mobile-nav-container');
  if (!mobileBar) return;
  const mobileTabs = [
    NAV_ITEMS[0], // home
    NAV_ITEMS[1], // camp
    NAV_ITEMS[2], // archive
    NAV_ITEMS[4], // exams
    NAV_ITEMS[6]  // settings
  ];
  mobileBar.innerHTML =
    mobileTabs
      .map(
        (t) => `
      <button type="button" class="${activeView === t.id ? 'active' : ''}" onclick="window.appController.setView('${t.id}')">
        ${escapeHtml(t.mobileLabel)}
      </button>
    `
      )
      .join('') +
    `<button type="button" class="mobile-add" onclick="window.appController.openUploadModal()">+ Yükle</button>`;
}

function renderWorkspaceView() {
  const container = document.getElementById('workspace-content');
  if (!container) return;

  switch (activeView) {
    case 'home':
      container.innerHTML = buildHomeViewHtml();
      break;
    case 'camp':
      container.innerHTML = buildCampViewHtml();
      break;
    case 'archive':
      container.innerHTML = buildArchiveViewHtml();
      break;
    case 'report':
      container.innerHTML = buildReportViewHtml();
      break;
    case 'exams':
      container.innerHTML = buildExamsViewHtml();
      break;
    case 'notes':
      container.innerHTML = buildNotesViewHtml();
      break;
    case 'settings':
      container.innerHTML = buildSettingsViewHtml();
      break;
    default:
      container.innerHTML = buildHomeViewHtml();
  }
}

// ============================================================================
// 3. GENEL BAKIŞ (home) — NET DEFTERİM ANA EKRANI + GÜNLÜK KAMP ÖZETİ
// ============================================================================
function buildHomeViewHtml() {
  const questions = userState.questions || [];
  const due = dueQuestions(questions);
  const solvedCount = questions.filter((q) => q.status === 'solved').length;
  const monthKey = currentMonthKey();
  const thisMonthCount = questions.filter((q) => String(q.createdAt || '').startsWith(monthKey)).length;
  const topTopics = monthlyTopics(questions, monthKey);
  const topFocus = topTopics[0] || null;
  const examDays = daysUntil(userState.profile?.examDate || '2027-06-20');

  // Bugünkü kamp dersi özeti
  const activeWeekObj = campaignWeeks.find((w) => w.weekNum === (userState.activeWeek || 1)) || campaignWeeks[0];
  const jsDay = new Date().getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const todayKeyCode = ALL_DAYS[todayIdx];
  const globalSlot = (activeWeekObj.weekNum - 1) * 7 + todayIdx;
  const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlot, userState.offDays || {});
  const unifiedToday = buildUnifiedDailySchedule({
    dayKey: todayKeyCode,
    schoolConfig: userState.schoolConfig,
    fixedBlocks: userState.fixedBlocks || [],
    sportConfig: userState.sportConfig,
    tempoKey: userState.tempoKey || 'balanced',
    lesson: slotResult.lesson,
    isOffDay: slotResult.isOffDay
  });

  const dueHtml =
    due.length === 0
      ? `<div class="empty-inline"><p>Bugün tekrar zamanı gelen soru yok. Yeni yanlışlarını yükleyebilir veya TYT kamp programına geçebilirsin.</p></div>`
      : `<div class="due-list">
          ${due
            .slice(0, 6)
            .map(
              (item) => `
            <article class="due-item">
              <button type="button" class="due-Thumb" onclick="window.appController.openQuestionModal('${escapeHtml(item.id)}')">
                ${
                  item.imageData
                    ? `<img src="${item.imageData}" alt="${escapeHtml(item.topic)}" />`
                    : `<span>${escapeHtml(item.subject.slice(0, 3))}</span>`
                }
              </button>
              <div class="due-copy" onclick="window.appController.openQuestionModal('${escapeHtml(item.id)}')">
                <div class="tag-row">
                  <span class="pill">${escapeHtml(item.subject)}</span>
                  <span class="pill subtle">${escapeHtml(item.examType || 'TYT')}</span>
                  <span class="pill warn">${escapeHtml(mistakeLabel(item.mistakeReason))}</span>
                </div>
                <h3>${escapeHtml(item.topic)}</h3>
                <p>${escapeHtml(item.note || 'Bu soruyu tekrar çözüp sonucunu işaretle.')}</p>
              </div>
              <div class="due-actions">
                <button type="button" class="review-btn hard" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'hard')">Zorlandım</button>
                <button type="button" class="review-btn ok" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'ok')">Çözdüm</button>
                <button type="button" class="review-btn easy" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'easy')">Çok kolaydı</button>
              </div>
            </article>
          `
            )
            .join('')}
        </div>`;

  const recentHtml =
    questions.length === 0
      ? `<div class="empty-block">
          <h3>Henüz yanlış soru eklemedin</h3>
          <p>Denemelerde, soru bankalarında veya özel derste takıldığın ilk soruyu fotoğrafıyla ya da konu başlığıyla ekle.</p>
          <button type="button" class="btn-primary" onclick="window.appController.openUploadModal()">+ İlk Sorunu Yükle</button>
        </div>`
      : `<div class="question-grid">
          ${questions
            .slice(0, 6)
            .map((item) => renderQuestionCardHtml(item))
            .join('')}
        </div>`;

  return `
    <section class="stats-grid" aria-label="Özet istatistikler">
      <div class="stat-card">
        <span>Toplam yanlış</span>
        <strong>${questions.length}</strong>
        <small>Arşivdeki tüm sorular</small>
      </div>
      <div class="stat-card accent">
        <span>Bugün tekrar</span>
        <strong>${due.length}</strong>
        <small>Zamanı gelen sorular</small>
      </div>
      <div class="stat-card">
        <span>Bu ay eklenen</span>
        <strong>${thisMonthCount}</strong>
        <small>${escapeHtml(formatMonth(monthKey))}</small>
      </div>
      <div class="stat-card success">
        <span>Öğrenilen</span>
        <strong>${solvedCount}</strong>
        <small>${questions.length ? `%${Math.round((solvedCount / questions.length) * 100)} tamamlandı` : 'İlk soruyu ekle'}</small>
      </div>
    </section>

    <section class="home-grid">
      <div class="upload-drop" onclick="window.appController.openUploadModal()">
        <div>
          <span class="eyebrow">Hızlı kayıt · Fotoğraf veya Metin</span>
          <h2>Çözemediğin soruyu fotoğrafla, konuyu seç, tekrar takvimine girsin.</h2>
          <p>
            Sorular kendi hesabında ve Supabase bulutunda saklanır; 1, 3, 7, 14, 30 ve 60. günlerde tekrar karşına çıkar.
          </p>
        </div>
        <div class="upload-drop-cta">
          <span class="btn-primary">Fotoğraf veya Soru Ekle</span>
          <small>Telefon kamerası, ekran görüntüsü veya konu notu</small>
        </div>
      </div>

      <aside class="focus-card">
        <span class="eyebrow">Bu ay en çok takıldığın konu</span>
        ${
          topFocus
            ? `<h3>${escapeHtml(topFocus.subject)} · ${escapeHtml(topFocus.topic)}</h3>
               <p>${topFocus.total} soru eklendi, ${topFocus.unsolved} tanesi hâlâ tekrar bekliyor.</p>`
            : `<h3>Henüz aylık odak oluşmadı</h3>
               <p>Sorular ekledikçe hangi ders ve konudan net kaçırdığını burada göreceksin.</p>`
        }
        ${
          userState.profile?.motto
            ? `<blockquote class="motto">“${escapeHtml(userState.profile.motto)}”</blockquote>`
            : ''
        }
        <div class="goal-strip">
          <div>
            <span>Bugünün Kamp Dersi (${escapeHtml(DAY_FULL_NAMES[todayKeyCode])})</span>
            <strong>${escapeHtml(slotResult.lesson?.subj || 'Dinlenme')}: ${escapeHtml(slotResult.lesson?.topic || 'Mola')}</strong>
          </div>
          ${
            examDays !== null
              ? `<div>
                  <span>Sınava kalan</span>
                  <strong>${examDays >= 0 ? `${examDays} gün` : 'Tamamlandı'}</strong>
                </div>`
              : ''
          }
        </div>
        <button type="button" class="link-btn" onclick="window.appController.setView('camp')">
          Bugünkü birleşik ders &amp; spor saatlerine git →
        </button>
      </aside>
    </section>

    <!-- Bugünkü Birleşik TYT & Spor Akışı Özeti -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Kişisel TYT Kampı &amp; Spor Akışı · Hafta ${activeWeekObj.weekNum}</span>
          <h2>Bugünün (${escapeHtml(unifiedToday.dayName)}) Çakışmasız Saatlik Planı</h2>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn-ghost" onclick="window.appController.openWizardModal()">Düzeni Değiştir</button>
          <button type="button" class="btn-primary" onclick="window.appController.setView('camp')">Tüm Haftayı Aç →</button>
        </div>
      </div>
      <div class="camp-slot-list">
        ${unifiedToday.timeline
          .map(
            (slot) => `
          <div class="camp-slot-item type-${escapeHtml(slot.type)}">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span class="camp-slot-time">${escapeHtml(slot.time)}</span>
              <strong>${escapeHtml(slot.title)}</strong>
            </div>
            <span class="pill subtle">${escapeHtml(slot.tag)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Aralıklı tekrar sistemi (1-3-7-14-30-60 gün)</span>
          <h2>Bugün tekrar etmen gereken sorular</h2>
        </div>
        ${due.length ? `<span class="badge">${due.length} soru</span>` : ''}
      </div>
      ${dueHtml}
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Son kayıtlar</span>
          <h2>Son eklediğin yanlış sorular</h2>
        </div>
        ${
          questions.length > 6
            ? `<button type="button" class="link-btn" onclick="window.appController.setView('archive')">Tümünü gör (${questions.length}) →</button>`
            : ''
        }
      </div>
      ${recentHtml}
    </section>
  `;
}

function renderQuestionCardHtml(item) {
  return `
    <article class="question-card" onclick="window.appController.openQuestionModal('${escapeHtml(item.id)}')">
      <div class="question-media">
        ${
          item.imageData
            ? `<img src="${item.imageData}" alt="${escapeHtml(item.topic)}" />`
            : `<div class="no-photo">
                <span>${escapeHtml(item.subject)}</span>
                <strong>${escapeHtml(item.topic)}</strong>
              </div>`
        }
        <span class="status-dot ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="question-body">
        <div class="tag-row">
          <span class="pill">${escapeHtml(item.subject)}</span>
          <span class="pill subtle">${escapeHtml(item.examType || 'TYT')}</span>
        </div>
        <h3>${escapeHtml(item.topic)}</h3>
        <p>${escapeHtml(item.note || mistakeLabel(item.mistakeReason))}</p>
        <footer>
          <span>${escapeHtml(formatShortDate(item.createdAt))}</span>
          <span>Tekrar: ${escapeHtml(formatShortDate(item.nextReview))}</span>
        </footer>
      </div>
    </article>
  `;
}

// ============================================================================
// 4. TYT KAMP & SPOR PROGRAMIM (camp) — 112 GÜN MAARİF MÜFREDATI + DOMİNO KAYDIRMA
// ============================================================================
function buildCampViewHtml() {
  const activeWeekNum = Math.min(Math.max(1, userState.activeWeek || 1), campaignWeeks.length);
  const weekData = campaignWeeks.find((w) => w.weekNum === activeWeekNum) || campaignWeeks[0];
  const tempoObj = TEMPO_OPTIONS[userState.tempoKey] || TEMPO_OPTIONS.balanced;
  const sportObj = SPORT_PROGRAMS.find((s) => s.id === userState.sportConfig?.programId) || SPORT_PROGRAMS[0];

  const totalSlots = campaignWeeks.length * 7;
  let completedCount = 0;
  let shiftedCount = 0;
  for (let i = 0; i < totalSlots; i++) {
    if (userState.progress?.[`slot_${i}`]) completedCount++;
    else if (userState.offDays?.[i]) shiftedCount++;
  }
  const pct = Math.round((completedCount / totalSlots) * 100);

  const weekButtonsHtml = campaignWeeks
    .map((w) => {
      let doneInWeek = 0;
      for (let d = 0; d < 7; d++) {
        if (userState.progress?.[`slot_${(w.weekNum - 1) * 7 + d}`]) doneInWeek++;
      }
      return `
        <button type="button" class="camp-week-btn ${w.weekNum === activeWeekNum ? 'active' : ''}" onclick="window.appController.selectCampWeek(${w.weekNum})">
          ${w.weekNum}. Hafta ${doneInWeek > 0 ? `(${doneInWeek}/7✓)` : ''}
        </button>
      `;
    })
    .join('');

  const daysCardsHtml = ALL_DAYS.map((dayKey, dayIndex) => {
    const globalSlot = (weekData.weekNum - 1) * 7 + dayIndex;
    const storageKey = `slot_${globalSlot}`;
    const isDone = Boolean(userState.progress?.[storageKey]);
    const slotResult = getSlotWithDominoShift(campaignWeeks, globalSlot, userState.offDays || {});
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

    if (slotResult.isOffDay) {
      return `
        <article class="camp-day-card off-day">
          <div class="camp-day-head">
            <div>
              <span class="pill warn">🏖️ Dinlenme &amp; Domino Kaydırma</span>
              <h3 style="margin-top:6px;">${escapeHtml(DAY_FULL_NAMES[dayKey])}</h3>
            </div>
            <button type="button" class="btn-ghost" onclick="window.appController.undoCampShift(${globalSlot})">
              ↩ Geri Al
            </button>
          </div>
          <p style="font-size:0.84rem;color:var(--ink-soft);">
            Bu gün dışarı çıkıldığı için ders ve sonraki tüm müfredat otomatik olarak <strong>1 gün ileri</strong> kaydırıldı.
          </p>
          <div class="camp-slot-list">
            ${unified.timeline
              .map(
                (slot) => `
              <div class="camp-slot-item type-${escapeHtml(slot.type)}">
                <div>
                  <span class="camp-slot-time">${escapeHtml(slot.time)}</span>
                  <div style="margin-top:4px;font-weight:600;">${escapeHtml(slot.title)}</div>
                </div>
                <span class="pill subtle">${escapeHtml(slot.tag)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </article>
      `;
    }

    const lesson = slotResult.lesson;
    return `
      <article class="camp-day-card">
        <div class="camp-day-head">
          <div>
            <div class="tag-row">
              <span class="pill">${escapeHtml(lesson.subj)}</span>
              <span class="pill subtle">${escapeHtml(unified.sportInfo.badge)}</span>
              ${slotResult.isCascadeShifted ? `<span class="pill warn">⚡ Kaydırıldı</span>` : ''}
            </div>
            <h3 style="margin-top:6px;font-size:1rem;">
              ${escapeHtml(DAY_FULL_NAMES[dayKey])}: ${escapeHtml(lesson.topic)}
            </h3>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn-ghost" style="padding:6px 9px;font-size:0.74rem;" title="Dışarı çıktım, bu günü 1 gün ileri kaydır" onclick="window.appController.shiftCampDay(${weekData.weekNum}, ${dayIndex})">
              🏖️ Kaydır
            </button>
            <button type="button" class="review-btn ${isDone ? 'easy' : 'ok'}" onclick="window.appController.toggleCampSlot('${storageKey}')">
              ${isDone ? '✓ Bitti' : 'Tamamla'}
            </button>
          </div>
        </div>

        <div style="font-size:0.82rem;color:var(--ink-soft);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <span>🎯 <strong>Hedef:</strong> ${escapeHtml(lesson.target)}</span>
          <span>👨‍🏫 <strong>Kanal:</strong> ${escapeHtml(lesson.teacher)}</span>
        </div>
        ${
          unified.hasCollisionWarning
            ? `<div style="font-size:0.76rem;color:var(--amber);background:var(--amber-soft);padding:6px 10px;border-radius:8px;">⚠️ Yoğun gün: TYT çalışma blokları en uygun boş saatlere sıkıştırıldı.</div>`
            : ''
        }

        <div class="camp-slot-list">
          ${unified.timeline
            .map(
              (slot) => `
            <div class="camp-slot-item type-${escapeHtml(slot.type)}">
              <div>
                <span class="camp-slot-time">${escapeHtml(slot.time)}</span>
                <div style="margin-top:4px;font-weight:600;">${escapeHtml(slot.title)}</div>
              </div>
              <span class="pill subtle">${escapeHtml(slot.tag)}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid var(--border);">
          <a href="${escapeHtml(lesson.directUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="flex:1;text-align:center;padding:8px 12px;font-size:0.8rem;">
            ▶ YouTube Dersini Aç
          </a>
          <button type="button" class="btn-ghost" style="padding:8px 11px;font-size:0.8rem;" onclick="window.appController.openUploadForCampTopic('${escapeHtml(lesson.subj)}', '${escapeHtml(lesson.topic)}')">
            + Yanlış Ekle
          </button>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="camp-header-banner">
      <div>
        <span class="eyebrow">Maarif Modeli TYT Müfredatı · Okul &amp; Spor Entegreli</span>
        <h2 style="font-family:var(--font-serif);font-size:1.5rem;margin-top:4px;">${escapeHtml(weekData.title)}</h2>
        <p style="color:var(--ink-soft);font-size:0.88rem;margin-top:4px;">${escapeHtml(weekData.desc)}</p>
        <div class="camp-badges-row">
          <span class="camp-pill">🏫 Okul: ${
            userState.schoolConfig?.enabled !== false
              ? `Hafta İçi ${escapeHtml(userState.schoolConfig.start || '08:00')}-${escapeHtml(userState.schoolConfig.end || '16:00')}`
              : 'Kapalı'
          }</span>
          <span class="camp-pill amber">${escapeHtml(sportObj.name)} (${escapeHtml(userState.sportConfig?.start || '17:00')}-${escapeHtml(userState.sportConfig?.end || '18:30')})</span>
          <span class="camp-pill blue">${escapeHtml(tempoObj.badge)}</span>
          <span class="camp-pill">📊 İlerleme: %${pct} (${completedCount}/${totalSlots} gün${shiftedCount ? ` · ${shiftedCount} kaydırma` : ''})</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:210px;">
        <button type="button" class="btn-primary" onclick="window.appController.openWizardModal()">
          ⚙️ Okul, Spor &amp; Kamp Sihirbazı
        </button>
        <div style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.28);padding:7px 10px;border-radius:10px;border:1px solid var(--border);font-size:0.78rem;">
          <span>⏰ Sabah Alarmı:</span>
          <input type="time" value="${escapeHtml(userState.alarm?.time || '08:00')}" onchange="window.appController.updateAlarmTime(this.value)" style="background:transparent;border:none;color:#fff;font-family:var(--font-mono);font-weight:700;padding:0;width:72px;" />
          <button type="button" class="link-btn" onclick="window.appController.testAlarmSound()">Test</button>
        </div>
      </div>
    </div>

    <div class="camp-week-strip">
      ${weekButtonsHtml}
    </div>

    <div class="camp-days-grid">
      ${daysCardsHtml}
    </div>
  `;
}

async function selectCampWeek(weekNum) {
  if (!currentUser) return;
  userState = await accountStore.saveUserState(currentUser.id, { activeWeek: Number(weekNum) });
  renderAll();
}

async function toggleCampSlot(storageKey) {
  if (!currentUser) return;
  const nextProgress = { ...(userState.progress || {}) };
  nextProgress[storageKey] = !nextProgress[storageKey];
  userState = await accountStore.saveUserState(currentUser.id, { progress: nextProgress });
  renderAll();
}

async function shiftCampDay(weekNum, dayIndex) {
  if (!currentUser) return;
  const globalSlot = (weekNum - 1) * 7 + dayIndex;
  const slotData = getSlotWithDominoShift(campaignWeeks, globalSlot, userState.offDays || {});
  const nextOffDays = { ...(userState.offDays || {}) };
  nextOffDays[globalSlot] = {
    weekNum,
    dayIndex,
    dayName: DAY_FULL_NAMES[ALL_DAYS[dayIndex]],
    shiftedDate: new Date().toLocaleDateString('tr-TR'),
    originalTopic: slotData.lesson?.topic || 'TYT Dersi'
  };
  userState = await accountStore.saveUserState(currentUser.id, { offDays: nextOffDays });
  renderAll();
}

async function undoCampShift(globalSlot) {
  if (!currentUser) return;
  const nextOffDays = { ...(userState.offDays || {}) };
  delete nextOffDays[globalSlot];
  userState = await accountStore.saveUserState(currentUser.id, { offDays: nextOffDays });
  renderAll();
}

// ============================================================================
// 5. YANLIŞ ARŞİVİM (archive)
// ============================================================================
function buildArchiveViewHtml() {
  const questions = userState.questions || [];
  const filtered = questions.filter((q) => {
    if (archiveFilter.subject !== 'all' && q.subject !== archiveFilter.subject) return false;
    if (archiveFilter.status !== 'all' && q.status !== archiveFilter.status) return false;
    if (archiveFilter.mistake !== 'all' && q.mistakeReason !== archiveFilter.mistake) return false;
    if (archiveFilter.month !== 'all' && !String(q.createdAt || '').startsWith(archiveFilter.month)) return false;
    if (archiveFilter.search) {
      const hay = `${q.subject} ${q.topic} ${q.note || ''} ${q.solutionNote || ''}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(archiveFilter.search.toLocaleLowerCase('tr-TR'))) return false;
    }
    return true;
  });

  let contentHtml = '';
  if (filtered.length === 0) {
    contentHtml = `
      <div class="empty-block">
        <h3>Filtreye uygun soru bulunamadı</h3>
        <p>Yeni bir soru yükleyebilir veya filtreleri temizleyebilirsin.</p>
        <button type="button" class="btn-primary" onclick="window.appController.openUploadModal()">+ Soru Yükle</button>
      </div>
    `;
  } else if (archiveFilter.groupByTopic) {
    const groups = new Map();
    for (const item of filtered) {
      const key = `${item.subject} · ${item.topic}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    contentHtml = Array.from(groups.entries())
      .map(
        ([groupTitle, items]) => `
        <div class="topic-group">
          <div class="topic-group-head">
            <div>
              <h3>${escapeHtml(groupTitle)}</h3>
            </div>
            <span class="badge">${items.length} soru</span>
          </div>
          <div class="question-grid">
            ${items.map((it) => renderQuestionCardHtml(it)).join('')}
          </div>
        </div>
      `
      )
      .join('');
  } else {
    contentHtml = `<div class="question-grid">${filtered.map((it) => renderQuestionCardHtml(it)).join('</div><div class="question-grid">') ? filtered.map((it) => renderQuestionCardHtml(it)).join('') : ''}</div>`;
  }

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Yanlış soru kütüphanen</span>
          <h2>Yanlış arşivim (${filtered.length})</h2>
        </div>
        <div class="export-actions">
          <div class="view-toggle">
            <button type="button" class="${!archiveFilter.groupByTopic ? 'active' : ''}" onclick="window.appController.setArchiveGrouping(false)">Liste</button>
            <button type="button" class="${archiveFilter.groupByTopic ? 'active' : ''}" onclick="window.appController.setArchiveGrouping(true)">Konu klasörleri</button>
          </div>
          <button type="button" class="btn-ghost" onclick="window.appController.exportArchiveCsv()">CSV İndir</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="search" placeholder="Konu, ders veya not ara..." value="${escapeHtml(archiveFilter.search)}" oninput="window.appController.updateArchiveFilter('search', this.value)" />
        <select onchange="window.appController.updateArchiveFilter('subject', this.value)">
          <option value="all">Tüm dersler</option>
          ${subjects
            .map(
              (s) => `<option value="${escapeHtml(s)}" ${archiveFilter.subject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
            )
            .join('')}
        </select>
        <select onchange="window.appController.updateArchiveFilter('status', this.value)">
          <option value="all">Tüm durumlar</option>
          ${statuses
            .map(
              (st) => `<option value="${escapeHtml(st.id)}" ${archiveFilter.status === st.id ? 'selected' : ''}>${escapeHtml(st.label)}</option>`
            )
            .join('')}
        </select>
        <select onchange="window.appController.updateArchiveFilter('mistake', this.value)">
          <option value="all">Tüm hata türleri</option>
          ${mistakes
            .map(
              (m) => `<option value="${escapeHtml(m.id)}" ${archiveFilter.mistake === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
            )
            .join('')}
        </select>
      </div>

      ${contentHtml}
    </section>
  `;
}

function updateArchiveFilter(key, value) {
  archiveFilter[key] = value;
  renderWorkspaceView();
}

function setArchiveGrouping(val) {
  archiveFilter.groupByTopic = Boolean(val);
  renderWorkspaceView();
}

function exportArchiveCsv() {
  const questions = userState.questions || [];
  const header = ['Tarih', 'Ders', 'Sınav', 'Konu', 'Hata Nedeni', 'Durum', 'Sonraki Tekrar', 'Not'];
  const rows = questions.map((q) => [
    q.createdAt,
    q.subject,
    q.examType || 'TYT',
    q.topic,
    mistakeLabel(q.mistakeReason),
    statusLabel(q.status),
    q.nextReview,
    (q.note || '').replace(/\n/g, ' ')
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `net-defterim-arsiv-${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// 6. AYLIK RAPORUM (report)
// ============================================================================
function buildReportViewHtml() {
  const questions = userState.questions || [];
  const ranked = monthlyTopics(questions, reportMonth);
  const maxCount = ranked[0]?.total || 1;
  const savedReport = userState.reports?.[reportMonth] || { focusNote: '', goalNote: '' };

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Konu analizi &amp; aylık değerlendirme</span>
          <h2>${escapeHtml(formatMonth(reportMonth))} Raporu</h2>
        </div>
        <div class="export-actions">
          <input type="month" value="${escapeHtml(reportMonth)}" onchange="window.appController.changeReportMonth(this.value)" style="width:auto;" />
          <button type="button" class="btn-ghost" onclick="window.print()">Yazdır / PDF</button>
        </div>
      </div>

      ${
        ranked.length === 0
          ? `<div class="empty-inline"><p>Bu ay için kayıtlı soru bulunmuyor. Soru yükledikçe en çok hata yaptığın konular burada sıralanır.</p></div>`
          : `<div class="topic-bars">
              ${ranked
                .slice(0, 10)
                .map((item, idx) => {
                  const widthPct = Math.max(12, Math.round((item.total / maxCount) * 100));
                  return `
                    <div class="topic-bar-row">
                      <span class="rank">#${idx + 1}</span>
                      <div class="topic-bar-main">
                        <div class="topic-bar-title">
                          <strong>${escapeHtml(item.subject)} · ${escapeHtml(item.topic)}</strong>
                          <span>${item.total} soru (${item.unsolved} açık)</span>
                        </div>
                        <div class="bar-track">
                          <div class="bar-fill" style="width:${widthPct}%"></div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>`
      }
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Kişisel değerlendirme</span>
          <h2>Ay sonu notların ve gelecek ay hedefin</h2>
        </div>
      </div>
      <form class="report-notes" onsubmit="window.appController.saveMonthlyReport(event)">
        <label>
          <span>Bu ay en çok nerede zorlandım?</span>
          <textarea id="report-focus-note" rows="4" placeholder="Örn. Fonksiyon grafiklerinde ve paragraf sıralama sorularında süre kaybettim...">${escapeHtml(savedReport.focusNote || '')}</textarea>
        </label>
        <label>
          <span>Gelecek ay hedefim</span>
          <textarea id="report-goal-note" rows="4" placeholder="Örn. Her sabah 20 paragraf + haftada 2 TYT genel denemesi...">${escapeHtml(savedReport.goalNote || '')}</textarea>
        </label>
        <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end;">
          <button type="submit" class="btn-primary">Rapor Notlarını Kaydet</button>
        </div>
      </form>
    </section>
  `;
}

function changeReportMonth(val) {
  if (!val) return;
  reportMonth = val;
  renderWorkspaceView();
}

async function saveMonthlyReport(event) {
  if (event) event.preventDefault();
  if (!currentUser) return;
  const focusNote = document.getElementById('report-focus-note')?.value || '';
  const goalNote = document.getElementById('report-goal-note')?.value || '';
  const nextReports = {
    ...(userState.reports || {}),
    [reportMonth]: { focusNote, goalNote, updatedAt: new Date().toISOString() }
  };
  userState = await accountStore.saveUserState(currentUser.id, { reports: nextReports });
  renderWorkspaceView();
}

// ============================================================================
// 7. DENEMELERİM (exams) — TYT / AYT NET HESAPLAYICI VE DENEME TAKİBİ
// ============================================================================
function buildExamsViewHtml() {
  const exams = userState.exams || [];
  const rowsConfig = examSubjects[examFormType] || examSubjects.TYT;

  const chartHtml =
    exams.length === 0
      ? `<div class="empty-inline"><p>Henüz deneme sonucu eklemedin. Sağdaki formdan ilk TYT veya AYT denemeni kaydet.</p></div>`
      : `
        <div class="net-chart">
          ${exams
            .slice(0, 10)
            .reverse()
            .map((ex) => {
              const maxNet = ex.examType === 'AYT' ? 80 : 120;
              const hPct = Math.min(100, Math.max(12, Math.round((ex.totalNet / maxNet) * 100)));
              return `
                <div class="net-bar-col">
                  <div class="net-bar-wrap">
                    <div class="net-bar" style="height:${hPct}%">
                      <span>${ex.totalNet}</span>
                    </div>
                  </div>
                  <small>${escapeHtml(formatShortDate(ex.examDate))}</small>
                </div>
              `;
            })
            .join('')}
        </div>
        <div class="exam-list" style="margin-top:14px;">
          ${exams
            .map(
              (ex) => `
            <article class="exam-item">
              <div>
                <div class="tag-row">
                  <span class="pill">${escapeHtml(ex.examType)}</span>
                  <span>${escapeHtml(formatShortDate(ex.examDate))}</span>
                </div>
                <h3 style="margin-top:6px;">${escapeHtml(ex.title)}</h3>
                <div class="exam-chips">
                  ${(ex.scores || [])
                    .map(
                      (sc) => `<span class="pill subtle">${escapeHtml(sc.subject)}: ${sc.net} net (${sc.correct}D/${sc.wrong}Y)</span>`
                    )
                    .join('')}
                </div>
              </div>
              <div class="exam-net">
                <strong>${ex.totalNet}</strong>
                <span>Toplam Net</span>
                <button type="button" class="link-btn danger" onclick="window.appController.deleteExam('${escapeHtml(ex.id)}')">Sil</button>
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      `;

  return `
    <section class="exam-layout">
      <form class="panel exam-form" onsubmit="window.appController.saveExamForm(event)">
        <div class="panel-head">
          <div>
            <span class="eyebrow">4 yanlış 1 doğruyu götürür</span>
            <h2>Deneme sonucu ekle</h2>
          </div>
          <select onchange="window.appController.changeExamFormType(this.value)" style="width:auto;">
            <option value="TYT" ${examFormType === 'TYT' ? 'selected' : ''}>TYT (120 Soru)</option>
            <option value="AYT" ${examFormType === 'AYT' ? 'selected' : ''}>AYT</option>
          </select>
        </div>

        <label>
          <span>Yayın / Deneme adı</span>
          <input type="text" id="exam-title" required placeholder="Örn. 3D Türkiye Geneli TYT-2" />
        </label>
        <label>
          <span>Tarih</span>
          <input type="date" id="exam-date" value="${todayKey()}" required />
        </label>

        <div class="score-table">
          <div class="score-head">
            <span>Ders</span>
            <span>Doğru</span>
            <span>Yanlış</span>
            <span>Boş</span>
          </div>
          ${rowsConfig
            .map(
              (r, idx) => `
            <div class="score-row">
              <span>${escapeHtml(r.name)} <small style="color:var(--ink-muted);">(${r.count})</small></span>
              <input type="number" min="0" max="${r.count}" id="exam-c-${idx}" placeholder="0" />
              <input type="number" min="0" max="${r.count}" id="exam-w-${idx}" placeholder="0" />
              <input type="number" min="0" max="${r.count}" id="exam-b-${idx}" placeholder="0" />
            </div>
          `
            )
            .join('')}
        </div>

        <button type="submit" class="btn-primary full">Deneme Netini Hesapla ve Kaydet</button>
      </form>

      <div class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Net gelişim grafiğin</span>
            <h2>Deneme geçmişim (${exams.length})</h2>
          </div>
        </div>
        ${chartHtml}
      </div>
    </section>
  `;
}

function changeExamFormType(type) {
  examFormType = type === 'AYT' ? 'AYT' : 'TYT';
  renderWorkspaceView();
}

async function saveExamForm(event) {
  if (event) event.preventDefault();
  if (!currentUser) return;
  const title = (document.getElementById('exam-title')?.value || '').trim();
  const examDate = document.getElementById('exam-date')?.value || todayKey();
  const rowsConfig = examSubjects[examFormType] || examSubjects.TYT;

  let totalNet = 0;
  const scores = rowsConfig.map((r, idx) => {
    const correct = Number(document.getElementById(`exam-c-${idx}`)?.value || 0);
    const wrong = Number(document.getElementById(`exam-w-${idx}`)?.value || 0);
    const blank = Number(document.getElementById(`exam-b-${idx}`)?.value || 0);
    const net = calculateExamNet(correct, wrong);
    totalNet += net;
    return { subject: r.name, correct, wrong, blank, net };
  });

  totalNet = Math.round(totalNet * 100) / 100;
  const newExam = {
    id: `ex_${Date.now()}`,
    title: title || `${examFormType} Denemesi`,
    examType: examFormType,
    examDate,
    scores,
    totalNet,
    createdAt: new Date().toISOString()
  };

  const nextExams = [newExam, ...(userState.exams || [])];
  userState = await accountStore.saveUserState(currentUser.id, { exams: nextExams });
  renderAll();
}

async function deleteExam(examId) {
  if (!currentUser) return;
  const nextExams = (userState.exams || []).filter((e) => e.id !== examId);
  userState = await accountStore.saveUserState(currentUser.id, { exams: nextExams });
  renderAll();
}

// ============================================================================
// 8. DERS NOTLARIM (notes) — MEB MAARİF MODELİ KONU SEÇİCİLİ DERS NOTLARI
// ============================================================================
function buildNotesViewHtml() {
  const studyNotes = userState.studyNotes || [];
  const availableTopics = topicOptions(noteFilterSubject, noteFilterGrade);

  return `
    <section class="exam-layout">
      <form class="panel exam-form" onsubmit="window.appController.saveStudyNote(event)">
        <div class="panel-head">
          <div>
            <span class="eyebrow">MEB Türkiye Yüzyılı Maarif Modeli</span>
            <h2>Yeni ders notu ekle</h2>
          </div>
        </div>

        <div class="form-grid">
          <label>
            <span>Ders</span>
            <select id="note-subject" onchange="window.appController.changeNoteSubject(this.value)">
              ${subjects
                .map(
                  (s) => `<option value="${escapeHtml(s)}" ${noteFilterSubject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>Sınıf düzeyi</span>
            <select id="note-grade" onchange="window.appController.changeNoteGrade(this.value)">
              ${grades
                .map(
                  (g) => `<option value="${escapeHtml(g)}" ${noteFilterGrade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`
                )
                .join('')}
            </select>
          </label>
        </div>

        <label>
          <span>Maarif Modeli Konusu</span>
          <select id="note-topic">
            ${availableTopics
              .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
              .join('')}
          </select>
        </label>

        <label>
          <span>Not başlığı</span>
          <input type="text" id="note-title" required placeholder="Örn. Üslü ifadelerde taban değiştirme kuralı" />
        </label>

        <label>
          <span>Not içeriği / Formül / İpucu</span>
          <textarea id="note-body" rows="5" required placeholder="Kendi cümlelerinle özet veya unutmaman gereken püf noktası..."></textarea>
        </label>

        <button type="submit" class="btn-primary full">Ders Notunu Kaydet</button>
      </form>

      <div class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Kayıtlı çalışma özetlerin</span>
            <h2>Ders notlarım (${studyNotes.length})</h2>
          </div>
        </div>

        ${
          studyNotes.length === 0
            ? `<div class="empty-inline"><p>Henüz ders notu eklemedin. Soldaki MEB Maarif Modeli konu listesinden seçip ilk özetini ekleyebilirsin.</p></div>`
            : `<div class="notes-list">
                ${studyNotes
                  .map(
                    (n) => `
                  <article class="note-card">
                    <div class="note-card-head">
                      <div>
                        <div class="tag-row">
                          <span class="pill">${escapeHtml(n.subject)}</span>
                          <span class="pill subtle">${escapeHtml(n.grade || '')}</span>
                          <span>${escapeHtml(formatShortDate(n.createdAt))}</span>
                        </div>
                        <h3 style="margin-top:6px;">${escapeHtml(n.title)}</h3>
                        <small style="color:var(--ink-muted);">${escapeHtml(n.topic)}</small>
                      </div>
                      <button type="button" class="link-btn danger" onclick="window.appController.deleteStudyNote('${escapeHtml(n.id)}')">Sil</button>
                    </div>
                    <p>${escapeHtml(n.body)}</p>
                  </article>
                `
                  )
                  .join('')}
              </div>`
        }
      </div>
    </section>
  `;
}

function changeNoteSubject(subj) {
  noteFilterSubject = subj;
  renderWorkspaceView();
}

function changeNoteGrade(grd) {
  noteFilterGrade = grd;
  renderWorkspaceView();
}

async function saveStudyNote(event) {
  if (event) event.preventDefault();
  if (!currentUser) return;
  const subject = document.getElementById('note-subject')?.value || noteFilterSubject;
  const grade = document.getElementById('note-grade')?.value || noteFilterGrade;
  const topic = document.getElementById('note-topic')?.value || 'Genel';
  const title = (document.getElementById('note-title')?.value || '').trim();
  const body = (document.getElementById('note-body')?.value || '').trim();
  if (!title || !body) return;

  const newNote = {
    id: `sn_${Date.now()}`,
    subject,
    grade,
    topic,
    title,
    body,
    createdAt: todayKey()
  };

  const nextNotes = [newNote, ...(userState.studyNotes || [])];
  userState = await accountStore.saveUserState(currentUser.id, { studyNotes: nextNotes });
  renderWorkspaceView();
}

async function deleteStudyNote(noteId) {
  if (!currentUser) return;
  const nextNotes = (userState.studyNotes || []).filter((n) => n.id !== noteId);
  userState = await accountStore.saveUserState(currentUser.id, { studyNotes: nextNotes });
  renderWorkspaceView();
}

// ============================================================================
// 9. AYARLAR (settings) — ÖĞRENCİ PROFİLİ, SUPABASE BULUT VE YEDEKLEME
// ============================================================================
function buildSettingsViewHtml() {
  const p = userState.profile || {};
  const cloud = accountStore.getCloudConfig();

  return `
    <section class="settings-grid">
      <form class="panel settings-form" onsubmit="window.appController.saveProfileSettings(event)">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Öğrenci kimliği &amp; hedefler</span>
            <h2>Profil ayarları</h2>
          </div>
        </div>

        <label>
          <span>Ad Soyad</span>
          <input type="text" id="set-name" value="${escapeHtml(p.name || currentUser?.name || '')}" required />
        </label>
        <div class="form-grid">
          <label>
            <span>Sınıf</span>
            <select id="set-grade">
              ${grades
                .map((g) => `<option value="${escapeHtml(g)}" ${p.grade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`)
                .join('')}
            </select>
          </label>
          <label>
            <span>Hedef Sıralama / Sınav</span>
            <input type="text" id="set-target" value="${escapeHtml(p.target || 'İlk 10.000')}" />
          </label>
        </div>
        <div class="form-grid">
          <label>
            <span>Hedef Sınav Tarihi</span>
            <input type="date" id="set-exam-date" value="${escapeHtml(p.examDate || '2027-06-20')}" />
          </label>
          <label>
            <span>Günlük Soru Tekrar Hedefi</span>
            <input type="number" min="1" max="50" id="set-daily-goal" value="${Number(p.dailyGoal || 5)}" />
          </label>
        </div>
        <label>
          <span>Çalışma mottosu</span>
          <input type="text" id="set-motto" value="${escapeHtml(p.motto || '')}" placeholder="Her gün 1 net daha ileri!" />
        </label>

        <button type="submit" class="btn-primary">Profil Bilgilerimi Güncelle</button>
      </form>

      <div class="panel settings-side">
        <div>
          <span class="eyebrow">Çoklu Cihaz &amp; Bulut</span>
          <h3>Supabase Bulut Senkronizasyonu</h3>
          <p>
            Durum: <strong style="color:var(--accent-2);">${cloud.enabled ? 'Aktif (Otomatik Yedekleniyor)' : 'Pasif'}</strong>
          </p>
          <p style="margin-top:6px;">
            Hesap E-postası: <strong>${escapeHtml(currentUser?.email || '')}</strong>
          </p>
        </div>

        <div>
          <span class="eyebrow">Kişisel Kamp Kurulumu</span>
          <h3>Okul, Özel Ders ve Spor Saatleri</h3>
          <p>Hafta içi okul saatlerini (08:00-16:00), özel derslerini ve spor splitini istediğin an güncelleyebilirsin.</p>
          <button type="button" class="btn-ghost" style="margin-top:10px;width:100%;" onclick="window.appController.openWizardModal()">
            ⚙️ 4 Adımlı Kamp &amp; Spor Sihirbazını Aç
          </button>
        </div>

        <div>
          <span class="eyebrow">Veri Taşıma</span>
          <h3>Yedek İndir / Geri Yükle</h3>
          <div class="backup-buttons" style="margin-top:10px;">
            <button type="button" class="btn-ghost" onclick="window.appController.exportFullBackupJson()">JSON Yedek İndir</button>
            <button type="button" class="btn-ghost" onclick="window.appController.handleLogout()" style="color:var(--rose);">Oturumu Kapat</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

async function saveProfileSettings(event) {
  if (event) event.preventDefault();
  if (!currentUser) return;
  const nextProfile = {
    ...(userState.profile || {}),
    name: (document.getElementById('set-name')?.value || '').trim() || currentUser.name,
    grade: document.getElementById('set-grade')?.value || '12. Sınıf',
    target: (document.getElementById('set-target')?.value || '').trim(),
    examDate: document.getElementById('set-exam-date')?.value || '2027-06-20',
    dailyGoal: Number(document.getElementById('set-daily-goal')?.value || 5),
    motto: (document.getElementById('set-motto')?.value || '').trim()
  };
  userState = await accountStore.saveUserState(currentUser.id, { profile: nextProfile });
  renderAll();
}

function exportFullBackupJson() {
  const blob = new Blob([JSON.stringify(userState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `net-defterim-tyt-yedek-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// 10. SORU YÜKLEME MODALI & ARALIKLI TEKRAR DETAY MODALI
// ============================================================================
function openUploadModal(prefillSubject = 'Matematik', prefillTopic = '') {
  uploadPhotoDataUrl = '';
  uploadSubject = subjects.includes(prefillSubject) ? prefillSubject : 'Matematik';
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  renderUploadModalBody(prefillTopic);
  modal.style.display = 'grid';
}

function openUploadForCampTopic(subj, topic) {
  const cleanSubj = String(subj || '').replace(/^TYT\s+/i, '').trim();
  const matchedSubj = subjects.find((s) => cleanSubj.includes(s)) || 'Matematik';
  openUploadModal(matchedSubj, topic);
}

function closeUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (modal) modal.style.display = 'none';
}

function renderUploadModalBody(prefillTopic = '') {
  const body = document.getElementById('upload-modal-body');
  if (!body) return;
  const topics = topicOptions(uploadSubject);
  const defaultTopic = prefillTopic ? normalizeTopic(uploadSubject, prefillTopic) : topics[0] || '';

  body.innerHTML = `
    <div class="dialog-head">
      <div>
        <span class="eyebrow">Yeni yanlış soru kaydı</span>
        <h2>Soruyu defterine ekle</h2>
      </div>
      <button type="button" class="icon-close" onclick="window.appController.closeUploadModal()">×</button>
    </div>

    <form class="dialog-form" onsubmit="window.appController.submitNewQuestion(event)">
      <div class="photo-picker">
        ${
          uploadPhotoDataUrl
            ? `<div class="photo-preview">
                <img src="${uploadPhotoDataUrl}" alt="Soru önizleme" />
                <div class="photo-preview-actions">
                  <button type="button" class="link-btn danger" onclick="window.appController.clearUploadPhoto()">Fotoğrafı kaldır</button>
                </div>
              </div>`
            : `<div class="photo-buttons">
                <label class="photo-drop">
                  <input type="file" accept="image/*" hidden onchange="window.appController.handleQuestionPhotoInput(event)" />
                  <strong>📷 Soru fotoğrafı seç veya sürükle</strong>
                  <small>Fotoğraf eklemeden sadece konu ve notla da kaydedebilirsin</small>
                </label>
              </div>`
        }
      </div>

      <div class="form-grid">
        <label>
          <span>Ders</span>
          <select id="up-subject" onchange="window.appController.changeUploadSubject(this.value)">
            ${subjects
              .map((s) => `<option value="${escapeHtml(s)}" ${uploadSubject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span>Sınav türü</span>
          <select id="up-exam-type">
            ${examTypes.map((et) => `<option value="${escapeHtml(et)}">${escapeHtml(et)}</option>`).join('')}
          </select>
        </label>
      </div>

      <label>
        <span>Konu (MEB Maarif Müfredatı)</span>
        <input type="text" id="up-topic" list="up-topic-datalist" value="${escapeHtml(defaultTopic)}" required placeholder="Konu seç veya yaz..." />
        <datalist id="up-topic-datalist">
          ${topics.map((t) => `<option value="${escapeHtml(t)}"></option>`).join('')}
        </datalist>
      </label>

      <div class="form-grid">
        <label>
          <span>Hata nedeni</span>
          <select id="up-mistake">
            ${mistakes.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Kaynak / Deneme adı</span>
          <input type="text" id="up-source" placeholder="Örn. Orijinal TYT Matematik" />
        </label>
      </div>

      <label>
        <span>Nerede takıldın? / Çözüm notun</span>
        <textarea id="up-note" rows="3" placeholder="Bu soruda kaçırdığın kuralı veya doğru çözüm yolunu kısaca not et..."></textarea>
      </label>

      <div class="dialog-foot">
        <button type="button" class="btn-ghost" onclick="window.appController.closeUploadModal()">Vazgeç</button>
        <button type="submit" class="btn-primary">Soruyu Kaydet (Yarın İlk Tekrar)</button>
      </div>
    </form>
  `;
}

function changeUploadSubject(newSubj) {
  uploadSubject = newSubj;
  renderUploadModalBody('');
}

function handleQuestionPhotoInput(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    uploadPhotoDataUrl = String(reader.result || '');
    const currentTopic = document.getElementById('up-topic')?.value || '';
    renderUploadModalBody(currentTopic);
  };
  reader.readAsDataURL(file);
}

function clearUploadPhoto() {
  uploadPhotoDataUrl = '';
  const currentTopic = document.getElementById('up-topic')?.value || '';
  renderUploadModalBody(currentTopic);
}

async function submitNewQuestion(event) {
  if (event) event.preventDefault();
  if (!currentUser) return;
  const subject = document.getElementById('up-subject')?.value || 'Matematik';
  const examType = document.getElementById('up-exam-type')?.value || 'TYT';
  const rawTopic = document.getElementById('up-topic')?.value || '';
  const mistakeReason = document.getElementById('up-mistake')?.value || 'knowledge';
  const source = (document.getElementById('up-source')?.value || '').trim();
  const note = (document.getElementById('up-note')?.value || '').trim();

  const created = todayKey();
  const newQuestion = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    subject,
    examType,
    topic: normalizeTopic(subject, rawTopic),
    mistakeReason,
    source,
    note,
    solutionNote: '',
    imageData: uploadPhotoDataUrl || '',
    status: 'pending',
    reviewStage: 0,
    reviewCount: 0,
    createdAt: created,
    nextReview: addDays(created, intervals[0])
  };

  const nextQuestions = [newQuestion, ...(userState.questions || [])];
  userState = await accountStore.saveUserState(currentUser.id, { questions: nextQuestions });
  closeUploadModal();
  renderAll();
}

function openQuestionModal(questionId) {
  const item = (userState.questions || []).find((q) => q.id === questionId);
  const modal = document.getElementById('question-modal');
  const body = document.getElementById('question-modal-body');
  if (!item || !modal || !body) return;

  body.innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="tag-row">
          <span class="pill">${escapeHtml(item.subject)}</span>
          <span class="pill subtle">${escapeHtml(item.examType || 'TYT')}</span>
          <span class="pill warn">${escapeHtml(mistakeLabel(item.mistakeReason))}</span>
        </div>
        <h2 style="margin-top:6px;">${escapeHtml(item.topic)}</h2>
      </div>
      <button type="button" class="icon-close" onclick="window.appController.closeQuestionModal()">×</button>
    </div>

    <div class="detail-grid">
      <div class="detail-image">
        ${
          item.imageData
            ? `<img src="${item.imageData}" alt="${escapeHtml(item.topic)}" />`
            : `<div class="no-photo large">
                <span>${escapeHtml(item.subject)}</span>
                <strong>${escapeHtml(item.topic)}</strong>
              </div>`
        }
      </div>
      <div class="detail-info">
        <div class="meta-box">
          <div>
            <span>Durum</span>
            <strong>${escapeHtml(statusLabel(item.status))}</strong>
          </div>
          <div>
            <span>Tekrar aşaması</span>
            <strong>${(item.reviewStage || 0) + 1} / ${intervals.length} (${intervals[item.reviewStage || 0]} gün)</strong>
          </div>
          <div>
            <span>Sonraki tekrar</span>
            <strong>${escapeHtml(formatShortDate(item.nextReview))}</strong>
          </div>
        </div>

        <label>
          <span>Hata ve çözüm notun</span>
          <textarea id="detail-note-input" rows="4">${escapeHtml(item.note || '')}</textarea>
        </label>

        <div class="review-box">
          <span>Bugünkü tekrar sonucunu işaretle:</span>
          <div class="due-actions">
            <button type="button" class="review-btn hard" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'hard', true)">Zorlandım (1 güne sıfırla)</button>
            <button type="button" class="review-btn ok" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'ok', true)">Çözdüm (+1 aşama)</button>
            <button type="button" class="review-btn easy" onclick="window.appController.reviewQuestion('${escapeHtml(item.id)}', 'easy', true)">Çok kolaydı (+2 aşama)</button>
          </div>
        </div>

        <div class="dialog-foot">
          <button type="button" class="link-btn danger" onclick="window.appController.deleteQuestion('${escapeHtml(item.id)}')">Soruyu Sil</button>
          <button type="button" class="btn-primary" onclick="window.appController.saveQuestionNote('${escapeHtml(item.id)}')">Notu Güncelle</button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'grid';
}

function closeQuestionModal() {
  const modal = document.getElementById('question-modal');
  if (modal) modal.style.display = 'none';
}

async function reviewQuestion(questionId, result, closeAfter = false) {
  if (!currentUser) return;
  const nextQuestions = (userState.questions || []).map((q) => {
    if (q.id !== questionId) return q;
    const sched = scheduleReview(q.reviewStage || 0, result, todayKey());
    return {
      ...q,
      reviewStage: sched.stage,
      status: sched.status,
      nextReview: sched.nextReview,
      reviewCount: (q.reviewCount || 0) + 1
    };
  });
  userState = await accountStore.saveUserState(currentUser.id, { questions: nextQuestions });
  if (closeAfter) closeQuestionModal();
  renderAll();
}

async function saveQuestionNote(questionId) {
  if (!currentUser) return;
  const noteVal = document.getElementById('detail-note-input')?.value || '';
  const nextQuestions = (userState.questions || []).map((q) =>
    q.id === questionId ? { ...q, note: noteVal } : q
  );
  userState = await accountStore.saveUserState(currentUser.id, { questions: nextQuestions });
  closeQuestionModal();
  renderAll();
}

async function deleteQuestion(questionId) {
  if (!currentUser) return;
  const nextQuestions = (userState.questions || []).filter((q) => q.id !== questionId);
  userState = await accountStore.saveUserState(currentUser.id, { questions: nextQuestions });
  closeQuestionModal();
  renderAll();
}

// ============================================================================
// 11. 4 ADIMLI KİŞİSEL TYT KAMPI & SPOR SİHİRBAZI MODALI
// ============================================================================
function openWizardModal() {
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
    ? userState.fixedBlocks.map((b) => ({ ...b, days: [...(b.days || ['Pzt'])] }))
    : [];
  wizardSportConfig = {
    programId: userState.sportConfig?.programId || 'ppl',
    start: userState.sportConfig?.start || '17:00',
    end: userState.sportConfig?.end || '18:30',
    customNote: userState.sportConfig?.customNote || ''
  };
  wizardTempoKey = userState.tempoKey || 'balanced';
  wizardPreviewDayKey = 'Pzt';

  const modal = document.getElementById('onboarding-wizard-modal');
  if (!modal) return;
  renderWizardModalContent();
  modal.style.display = 'grid';
}

function closeWizardModal() {
  const modal = document.getElementById('onboarding-wizard-modal');
  if (modal) modal.style.display = 'none';
}

function setWizardStep(step) {
  syncWizardDomInputs();
  wizardStep = step;
  renderWizardModalContent();
}

function syncWizardDomInputs() {
  const schCheck = document.getElementById('wiz-school-enabled');
  const schStart = document.getElementById('wiz-school-start');
  const schEnd = document.getElementById('wiz-school-end');
  if (schCheck) wizardSchoolConfig.enabled = Boolean(schCheck.checked);
  if (schStart && schEnd) {
    const norm = normalizeTimeRange(schStart.value || '08:00', schEnd.value || '16:00', 480);
    wizardSchoolConfig.start = norm.start;
    wizardSchoolConfig.end = norm.end;
  }

  const spStart = document.getElementById('wiz-sport-start');
  const spEnd = document.getElementById('wiz-sport-end');
  const spNote = document.getElementById('wiz-sport-note');
  if (spStart && spEnd) {
    const normSp = normalizeTimeRange(spStart.value || '17:00', spEnd.value || '18:30', 90);
    wizardSportConfig.start = normSp.start;
    wizardSportConfig.end = normSp.end;
  }
  if (spNote) {
    wizardSportConfig.customNote = spNote.value.trim();
  }
}

function renderWizardModalContent() {
  const body = document.getElementById('onboarding-wizard-body');
  if (!body) return;

  let stepContent = '';
  if (wizardStep === 1) {
    stepContent = `
      <div style="display:grid;gap:14px;">
        <div style="padding:14px;border-radius:12px;background:var(--bg-soft);border:1px solid var(--border);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <strong>🏫 Hafta İçi Okul Saatlerin (Pazartesi – Cuma)</strong>
              <p style="font-size:0.8rem;color:var(--ink-soft);">Okulda olduğun saatlere asla TYT dersi koyulmaz.</p>
            </div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;">
              <input type="checkbox" id="wiz-school-enabled" ${wizardSchoolConfig.enabled ? 'checked' : ''} style="width:18px;height:18px;" />
              <span>Hafta İçi Okulum Var</span>
            </label>
          </div>
          <div class="form-grid" style="margin-top:10px;">
            <label>
              <span>Okul Başlangıç</span>
              <input type="time" id="wiz-school-start" value="${escapeHtml(wizardSchoolConfig.start)}" />
            </label>
            <label>
              <span>Okul Çıkış</span>
              <input type="time" id="wiz-school-end" value="${escapeHtml(wizardSchoolConfig.end)}" />
            </label>
          </div>
        </div>

        <div style="padding:14px;border-radius:12px;background:var(--bg-soft);border:1px solid var(--border);">
          <strong>📌 Özel Ders, Dershane veya Kurs Bloğu Ekle</strong>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;">
            ${ALL_DAYS.map(
              (d) => `
              <button type="button" class="wizard-step-pill ${wizardSelectedDays.includes(d) ? 'active' : ''}" onclick="window.appController.toggleWizardDay('${d}')">
                ${d}
              </button>
            `
            ).join('')}
          </div>
          <div class="form-grid">
            <input type="text" id="wiz-block-title" placeholder="Örn. Fizik Özel Ders" />
            <div style="display:flex;gap:8px;">
              <input type="time" id="wiz-block-start" value="19:30" />
              <input type="time" id="wiz-block-end" value="21:00" />
              <button type="button" class="btn-primary" onclick="window.appController.addWizardBlock()">+ Ekle</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
            ${
              wizardFixedBlocks.length === 0
                ? `<span style="font-size:0.8rem;color:var(--ink-muted);">Ekstra sabit blok eklenmedi.</span>`
                : wizardFixedBlocks
                    .map(
                      (b, i) => `
                  <span class="camp-pill">
                    📌 ${escapeHtml(b.title)} (${escapeHtml(b.days.join(','))} ${escapeHtml(b.start)}-${escapeHtml(b.end)})
                    <button type="button" onclick="window.appController.removeWizardBlock(${i})" style="margin-left:4px;color:var(--rose);">×</button>
                  </span>
                `
                    )
                    .join('')
            }
          </div>
        </div>

        <div class="dialog-foot">
          <button type="button" class="btn-ghost" onclick="window.appController.closeWizardModal()">Kapat</button>
          <button type="button" class="btn-primary" onclick="window.appController.setWizardStep(2)">2. Adım: Spor Programı →</button>
        </div>
      </div>
    `;
  } else if (wizardStep === 2) {
    stepContent = `
      <div>
        <div class="wizard-option-grid">
          ${SPORT_PROGRAMS.map(
            (sp) => `
            <div class="wizard-option-card ${wizardSportConfig.programId === sp.id ? 'selected' : ''}" onclick="window.appController.selectWizardSport('${sp.id}')">
              <strong>${escapeHtml(sp.name)}</strong>
              <p style="font-size:0.78rem;color:var(--ink-soft);margin-top:4px;">${escapeHtml(sp.cycleDesc)}</p>
            </div>
          `
          ).join('')}
        </div>
        <div class="form-grid">
          <label>
            <span>Antrenman Başlangıç Saati</span>
            <input type="time" id="wiz-sport-start" value="${escapeHtml(wizardSportConfig.start)}" />
          </label>
          <label>
            <span>Antrenman Bitiş Saati</span>
            <input type="time" id="wiz-sport-end" value="${escapeHtml(wizardSportConfig.end)}" />
          </label>
        </div>
        <label style="margin-top:10px;display:grid;gap:6px;">
          <span style="font-size:0.82rem;color:var(--ink-soft);">Özel Notun (Örn: hafta sonu spor yok, eve 19:00'da ulaşıyorum)</span>
          <input type="text" id="wiz-sport-note" value="${escapeHtml(wizardSportConfig.customNote)}" placeholder="Notuna göre hafta sonu spor kapatılır ve eve varış saatin korunur" />
        </label>
        <div class="dialog-foot" style="margin-top:14px;">
          <button type="button" class="btn-ghost" onclick="window.appController.setWizardStep(1)">← 1. Adım</button>
          <button type="button" class="btn-primary" onclick="window.appController.setWizardStep(3)">3. Adım: Kamp Yoğunluğu →</button>
        </div>
      </div>
    `;
  } else if (wizardStep === 3) {
    stepContent = `
      <div>
        <div class="wizard-option-grid">
          ${Object.values(TEMPO_OPTIONS)
            .map(
              (tp) => `
            <div class="wizard-option-card ${wizardTempoKey === tp.id ? 'selected' : ''}" onclick="window.appController.selectWizardTempo('${tp.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${escapeHtml(tp.name)}</strong>
                <span class="pill">${tp.totalWeeks} Hafta</span>
              </div>
              <p style="font-size:0.8rem;color:var(--accent-2);font-weight:600;margin-top:6px;">${escapeHtml(tp.exampleLabel)}</p>
              <p style="font-size:0.78rem;color:var(--ink-soft);margin-top:4px;">${escapeHtml(tp.desc)}</p>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn-ghost" onclick="window.appController.setWizardStep(2)">← 2. Adım</button>
          <button type="button" class="btn-primary" onclick="window.appController.setWizardStep(4)">4. Adım: Birleşik Programı Gör →</button>
        </div>
      </div>
    `;
  } else {
    const previewWeeks = generateCampaignWeeks(wizardTempoKey);
    const dayIdx = Math.max(0, ALL_DAYS.indexOf(wizardPreviewDayKey));
    const unified = buildUnifiedDailySchedule({
      dayKey: wizardPreviewDayKey,
      schoolConfig: wizardSchoolConfig,
      fixedBlocks: wizardFixedBlocks,
      sportConfig: wizardSportConfig,
      tempoKey: wizardTempoKey,
      lesson: previewWeeks[0].days[dayIdx]
    });

    stepContent = `
      <div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          ${ALL_DAYS.map(
            (d) => `
            <button type="button" class="wizard-step-pill ${wizardPreviewDayKey === d ? 'active' : ''}" onclick="window.appController.setWizardPreviewDay('${d}')">
              ${escapeHtml(DAY_FULL_NAMES[d])}
            </button>
          `
          ).join('')}
        </div>

        <div class="camp-slot-list" style="margin-bottom:16px;">
          ${unified.timeline
            .map(
              (slot) => `
            <div class="camp-slot-item type-${escapeHtml(slot.type)}">
              <div>
                <span class="camp-slot-time">${escapeHtml(slot.time)}</span>
                <strong style="margin-left:8px;">${escapeHtml(slot.title)}</strong>
              </div>
              <span class="pill subtle">${escapeHtml(slot.tag)}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="dialog-foot">
          <button type="button" class="btn-ghost" onclick="window.appController.setWizardStep(3)">← Yoğunluğu Değiştir</button>
          <button type="button" class="btn-primary" onclick="window.appController.saveWizardAndStart()">✓ Kişisel Programımı Kaydet ve Başlat</button>
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div class="dialog-head">
      <div>
        <span class="eyebrow">Okul · Özel Ders · Spor · Maarif TYT Kampı</span>
        <h2>Kişisel Düzen ve Kamp Sihirbazı</h2>
      </div>
      <button type="button" class="icon-close" onclick="window.appController.closeWizardModal()">×</button>
    </div>

    <div class="wizard-steps-nav">
      <button type="button" class="wizard-step-pill ${wizardStep === 1 ? 'active' : ''}" onclick="window.appController.setWizardStep(1)">1. Okul &amp; Sabit Düzen</button>
      <button type="button" class="wizard-step-pill ${wizardStep === 2 ? 'active' : ''}" onclick="window.appController.setWizardStep(2)">2. Spor Programı</button>
      <button type="button" class="wizard-step-pill ${wizardStep === 3 ? 'active' : ''}" onclick="window.appController.setWizardStep(3)">3. Kamp Yoğunluğu</button>
      <button type="button" class="wizard-step-pill ${wizardStep === 4 ? 'active' : ''}" onclick="window.appController.setWizardStep(4)">4. Birleşik Program</button>
    </div>

    ${stepContent}
  `;
}

function toggleWizardDay(day) {
  syncWizardDomInputs();
  if (wizardSelectedDays.includes(day)) {
    if (wizardSelectedDays.length > 1) wizardSelectedDays = wizardSelectedDays.filter((d) => d !== day);
  } else {
    wizardSelectedDays.push(day);
  }
  renderWizardModalContent();
}

function addWizardBlock() {
  syncWizardDomInputs();
  const title = (document.getElementById('wiz-block-title')?.value || '').trim();
  const start = document.getElementById('wiz-block-start')?.value || '19:30';
  const end = document.getElementById('wiz-block-end')?.value || '21:00';
  if (!title) return;
  const norm = normalizeTimeRange(start, end, 90);
  wizardFixedBlocks.push({
    id: `blk_${Date.now()}`,
    title,
    days: [...wizardSelectedDays],
    start: norm.start,
    end: norm.end
  });
  renderWizardModalContent();
}

function removeWizardBlock(idx) {
  syncWizardDomInputs();
  wizardFixedBlocks.splice(idx, 1);
  renderWizardModalContent();
}

function selectWizardSport(programId) {
  syncWizardDomInputs();
  wizardSportConfig.programId = programId;
  renderWizardModalContent();
}

function selectWizardTempo(tempoKey) {
  wizardTempoKey = tempoKey;
  renderWizardModalContent();
}

function setWizardPreviewDay(dayKey) {
  wizardPreviewDayKey = dayKey;
  renderWizardModalContent();
}

async function saveWizardAndStart() {
  if (!currentUser) return;
  syncWizardDomInputs();
  userState = await accountStore.updateOnboardingConfig(currentUser.id, {
    schoolConfig: wizardSchoolConfig,
    fixedBlocks: wizardFixedBlocks,
    sportConfig: wizardSportConfig,
    tempoKey: wizardTempoKey
  });
  closeWizardModal();
  renderAll();
}

// ============================================================================
// 12. WEB AUDIO API ALARM SİSTEMİ
// ============================================================================
function playBeep(freq = 784, duration = 0.2) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

function testAlarmSound() {
  playBeep(784, 0.18);
  setTimeout(() => playBeep(988, 0.22), 200);
}

async function updateAlarmTime(val) {
  if (!currentUser || !val) return;
  userState = await accountStore.saveUserState(currentUser.id, {
    alarm: { ...(userState.alarm || {}), enabled: true, time: val }
  });
}

function checkAlarmWallClock() {
  if (!userState.alarm || userState.alarm.enabled === false) return;
  const target = (userState.alarm.time || '08:00').trim();
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const stamp = `${todayKey()} ${hm}`;
  if (hm === target && lastTriggeredAlarmStamp !== stamp) {
    lastTriggeredAlarmStamp = stamp;
    testAlarmSound();
  }
}

function initAlarmLoop() {
  if (!alarmWallClockId) {
    alarmWallClockId = setInterval(checkAlarmWallClock, 15000);
  }
}

// ============================================================================
// 13. GLOBAL CONTROLLER & BAŞLATMA
// ============================================================================
const appController = {
  switchAuthTab,
  quickFillAccount,
  handleLogin,
  handleRegister,
  handleLogout,
  setView,
  openUploadModal,
  openUploadForCampTopic,
  closeUploadModal,
  changeUploadSubject,
  handleQuestionPhotoInput,
  clearUploadPhoto,
  submitNewQuestion,
  openQuestionModal,
  closeQuestionModal,
  reviewQuestion,
  saveQuestionNote,
  deleteQuestion,
  selectCampWeek,
  toggleCampSlot,
  shiftCampDay,
  undoCampShift,
  updateArchiveFilter,
  setArchiveGrouping,
  exportArchiveCsv,
  changeReportMonth,
  saveMonthlyReport,
  changeExamFormType,
  saveExamForm,
  deleteExam,
  changeNoteSubject,
  changeNoteGrade,
  saveStudyNote,
  deleteStudyNote,
  saveProfileSettings,
  exportFullBackupJson,
  openWizardModal,
  closeWizardModal,
  setWizardStep,
  toggleWizardDay,
  addWizardBlock,
  removeWizardBlock,
  selectWizardSport,
  selectWizardTempo,
  setWizardPreviewDay,
  saveWizardAndStart,
  testAlarmSound,
  updateAlarmTime,
  checkAlarmWallClock
};

if (typeof window !== 'undefined') {
  window.appController = appController;

  window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    const existing = accountStore.getCurrentSession();
    if (existing && existing.user) {
      enterAuthenticatedApp(existing.user, existing.state, false);
    } else {
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.style.display = 'grid';
      renderSavedAccounts();
    }
  });
}
