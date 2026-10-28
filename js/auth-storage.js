const USERS_INDEX_KEY = 'tyt_multi_users_v1';
const SESSION_KEY = 'tyt_current_session_v1';
const USER_STATE_PREFIX = 'tyt_user_state_v1_';
const CLOUD_CONFIG_KEY = 'tyt_cloud_config_v1';

const DEFAULT_SUPABASE_URL = 'https://jioxqgxdsmlsmijnmqzf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_qSLTaTAaDSdVgidXoECE_A_av5DBfZg';
const DEFAULT_STORAGE_GATEWAY_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppb3hxZ3hkc21sc21pam5tcXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTExNjAsImV4cCI6MjEwODc2NzE2MH0.DUVXgMBoKWL-CTPEO4slVA0TIYALrUJ0m0lo4IvGMU8';
const STORAGE_BUCKET_NAME = 'tyt-user-states';

function simpleHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function createDefaultUserState() {
  return {
    onboardingCompleted: false,
    schoolConfig: {
      enabled: true,
      title: 'Okul Saatleri',
      days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'],
      start: '08:00',
      end: '16:00'
    },
    fixedBlocks: [],
    sportConfig: {
      programId: 'ppl',
      start: '17:00',
      end: '18:30',
      customNote: ''
    },
    tempoKey: 'balanced',
    activeWeek: 1,
    progress: {},
    offDays: {},
    notes: [],
    alarm: {
      enabled: true,
      time: '08:00'
    },
    updatedAt: new Date().toISOString()
  };
}

