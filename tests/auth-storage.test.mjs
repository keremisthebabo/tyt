import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore, createDefaultUserState } from '../js/auth-storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

test('New user starts with empty fixedBlocks and onboardingCompleted = false', async () => {
  const store = createAccountStore({ storage: createMemoryStorage() });
  const { user, state } = await store.registerUser({
    name: 'Ayşe Yılmaz',
    email: 'ayse@example.com',
    password: 'secret123'
  });

  assert.ok(user.id);
  assert.equal(user.name, 'Ayşe Yılmaz');
  assert.equal(state.onboardingCompleted, false);
  assert.deepEqual(state.fixedBlocks, []);
  assert.deepEqual(state.notes, []);
  assert.deepEqual(createDefaultUserState().fixedBlocks, []);
});

test('User A and User B have strictly isolated schedules, progress, and mistake notes', async () => {
  const storage = createMemoryStorage();
  const store = createAccountStore({ storage });

  const userA = await store.registerUser({ name: 'Ali', email: 'ali@test.com', password: '123' });
  await store.updateOnboardingConfig(userA.user.id, {
    fixedBlocks: [{ title: 'Fizik Özel Ders', days: ['Pzt'], start: '19:00', end: '20:30' }],
    sportConfig: { programId: 'ul', start: '16:30', end: '18:00', customNote: '' },
    tempoKey: 'intense'
  });
  await store.saveUserState(userA.user.id, {
    progress: { slot_0: true },
    notes: [{ topic: 'Fizik', body: 'Vektörler notu', date: '28.10' }]
  });

  await store.logoutUser();
  assert.equal(store.getCurrentSession(), null);

  const userB = await store.registerUser({ name: 'Zeynep', email: 'zeynep@test.com', password: '456' });
  assert.deepEqual(userB.state.fixedBlocks, []);
  assert.deepEqual(userB.state.progress, {});
  assert.deepEqual(userB.state.notes, []);
  assert.equal(userB.state.tempoKey, 'balanced');

  await store.logoutUser();
  const reloginA = await store.loginUser({ email: 'ali@test.com', password: '123' });
  assert.equal(reloginA.state.fixedBlocks.length, 1);
  assert.equal(reloginA.state.fixedBlocks[0].title, 'Fizik Özel Ders');
  assert.equal(reloginA.state.tempoKey, 'intense');
  assert.equal(reloginA.state.progress.slot_0, true);
  assert.equal(reloginA.state.notes.length, 1);
});

test('updateOnboardingConfig preserves existing progress and mistake notes when routine is edited', async () => {
  const store = createAccountStore({ storage: createMemoryStorage() });
  const { user } = await store.registerUser({ name: 'Can', email: 'can@test.com', password: '123' });

  await store.saveUserState(user.id, {
    progress: { slot_0: true, slot_1: true },
    notes: [{ topic: 'Matematik', body: 'EBOB EKOK kuralı', date: '28.10' }]
  });

  const updated = await store.updateOnboardingConfig(user.id, {
    fixedBlocks: [{ title: 'Dershane', days: ['Cmt', 'Paz'], start: '09:00', end: '13:00' }],
    sportConfig: { programId: 'fb', start: '18:00', end: '19:30', customNote: '' },
    tempoKey: 'relaxed'
  });

  assert.equal(updated.onboardingCompleted, true);
  assert.equal(updated.tempoKey, 'relaxed');
  assert.equal(updated.progress.slot_0, true);
  assert.equal(updated.notes.length, 1);
});

