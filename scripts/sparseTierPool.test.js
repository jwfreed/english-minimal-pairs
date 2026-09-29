// Decision 022: a practice tier with fewer than MIN_PRACTICE_POOL_SIZE
// examples is topped up from the same contrast's nearest lower tiers, so a
// single-pair tier no longer repeats one word pair for every trial until the
// next promotion. Current-tier examples lead the pool; higher tiers never join.
const assert = require("assert");
const path = require("path");
const { loadTsModule } = require("./load-ts-module");

const ROOT = path.join(__dirname, "..");
const {
  MIN_PRACTICE_POOL_SIZE,
  advanceTrialCycleSeenIds,
  buildTrialPairId,
  selectNextTrialPair,
  selectPairIndexAfterPromotion,
  selectVisiblePairsByMastery,
} = loadTsModule(path.join(ROOT, "src", "domain", "practiceSession.ts"));
const { minimalPairs } = loadTsModule(
  path.join(ROOT, "src", "constants", "minimalPairs.ts")
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const makePair = (group, difficulty, suffix = "a") => ({
  word1: `${group}${difficulty}${suffix}1`,
  word2: `${group}${difficulty}${suffix}2`,
  ipa1: "/a/",
  ipa2: "/b/",
  difficulty,
  group,
  position: "initial",
  contrastPhoneme1: "a",
  contrastPhoneme2: "b",
});
const labels = (pairs) =>
  JSON.stringify(
    pairs.map((pair) => `${pair.difficulty}${pair.word1.slice(-2, -1)}`)
  );

// Tier counts 3,3,3,1,1,1 — the most common shape in the live inventory.
const rL = [
  ...["a", "b", "c"].flatMap((s) => [
    makePair("rL", 1, s),
    makePair("rL", 2, s),
    makePair("rL", 3, s),
  ]),
  makePair("rL", 4),
  makePair("rL", 5),
  makePair("rL", 6),
];

runTest("the minimum pool size is three", () => {
  assert.strictEqual(MIN_PRACTICE_POOL_SIZE, 3);
});

runTest("a tier with enough examples is exactly that tier", () => {
  for (const tier of [1, 2, 3]) {
    const pool = selectVisiblePairsByMastery(rL, { rL: tier });
    assert.strictEqual(
      labels(pool),
      JSON.stringify([`${tier}a`, `${tier}b`, `${tier}c`]),
      `tier ${tier}`
    );
  }
});

runTest(
  "a single-pair tier is topped up from the nearest lower tiers, current tier first",
  () => {
    assert.strictEqual(
      labels(selectVisiblePairsByMastery(rL, { rL: 4 })),
      JSON.stringify(["4a", "3a", "3b"])
    );
    assert.strictEqual(
      labels(selectVisiblePairsByMastery(rL, { rL: 5 })),
      JSON.stringify(["5a", "4a", "3a"])
    );
    assert.strictEqual(
      labels(selectVisiblePairsByMastery(rL, { rL: 6 })),
      JSON.stringify(["6a", "5a", "4a"])
    );
  }
);

runTest(
  "borrowing skips empty lower tiers and never reaches a higher tier",
  () => {
    const pairs = [
      makePair("bV", 1, "a"),
      makePair("bV", 1, "b"),
      makePair("bV", 6),
      makePair("bV", 3, "x"),
    ];
    assert.strictEqual(
      labels(selectVisiblePairsByMastery(pairs, { bV: 6 })),
      JSON.stringify(["6a", "3x", "1a"])
    );
    assert.strictEqual(
      labels(selectVisiblePairsByMastery(pairs, { bV: 1 })),
      JSON.stringify(["1a", "1b"])
    );
  }
);

runTest("each contrast is pooled independently at its own tier", () => {
  const pairs = [...rL, makePair("vW", 1), makePair("vW", 2)];
  const pool = selectVisiblePairsByMastery(pairs, { rL: 5, vW: 2 });
  assert.strictEqual(
    labels(pool.filter((p) => p.group === "rL")),
    JSON.stringify(["5a", "4a", "3a"])
  );
  assert.strictEqual(
    labels(pool.filter((p) => p.group === "vW")),
    JSON.stringify(["2a", "1a"])
  );
});

runTest(
  "after promotion into a sparse tier the first example is the new tier",
  () => {
    const index = selectPairIndexAfterPromotion({
      pairs: rL,
      mastery: { rL: 3 },
      group: "rL",
      promotedTier: 4,
    });
    const pool = selectVisiblePairsByMastery(rL, { rL: 4 });
    assert.strictEqual(pool[index].difficulty, 4);
  }
);

runTest(
  "a topped-up single-pair tier never repeats a pair back to back and plays its own pair every cycle",
  () => {
    const eligiblePairs = selectVisiblePairsByMastery(rL, { rL: 5 });
    let state = { lastPairId: null, seenThisCycle: [] };
    const played = [];
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let trial = 0; trial < 30; trial++) {
      const next = selectNextTrialPair({
        eligiblePairs,
        activeGroup: "rL",
        ...state,
        random,
      });
      played.push(next);
      state = {
        lastPairId: buildTrialPairId(next),
        seenThisCycle: advanceTrialCycleSeenIds({
          activeGroupPairs: eligiblePairs,
          selectedPair: next,
          seenThisCycle: state.seenThisCycle,
        }),
      };
    }
    for (let i = 1; i < played.length; i++) {
      assert.notStrictEqual(
        buildTrialPairId(played[i]),
        buildTrialPairId(played[i - 1]),
        `trial ${i}`
      );
    }
    for (let cycle = 0; cycle < 10; cycle++) {
      const window = played.slice(cycle * 3, cycle * 3 + 3);
      assert.ok(
        window.some((pair) => pair.difficulty === 5),
        `cycle ${cycle} includes the current tier`
      );
    }
  }
);