export function createAccountStore(options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);

  function readJson(key, fallback) {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  }

  function getUsersMap() {
    return readJson(USERS_INDEX_KEY, {});
  }

  function saveUsersMap(map) {
    writeJson(USERS_INDEX_KEY, map);
  }

  function getUserStateSync(userId) {
    const saved = readJson(`${USER_STATE_PREFIX}${userId}`, null);
    if (!saved) {
      const fresh = createDefaultUserState();
      writeJson(`${USER_STATE_PREFIX}${userId}`, fresh);
      return fresh;
    }
    return {
      ...createDefaultUserState(),
      ...saved,
      schoolConfig: {
        ...createDefaultUserState().schoolConfig,
        ...(saved.schoolConfig || {})
      },
      fixedBlocks: Array.isArray(saved.fixedBlocks) ? saved.fixedBlocks : [],
      sportConfig: {
        ...createDefaultUserState().sportConfig,
        ...(saved.sportConfig || {})
      },
      progress: { ...(saved.progress || {}) },
      offDays: { ...(saved.offDays || {}) },
      notes: Array.isArray(saved.notes) ? [...saved.notes] : [],
      alarm: {
        ...createDefaultUserState().alarm,
        ...(saved.alarm || {})
      }
    };
  }

  function getCloudConfig() {
    const cfg = readJson(CLOUD_CONFIG_KEY, null);
    const rawUrl = cfg && cfg.url !== undefined ? cfg.url : DEFAULT_SUPABASE_URL;
    const rawKey = cfg && cfg.anonKey !== undefined ? cfg.anonKey : DEFAULT_SUPABASE_ANON_KEY;
    const url = String(rawUrl || '').trim().replace(/\/+$/, '');
    const anonKey = String(rawKey || '').trim();
    return {
      url,
      anonKey,
      enabled: Boolean(url && anonKey)
    };
  }

  function saveCloudConfig({ url = '', anonKey = '' }) {
    const clean = { url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() };
    writeJson(CLOUD_CONFIG_KEY, clean);
    return getCloudConfig();
  }

  function buildSupabaseHeaders(cloud, accessToken = null, extra = {}) {
    return {
      apikey: cloud.anonKey,
      Authorization: `Bearer ${accessToken || cloud.anonKey}`,
      ...extra
    };
  }

  async function syncToSupabaseIfEnabled(userId, userProfile, state, accessToken = null) {
    const cloud = getCloudConfig();
    if (!cloud.enabled || typeof fetchFn !== 'function') return false;
    try {
      const users = getUsersMap();
      const cleanEmail = (userProfile?.email || '').trim().toLowerCase();
      const userRecord = users[cleanEmail];
      const enrichedState = {
        ...state,
        _accountMeta: {
          id: userId,
          name: userProfile?.name || userRecord?.name || '',
          email: cleanEmail,
          passwordHash: userRecord?.passwordHash || ''
        }
      };
      const payload = {
        user_id: userId,
        email: cleanEmail,
        display_name: userProfile?.name || userRecord?.name || '',
        state_json: enrichedState,
        updated_at: new Date().toISOString()
      };
      const headers = buildSupabaseHeaders(cloud, accessToken, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      });
      const res = await fetchFn(`${cloud.url}/rest/v1/user_states`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res && res.ok) return true;

      // Automatic fallback to provisioned Supabase Storage bucket 'tyt-user-states'
      const objectKey = `user_${simpleHash(cleanEmail)}.json`;
      const storageKey = cloud.url === DEFAULT_SUPABASE_URL ? DEFAULT_STORAGE_GATEWAY_KEY : cloud.anonKey;
      const upRes = await fetchFn(`${cloud.url}/storage/v1/object/${STORAGE_BUCKET_NAME}/${objectKey}`, {
        method: 'POST',
        headers: {
          apikey: storageKey,
          Authorization: `Bearer ${storageKey}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true'
        },
        body: JSON.stringify(payload)
      });
      return Boolean(upRes && upRes.ok);
    } catch {
      return false;
    }
  }

  async function pullFromSupabaseByEmail(cleanEmail) {
    const cloud = getCloudConfig();
    if (!cloud.enabled || typeof fetchFn !== 'function') return null;
    try {
      const headers = buildSupabaseHeaders(cloud, null, {
        Accept: 'application/json'
      });
      const res = await fetchFn(
        `${cloud.url}/rest/v1/user_states?email=eq.${encodeURIComponent(cleanEmail)}&select=*`,
        { method: 'GET', headers }
      );
      if (res && res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) return rows[0];
      }

      // Automatic fallback to provisioned Supabase Storage bucket 'tyt-user-states'
      const objectKey = `user_${simpleHash(cleanEmail)}.json`;
      const pubRes = await fetchFn(
        `${cloud.url}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${objectKey}?t=${Date.now()}`,
        { method: 'GET' }
      );
      if (!pubRes || !pubRes.ok) return null;
      const obj = await pubRes.json();
      return obj && obj.state_json ? obj : null;
    } catch {
      return null;
    }
  }

  async function registerUser({ name, email, password }) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (!cleanName) throw new Error('Lütfen adınızı ve soyadınızı girin.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Lütfen geçerli bir e-posta adresi girin.');
    if (cleanPass.length < 3) throw new Error('Şifre en az 3 karakter olmalıdır.');

    const users = getUsersMap();
    if (users[cleanEmail]) {
      throw new Error('Bu e-posta adresiyle kayıtlı bir hesap zaten var. Giriş yapabilirsiniz.');
    }

    const userId = `usr_${simpleHash(cleanEmail)}_${Date.now().toString(36)}`;
    const userRecord = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash: simpleHash(`${cleanEmail}::${cleanPass}`),
      createdAt: new Date().toISOString()
    };

    users[cleanEmail] = userRecord;
    saveUsersMap(users);

    const initialState = createDefaultUserState();
    writeJson(`${USER_STATE_PREFIX}${userId}`, initialState);

    const publicUser = { id: userRecord.id, name: userRecord.name, email: userRecord.email };
    writeJson(SESSION_KEY, publicUser);

    await syncToSupabaseIfEnabled(userId, publicUser, initialState);

    return { user: publicUser, state: initialState };
  }

  async function loginUser({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    const expectedHash = simpleHash(`${cleanEmail}::${cleanPass}`);

    const users = getUsersMap();
    let userRecord = users[cleanEmail];

    const remoteRow = await pullFromSupabaseByEmail(cleanEmail);
    if (remoteRow && remoteRow.state_json) {
      const remoteState = remoteRow.state_json;
      const remoteMeta = remoteState._accountMeta || {};
      const remoteUserId = remoteRow.user_id || remoteMeta.id || `usr_${simpleHash(cleanEmail)}`;
      const remoteHash = remoteMeta.passwordHash || expectedHash;
      if (!userRecord) {
        userRecord = {
          id: remoteUserId,
          name: remoteRow.display_name || remoteMeta.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          passwordHash: remoteHash,
          createdAt: remoteRow.updated_at || new Date().toISOString()
        };
        users[cleanEmail] = userRecord;
        saveUsersMap(users);
      }
      const { _accountMeta, ...cleanState } = remoteState;
      writeJson(`${USER_STATE_PREFIX}${userRecord.id}`, {
        ...createDefaultUserState(),
        ...cleanState
      });
    }

    if (!userRecord) {
      throw new Error('Bu e-posta ile kayıtlı bir hesap bulunamadı.');
    }

    if (userRecord.passwordHash !== expectedHash) {
      throw new Error('Hatalı şifre girdiniz.');
    }

    const publicUser = { id: userRecord.id, name: userRecord.name, email: userRecord.email };
    writeJson(SESSION_KEY, publicUser);

    const state = getUserStateSync(userRecord.id);
    return { user: publicUser, state };
  }

  async function logoutUser() {
    if (storage) {
      storage.removeItem(SESSION_KEY);
    }
  }

  function getCurrentSession() {
    const sessionUser = readJson(SESSION_KEY, null);
    if (!sessionUser || !sessionUser.id) return null;
    const state = getUserStateSync(sessionUser.id);
    return { user: sessionUser, state };
  }

  async function loadUserState(userId) {
    return getUserStateSync(userId);
  }

  async function saveUserState(userId, partialState = {}) {
    if (!userId) throw new Error('userId gerekli.');
    const current = getUserStateSync(userId);
    const next = {
      ...current,
      ...partialState,
      schoolConfig: partialState.schoolConfig
        ? { ...current.schoolConfig, ...partialState.schoolConfig }
        : current.schoolConfig,
      fixedBlocks: Array.isArray(partialState.fixedBlocks) ? partialState.fixedBlocks : current.fixedBlocks,
      sportConfig: partialState.sportConfig
        ? { ...current.sportConfig, ...partialState.sportConfig }
        : current.sportConfig,
      progress: partialState.progress !== undefined ? partialState.progress : current.progress,
      offDays: partialState.offDays !== undefined ? partialState.offDays : current.offDays,
      notes: Array.isArray(partialState.notes) ? partialState.notes : current.notes,
      alarm: partialState.alarm ? { ...current.alarm, ...partialState.alarm } : current.alarm,
      updatedAt: new Date().toISOString()
    };
    writeJson(`${USER_STATE_PREFIX}${userId}`, next);

    const session = getCurrentSession();
    if (session && session.user.id === userId) {
      await syncToSupabaseIfEnabled(userId, session.user, next);
    }
    return next;
  }

  async function updateOnboardingConfig(userId, { schoolConfig, fixedBlocks, sportConfig, tempoKey }) {
    const current = getUserStateSync(userId);
    return saveUserState(userId, {
      onboardingCompleted: true,
      schoolConfig: schoolConfig ? { ...current.schoolConfig, ...schoolConfig } : current.schoolConfig,
      fixedBlocks: Array.isArray(fixedBlocks) ? fixedBlocks : current.fixedBlocks,
      sportConfig: sportConfig ? { ...current.sportConfig, ...sportConfig } : current.sportConfig,
      tempoKey: tempoKey || current.tempoKey || 'balanced',
      progress: current.progress,
      offDays: current.offDays,
      notes: current.notes
    });
  }

  function listRegisteredUsers() {
    const users = getUsersMap();
    return Object.values(users).map(u => ({ id: u.id, name: u.name, email: u.email }));
  }

  return {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentSession,
    loadUserState,
    saveUserState,
    updateOnboardingConfig,
    getCloudConfig,
    saveCloudConfig,
    listRegisteredUsers
  };
}