test('Supabase cloud sync pushes on register/save and pulls remote account on loginUser from a second device', async () => {
  const cloudRows = [];
  const mockFetch = async (url, init = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      const idx = cloudRows.findIndex(r => r.email === body.email);
      if (idx >= 0) cloudRows[idx] = body;
      else cloudRows.push(body);
      return { ok: true, json: async () => [body] };
    }
    const u = new URL(url);
    const emailFilter = u.searchParams.get('email') || '';
    const email = emailFilter.replace(/^eq\./, '');
    const matched = cloudRows.filter(r => r.email === email);
    return { ok: true, json: async () => matched };
  };

  // Device 1 registers and configures routine with cloud enabled
  const device1Storage = createMemoryStorage();
  const store1 = createAccountStore({ storage: device1Storage, fetchImpl: mockFetch });
  store1.saveCloudConfig({ url: 'https://example.supabase.co', anonKey: 'anon-key-123' });

  const reg = await store1.registerUser({ name: 'Bora Kaya', email: 'bora@cloud.com', password: 'pass999' });
  await store1.updateOnboardingConfig(reg.user.id, {
    fixedBlocks: [{ title: 'Matematik Özel Ders', days: ['Sal'], start: '18:00', end: '19:30' }],
    sportConfig: { programId: 'ppl', start: '16:00', end: '17:30', customNote: '' },
    tempoKey: 'intense'
  });

  // Device 2 has empty local storage, only cloud config set
  const device2Storage = createMemoryStorage();
  const store2 = createAccountStore({ storage: device2Storage, fetchImpl: mockFetch });
  store2.saveCloudConfig({ url: 'https://example.supabase.co', anonKey: 'anon-key-123' });

  const loggedIn = await store2.loginUser({ email: 'bora@cloud.com', password: 'pass999' });
  assert.equal(loggedIn.user.name, 'Bora Kaya');
  assert.equal(loggedIn.state.tempoKey, 'intense');
  assert.equal(loggedIn.state.fixedBlocks.length, 1);
  assert.equal(loggedIn.state.fixedBlocks[0].title, 'Matematik Özel Ders');
});

test('Default Supabase configuration is active out-of-the-box with sb_publishable key and sends required headers', async () => {
  let capturedHeaders = null;
  const mockFetch = async (url, init = {}) => {
    capturedHeaders = init.headers || {};
    return { ok: true, json: async () => [] };
  };
  const store = createAccountStore({ storage: createMemoryStorage(), fetchImpl: mockFetch });
  const cfg = store.getCloudConfig();
  assert.equal(cfg.url, 'https://jioxqgxdsmlsmijnmqzf.supabase.co');
  assert.equal(cfg.anonKey, 'sb_publishable_qSLTaTAaDSdVgidXoECE_A_av5DBfZg');
  assert.equal(cfg.enabled, true);

  await store.registerUser({ name: 'Test User', email: 'test@supabase.co', password: '123' });
  assert.ok(capturedHeaders);
  assert.equal(capturedHeaders.apikey, 'sb_publishable_qSLTaTAaDSdVgidXoECE_A_av5DBfZg');
  assert.equal(capturedHeaders.Authorization, 'Bearer sb_publishable_qSLTaTAaDSdVgidXoECE_A_av5DBfZg');
});

test('Supabase cloud sync automatically falls back to provisioned tyt-user-states Storage bucket when REST table returns 404', async () => {
  const bucketObjects = new Map();
  const mockFetch = async (url, init = {}) => {
    if (url.includes('/rest/v1/user_states')) {
      return { ok: false, status: 404, json: async () => ({ code: 'PGRST205' }) };
    }
    if (url.includes('/storage/v1/object/tyt-user-states/') && init.method === 'POST') {
      const key = url.split('/tyt-user-states/')[1];
      bucketObjects.set(key, JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ Key: key }) };
    }
    if (url.includes('/storage/v1/object/public/tyt-user-states/')) {
      const key = url.split('/tyt-user-states/')[1].split('?')[0];
      if (!bucketObjects.has(key)) return { ok: false, status: 404 };
      return { ok: true, status: 200, json: async () => bucketObjects.get(key) };
    }
    return { ok: false, status: 404 };
  };

  const store1 = createAccountStore({ storage: createMemoryStorage(), fetchImpl: mockFetch });
  const reg = await store1.registerUser({ name: 'Ece Bulut', email: 'ece@cloud.com', password: 'ec123' });
  await store1.updateOnboardingConfig(reg.user.id, {
    fixedBlocks: [{ title: 'Geometri Özel Ders', days: ['Per'], start: '19:00', end: '20:30' }],
    sportConfig: { programId: 'ul', start: '16:30', end: '18:30', customNote: '' },
    tempoKey: 'balanced'
  });

  const store2 = createAccountStore({ storage: createMemoryStorage(), fetchImpl: mockFetch });
  const relogin = await store2.loginUser({ email: 'ece@cloud.com', password: 'ec123' });
  assert.equal(relogin.user.name, 'Ece Bulut');
  assert.equal(relogin.state.fixedBlocks.length, 1);
  assert.equal(relogin.state.fixedBlocks[0].title, 'Geometri Özel Ders');
});