runTest(
  "live inventory: every practice pool is its tier topped up to the minimum from lower tiers only",
  () => {
    let toppedUp = 0;
    const stillShort = [];
    for (const { category, pairs } of minimalPairs) {
      const groups = [...new Set(pairs.map((pair) => pair.group))];
      for (const group of groups) {
        const groupPairs = pairs.filter((pair) => pair.group === group);
        for (let tier = 1; tier <= 6; tier++) {
          const pool = selectVisiblePairsByMastery(groupPairs, {
            [group]: tier,
          });
          const atTier = groupPairs.filter((pair) => pair.difficulty === tier);
          const atOrBelow = groupPairs.filter(
            (pair) => pair.difficulty <= tier
          );
          const where = `${category} ${group} tier ${tier}`;
          assert.ok(
            pool.every((pair) => pair.difficulty <= tier),
            `${where}: no higher tier`
          );
          assert.strictEqual(
            JSON.stringify(pool.slice(0, atTier.length).map(buildTrialPairId)),
            JSON.stringify(atTier.map(buildTrialPairId)),
            `${where}: the whole current tier leads`
          );
          assert.strictEqual(
            pool.length,
            Math.max(
              atTier.length,
              Math.min(MIN_PRACTICE_POOL_SIZE, atOrBelow.length)
            ),
            where
          );
          if (pool.length > atTier.length) toppedUp++;
          if (pool.length < MIN_PRACTICE_POOL_SIZE)
            stillShort.push(`${where}: ${pool.length}`);
        }
      }
    }
    // Every single-pair or two-pair pool above tier 1 that has lower examples
    // to borrow (193 of the 197 single-pair pools in the Decision 021 baseline).
    assert.strictEqual(toppedUp, 239);
    // Only tiers 1–2 of the sparsest contrasts lack lower examples to borrow;
    // those stay a content matter. Just four tier-1 pools still hold one pair.
    assert.strictEqual(stillShort.length, 17, JSON.stringify(stillShort));
    assert.ok(
      stillShort.every((entry) => / tier [12]: [12]$/.test(entry)),
      JSON.stringify(stillShort)
    );
    assert.strictEqual(
      JSON.stringify(stillShort.filter((entry) => entry.endsWith(": 1"))),
      JSON.stringify([
        "中文 uVsU tier 1: 1",
        "Português uVsU tier 1: 1",
        "Türkçe uVsU tier 1: 1",
        "हिन्दी / اردو wV tier 1: 1",
      ])
    );
  }
);
