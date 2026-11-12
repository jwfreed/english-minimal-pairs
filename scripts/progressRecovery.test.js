// Explicit recovery of blocked (malformed) attempt history, and the flow that
// drives recovery of every blocked store. Protocol: src/storage/recoveryBackup.ts.
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const KEY = '@pairProgress_v2';
const BACKUP_1 = `@recoveryBackup_1_${KEY}`;
const BACKUP_2 = `@recoveryBackup_2_${KEY}`;
const plain = (value) => JSON.parse(JSON.stringify(value));
const attempt = (timestamp) => ({ isCorrect: true, timestamp, durationMin: 0.01 });

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    failSet: () => false, // (key) => boolean
    corruptRead: () => false, // (key) => boolean: read back something else
    async getItem(key) {
      if (!values.has(key)) return null;
      return this.corruptRead(key) ? `${values.get(key)} ` : values.get(key);
    },
    async setItem(key, value) {
      if (this.failSet(key)) throw new Error(`write rejected: ${key}`);
      values.set(key, value);
    },
    async removeItem(key) {
      if (this.failSet(key)) throw new Error(`remove rejected: ${key}`);
      values.delete(key);
    },
  };
}

function load(storage) {
  return loadTsModule(
    path.join(ROOT, 'src', 'storage', 'progressStorage.ts'),
    new Map(),
    { '@react-native-async-storage/async-storage': storage },
    { setTimeout: (callback) => setImmediate(callback) }
  );
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const rejects = async (promise, pattern) => {
  let error;
  await promise.catch((caught) => (error = caught));
  assert.ok(error, 'expected a rejection');
  if (pattern) assert.match(error.message, pattern);
};

module.exports = (async () => {
  await runTest('completely unreadable history: backed up exactly, then reset only on apply', async () => {
    const raw = '{"rL:rock:lock":{"attempts":[';
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    await history.getProgress();
    assert.strictEqual(history.getProgressPersistence().persistence, 'blocked');

    const plan = await history.prepareProgressRecovery();
    assert.deepStrictEqual(plain(plan), { raw, backupKey: BACKUP_1, keptCount: 0 });
    assert.strictEqual(storage.values.get(BACKUP_1), raw, 'backup is byte-identical');
    assert.strictEqual(storage.values.get(KEY), raw, 'preparing changes nothing else');
    assert.strictEqual(history.getProgressPersistence().persistence, 'blocked');

    await history.applyProgressRecovery(plan);
    assert.strictEqual(storage.values.has(KEY), false);
    assert.strictEqual(storage.values.get(BACKUP_1), raw, 'backup is preserved');
    assert.strictEqual(history.getProgressPersistence().persistence, 'saved');
  });

  await runTest('one invalid entry: every valid entry is kept verbatim', async () => {
    const stored = {
      'rL:rock:lock': { attempts: [attempt(1), 'junk'], note: 'keep' },
      'bV:ban:van': { attempts: 'x' },
    };
    const raw = JSON.stringify(stored);
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    const plan = await history.prepareProgressRecovery();
    assert.strictEqual(plan.keptCount, 1);
    await history.applyProgressRecovery(plan);
    assert.deepStrictEqual(JSON.parse(storage.values.get(KEY)), {
      'rL:rock:lock': stored['rL:rock:lock'],
    });
    assert.strictEqual(storage.values.get(BACKUP_1), raw);
  });

  await runTest('several invalid entries, and the 100-attempt retention contract still applies', async () => {
    const long = Array.from({ length: 150 }, (_, i) => attempt(i));
    const stored = {
      a: { attempts: long },
      b: 5,
      c: null,
      d: {},
      e: { attempts: [attempt(1)] },
    };
    const raw = JSON.stringify(stored);
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    const plan = await history.prepareProgressRecovery();
    assert.strictEqual(plan.keptCount, 2);
    await history.applyProgressRecovery(plan);
    const after = JSON.parse(storage.values.get(KEY));
    assert.deepStrictEqual(Object.keys(after), ['a', 'e']);
    assert.deepStrictEqual(after.a.attempts, long.slice(-100));
    // The backup still holds all 150 and the invalid entries.
    assert.strictEqual(storage.values.get(BACKUP_1), raw);
  });

  await runTest('a rejected backup write stops recovery with nothing changed', async () => {
    const raw = '{not json';
    const storage = createStorage({ [KEY]: raw });
    storage.failSet = (key) => key === BACKUP_1;
    const history = load(storage);
    await rejects(history.prepareProgressRecovery(), /write rejected/);
    assert.strictEqual(storage.values.get(KEY), raw);
    assert.strictEqual(storage.values.has(BACKUP_1), false);
    assert.strictEqual(history.getProgressPersistence().persistence, 'blocked');
  });

  await runTest('a backup that does not read back identically stops recovery', async () => {
    const raw = '{not json';
    const storage = createStorage({ [KEY]: raw });
    storage.corruptRead = (key) => key === BACKUP_1;
    const history = load(storage);
    await rejects(history.prepareProgressRecovery(), /could not be verified/);
    assert.strictEqual(storage.values.get(KEY), raw);
    assert.strictEqual(history.getProgressPersistence().persistence, 'blocked');
  });

  await runTest('a rejected replacement leaves the original and the backup, and stays blocked', async () => {
    const raw = JSON.stringify({ a: { attempts: [attempt(1)] }, b: 5 });
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    const plan = await history.prepareProgressRecovery();
    storage.failSet = (key) => key === KEY;
    await rejects(history.applyProgressRecovery(plan), /write rejected/);
    assert.strictEqual(storage.values.get(KEY), raw);
    assert.strictEqual(storage.values.get(BACKUP_1), raw);
    assert.strictEqual(history.getProgressPersistence().persistence, 'blocked');

    // Safe to try again once storage works.
    storage.failSet = () => false;
    await history.applyProgressRecovery(await history.prepareProgressRecovery());
    assert.deepStrictEqual(JSON.parse(storage.values.get(KEY)), { a: { attempts: [attempt(1)] } });
    assert.strictEqual(history.getProgressPersistence().persistence, 'saved');
  });

  await runTest('interrupted between backup and replacement: nothing is lost and a rerun reuses the backup', async () => {
    const raw = JSON.stringify({ a: { attempts: [attempt(1)] }, b: 5 });
    const storage = createStorage({ [KEY]: raw });
    await load(storage).prepareProgressRecovery();
    // App terminated here. A fresh process sees the original, still blocked.
    const restarted = load(storage);
    assert.deepStrictEqual(Object.keys(await restarted.getProgress()), ['a', 'b']);
    assert.strictEqual(restarted.getProgressPersistence().persistence, 'blocked');
    assert.strictEqual(storage.values.get(KEY), raw);

    const plan = await restarted.prepareProgressRecovery();
    assert.strictEqual(plan.backupKey, BACKUP_1, 'the identical backup is reused');
    assert.strictEqual(storage.values.has(BACKUP_2), false);
    await restarted.applyProgressRecovery(plan);
    assert.deepStrictEqual(Object.keys(JSON.parse(storage.values.get(KEY))), ['a']);
  });

  await runTest('attempts recorded while blocked are saved exactly once after recovery', async () => {
    const raw = JSON.stringify({ a: { attempts: [attempt(1)] }, b: 5 });
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    await history.saveAttempt('a', true, 0.01, 2).catch(() => {});
    await history.saveAttempt('b', false, 0.01, 3).catch(() => {});
    assert.strictEqual(storage.values.get(KEY), raw, 'blocked writes changed nothing');

    await history.applyProgressRecovery(await history.prepareProgressRecovery());
    const after = JSON.parse(storage.values.get(KEY));
    assert.deepStrictEqual(after.a.attempts.map((entry) => entry.timestamp), [1, 2]);
    assert.deepStrictEqual(after.b.attempts.map((entry) => entry.timestamp), [3]);
    assert.strictEqual(history.getProgressPersistence().persistence, 'saved');
  });

  await runTest('a plan is refused if the stored history changed after it was prepared', async () => {
    const raw = '{not json';
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    const plan = await history.prepareProgressRecovery();
    // The learner resets and records new history before confirming.
    await history.clearProgress();
    await history.saveAttempt('a', true, 0.01, 9);
    const newer = storage.values.get(KEY);

    await rejects(history.applyProgressRecovery(plan), /changed since recovery was prepared/);
    assert.strictEqual(storage.values.get(KEY), newer, 'the newer save is not overwritten');
  });

  await runTest('a plan is refused if its backup no longer matches', async () => {
    const raw = '{not json';
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    const plan = await history.prepareProgressRecovery();
    storage.values.set(BACKUP_1, 'tampered');
    await rejects(history.applyProgressRecovery(plan), /backup no longer matches/);
    assert.strictEqual(storage.values.get(KEY), raw);
  });

  await runTest('recovery is not offered for healthy history, and a later corruption never overwrites an earlier backup', async () => {
    const first = '{not json';
    const storage = createStorage({ [KEY]: first });
    const history = load(storage);
    await history.applyProgressRecovery(await history.prepareProgressRecovery());
    assert.strictEqual(await history.prepareProgressRecovery(), null);
    await history.saveAttempt('a', true, 0.01, 1);
    assert.strictEqual(await history.prepareProgressRecovery(), null);

    const second = '{"a":7}';
    storage.values.set(KEY, second);
    const plan = await history.prepareProgressRecovery();
    assert.strictEqual(plan.backupKey, BACKUP_2);
    assert.strictEqual(storage.values.get(BACKUP_1), first);
    assert.strictEqual(storage.values.get(BACKUP_2), second);
  });

  await runTest('after a successful recovery a restart reads the recovered history and can save', async () => {
    const storage = createStorage({
      [KEY]: JSON.stringify({ a: { attempts: [attempt(1)] }, b: 5 }),
    });
    const history = load(storage);
    await history.applyProgressRecovery(await history.prepareProgressRecovery());

    const restarted = load(storage);
    assert.deepStrictEqual(plain(await restarted.getProgress()), { a: { attempts: [attempt(1)] } });
    assert.strictEqual(restarted.getProgressPersistence().persistence, 'saved');
    await restarted.saveAttempt('a', true, 0.01, 2);
    assert.strictEqual(JSON.parse(storage.values.get(KEY)).a.attempts.length, 2);
  });

  await runTest('a history replacement that committed but was reported as failed still saves the pending attempts', async () => {
    const raw = JSON.stringify({ a: { attempts: [attempt(1)] }, b: 5 });
    const storage = createStorage({ [KEY]: raw });
    const history = load(storage);
    await history.saveAttempt('a', true, 0.01, 2).catch(() => {});
    const plan = await history.prepareProgressRecovery();
    const setItem = storage.setItem.bind(storage);
    let lie = true;
    storage.setItem = async (key, value) => {
      await setItem(key, value);
      if (lie && key === KEY) {
        lie = false;
        throw new Error('acknowledgement lost');
      }
    };
    await rejects(history.applyProgressRecovery(plan), /acknowledgement lost/);
    // Not reported as recovered, but storage is valid now, so the pending
    // attempt was saved (once) and the state is accurate.
    assert.deepStrictEqual(
      JSON.parse(storage.values.get(KEY)).a.attempts.map((entry) => entry.timestamp),
      [1, 2]
    );
    assert.deepStrictEqual(plain(history.getProgressPersistence()), {
      persistence: 'saved',
      needsAttention: false,
    });
    assert.strictEqual(await history.prepareProgressRecovery(), null);
  });

  // ── the flow across stores ───────────────────────────────────────────────

  const { recoverBlockedProgress } = loadTsModule(
    path.join(ROOT, 'src', 'hooks', 'useProgressRecovery.ts'),
    new Map(),
    {
      react: {},
      'react-native': { Alert: {} },
      '@/src/context/LanguageContext': {},
    }
  );
  const store = (overrides = {}) => {
    const calls = [];
    return {
      calls,
      blocked: true,
      prepare: async () => {
        calls.push('prepare');
        return { raw: 'x', backupKey: 'k', keptCount: 1 };
      },
      apply: async () => {
        calls.push('apply');
      },
      ...overrides,
    };
  };

  await runTest('nothing is replaced until the learner confirms, and declining replaces nothing', async () => {
    const mastery = store();
    const history = store();
    const order = [];
    const outcome = await recoverBlockedProgress([mastery, history], async () => {
      order.push([...mastery.calls, ...history.calls].join(','));
      return false;
    });
    assert.strictEqual(outcome, 'cancelled');
    assert.deepStrictEqual(order, ['prepare,prepare'], 'both backups precede the question');
    assert.deepStrictEqual(mastery.calls, ['prepare']);
    assert.deepStrictEqual(history.calls, ['prepare']);
  });

  await runTest('only blocked stores are recovered, and the question says whether everything resets', async () => {
    const healthy = store({ blocked: false });
    const blocked = store({
      prepare: async () => ({ raw: 'x', backupKey: 'k', keptCount: 0 }),
    });
    let asked;
    const outcome = await recoverBlockedProgress([healthy, blocked], async (resetsEverything) => {
      asked = resetsEverything;
      return true;
    });
    assert.strictEqual(outcome, 'recovered');
    assert.strictEqual(asked, true);
    assert.deepStrictEqual(healthy.calls, []);

    let mixed;
    await recoverBlockedProgress([store(), blocked], async (resetsEverything) => {
      mixed = resetsEverything;
      return false;
    });
    assert.strictEqual(mixed, false, 'something is kept');
  });

  await runTest('a failed backup, a failed replacement, or nothing to recover is never reported as recovered', async () => {
    let asked = false;
    const noBackup = store({
      prepare: async () => {
        throw new Error('backup failed');
      },
    });
    assert.strictEqual(
      await recoverBlockedProgress([noBackup, store()], async () => (asked = true)),
      'failed'
    );
    assert.strictEqual(asked, false, 'the learner is not asked without verified backups');

    const applied = store();
    const rejected = store({
      apply: async () => {
        throw new Error('replacement rejected');
      },
    });
    assert.strictEqual(await recoverBlockedProgress([applied, rejected], async () => true), 'failed');
    assert.deepStrictEqual(applied.calls, ['prepare', 'apply']);

    // A store that turns out to need no recovery (its own prepare unblocks
    // it) is neither asked about nor counted as a failure.
    let askedForNothing = false;
    assert.strictEqual(
      await recoverBlockedProgress(
        [store({ prepare: async () => null })],
        async () => (askedForNothing = true)
      ),
      'recovered'
    );
    assert.strictEqual(askedForNothing, false);
  });
})();
