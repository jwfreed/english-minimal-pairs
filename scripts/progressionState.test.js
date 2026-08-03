const assert = require('assert');
const path = require('path');

const { loadTsModule } = require('./load-ts-module');

const plain = (value) => JSON.parse(JSON.stringify(value));

const {
  applyProgressionAnswer,
  getGroupProgression,
  initialProgressionState,
} = loadTsModule(
  path.join(
    __dirname,
    '..',
    'src',
    'domain',
    'practice',
    'progressionState.ts'
  )
);

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

module.exports = (async () => {
  await runTest('new groups begin at the baseline progression state', () => {
    const state = initialProgressionState();

    assert.deepStrictEqual(plain(getGroupProgression(state, 'rL')), {
      speedTier: 0,
      fastStreak: 0,
      longStreak: 0,
    });
    assert.deepStrictEqual(plain(state), {});
  });

  await runTest('answer transitions update one group without mutating prior state', () => {
    const initial = initialProgressionState();
    const next = applyProgressionAnswer(initial, {
      group: 'rL',
      nextSpeed: 1,
      nextFastStreak: 0,
      nextLongStreak: 0,
    });

    assert.deepStrictEqual(plain(initial), {});
    assert.deepStrictEqual(plain(getGroupProgression(next, 'rL')), {
      speedTier: 1,
      fastStreak: 0,
      longStreak: 0,
    });
  });

  await runTest('progression transitions remain isolated per group', () => {
    const withFirstGroup = applyProgressionAnswer(
      initialProgressionState(),
      {
        group: 'rL',
        nextSpeed: 1,
        nextFastStreak: 2,
        nextLongStreak: 4,
      }
    );
    const withBothGroups = applyProgressionAnswer(withFirstGroup, {
      group: 'bV',
      nextSpeed: 2,
      nextFastStreak: 0,
      nextLongStreak: 1,
    });

    assert.deepStrictEqual(
      plain(getGroupProgression(withBothGroups, 'rL')),
      {
        speedTier: 1,
        fastStreak: 2,
        longStreak: 4,
      }
    );
    assert.deepStrictEqual(
      plain(getGroupProgression(withBothGroups, 'bV')),
      {
        speedTier: 2,
        fastStreak: 0,
        longStreak: 1,
      }
    );
  });
})();
