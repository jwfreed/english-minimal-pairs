// Source-contract coverage for the contrast-first practice hierarchy and the
// pair-selector disclosure. The project does not include a component-rendering
// test dependency, so these checks pin the accessibility and ordering contract
// without adding a new test stack for a small presentation-only refinement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const practiceScreenSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'),
  'utf8'
);
const practiceSessionHookSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'usePracticeSession.ts'),
  'utf8'
);
const pairSelectorSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'components',
    'practice',
    'PracticePairSelector.tsx'
  ),
  'utf8'
);
const answerButtonsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'AnswerButtons.tsx'),
  'utf8'
);
const contrastDetailsSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'components',
    'practice',
    'ContrastDetailsModal.tsx'
  ),
  'utf8'
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

function assertInOrder(source, tokens, message) {
  let previousIndex = -1;
  for (const token of tokens) {
    const nextIndex = source.indexOf(token, previousIndex + 1);
    assert.ok(nextIndex > previousIndex, `${message}: missing or out of order: ${token}`);
    previousIndex = nextIndex;
  }
}

runTest('contrast header renders contrast, mastery, then listening instruction', () => {
  assertInOrder(
    practiceScreenSource,
    [
      'styles.contrastTitle',
      '<LevelIndicator',
      'tKeys.listenForSoundDifference',
      '<PracticePairSelector',
    ],
    'contrast-first practice hierarchy changed'
  );
});

runTest('pair selector toggle uses an accessible button role', () => {
  assert.ok(
    pairSelectorSource.includes('accessibilityRole="button"'),
    'pair selector toggle must remain an accessible button'
  );
});

runTest('only the sound contrast is exposed as the contrast heading', () => {
  assert.ok(
    practiceScreenSource.includes('<Text accessibilityRole="header" style={styles.contrastTitle}>'),
    'sound contrast text must be exposed as the heading'
  );
  assert.ok(
    !practiceScreenSource.includes('style={styles.contrastHeader} accessibilityRole="header"'),
    'level and instruction must not be grouped into the heading'
  );
});

runTest('pair selector exposes its expanded and collapsed state', () => {
  assert.ok(
    pairSelectorSource.includes('accessibilityState={{ expanded: isPickerVisible }}'),
    'pair selector must expose disclosure state to native assistive technology'
  );
  assert.ok(
    pairSelectorSource.includes('aria-expanded={isPickerVisible}'),
    'pair selector must expose disclosure state on the web'
  );
  assert.ok(
    pairSelectorSource.includes('aria-controls="practice-pair-picker"') &&
      pairSelectorSource.includes('nativeID="practice-pair-picker"'),
    'pair selector toggle must identify the controlled picker'
  );
  assert.ok(
    pairSelectorSource.includes('{isPickerVisible && ('),
    'pair picker must render only while the disclosure is expanded'
  );
});

runTest('pair selector renders the optional example-selection copy', () => {
  const copyUsages = pairSelectorSource.match(/tKeys\.chooseAnotherExample/g) || [];
  assert.strictEqual(
    copyUsages.length,
    3,
    'toggle text, toggle accessibility label, and picker label must share the example copy'
  );
});

runTest('contrast details remain a supporting modal with mastery and availability', () => {
  assert.ok(
    practiceScreenSource.includes('tKeys.viewContrastDetails') &&
      practiceScreenSource.includes('<ContrastDetailsModal'),
    'practice must expose a contrast-details entry point'
  );
  assert.ok(
    contrastDetailsSource.includes('<LevelIndicator currentTier={masteryLevel}') &&
      contrastDetailsSource.includes('availablePairIds.has(pairId)') &&
      contrastDetailsSource.includes('tKeys.availableNow'),
    'contrast details must show group mastery and current pair availability'
  );
});

runTest('incorrect feedback identifies the choice, correction, and contrast', () => {
  assertInOrder(
    answerButtonsSource,
    [
      'tKeys.youChose',
      'feedbackCopy.contrastWord',
      'tKeys.correct',
      'feedbackCopy.correctWord',
      'tKeys.compareTheSounds',
      'contrastLabel',
    ],
    'incorrect compare context changed'
  );
});

runTest('practice emits all requested learning analytics events', () => {
  for (const eventName of [
    'contrast_practice_started',
    'pair_presented',
    'pair_answered',
    'compare_mode_opened',
    'pair_selected',
  ]) {
    assert.ok(
      practiceSessionHookSource.includes(`name: '${eventName}'`),
      `missing analytics event: ${eventName}`
    );
  }
});

runTest('practice workflow is owned by the session hook', () => {
  assert.ok(
    practiceScreenSource.includes('usePracticeSession({'),
    'practice screen must compose the extracted session hook'
  );
  for (const workflowDependency of [
    'applyPracticeAnswer',
    'selectNextTrialPair',
    'trackLearningEvent',
    'useAudio',
  ]) {
    assert.ok(
      practiceSessionHookSource.includes(workflowDependency),
      `session hook must own practice workflow dependency: ${workflowDependency}`
    );
    assert.ok(
      !practiceScreenSource.includes(workflowDependency),
      `practice screen must not retain workflow dependency: ${workflowDependency}`
    );
  }
});

runTest('contrast details stay presentation-only and emit selection actions', () => {
  for (const forbiddenDependency of [
    'useContrastPairs',
    'selectNextTrialPair',
    'trackLearningEvent',
    'AsyncStorage',
    'promote(',
  ]) {
    assert.ok(
      !contrastDetailsSource.includes(forbiddenDependency),
      `contrast details must not own domain behavior: ${forbiddenDependency}`
    );
  }
  assert.ok(
    contrastDetailsSource.includes('availablePairIds.has(pairId)') &&
      contrastDetailsSource.includes('onPress={() => onSelectPair(pair)}'),
    'contrast details must limit itself to availability presentation and selection callbacks'
  );
});

runTest('manual selection owns one round before contrast scheduling resumes', () => {
  assertInOrder(
    practiceSessionHookSource,
    [
      'manualPairOverrideRef.current && selectedPair',
      '? selectedPair',
      ': group',
      'selectNextTrialPair({',
      'activeGroup: group',
      'manualPairOverrideRef.current = false',
    ],
    'manual pair override must remain one-shot and resume contrast scheduling'
  );
  assert.ok(
    practiceSessionHookSource.includes('catObj.pairs.filter((pair) => pair.group === group)') &&
      practiceSessionHookSource.includes('if (nextIndex === -1) return false;'),
    'contrast-detail selection must remain inside the active eligible contrast examples'
  );
});

runTest('analytics payloads use canonical domain identifiers and relevant signals', () => {
  for (const requiredPayload of [
    'contrast_id: activeGroup',
    'mastery_level: mastery[activeGroup] ?? 1',
    'contrast_id: nextPair.group',
    'pair_id: buildPairId(nextPair, catObj.category)',
    'difficulty_tier: nextPair.difficulty',
    'contrast_id: result.group',
    'pair_id: result.pairId',
    'correct: result.correct',
  ]) {
    assert.ok(
      practiceSessionHookSource.includes(requiredPayload),
      `analytics payload lost canonical field: ${requiredPayload}`
    );
  }
  assert.ok(
    !practiceSessionHookSource.includes('contrast_id: contrastTrainingTitle'),
    'localized contrast labels must not be used as analytics identifiers'
  );
});

runTest('analytics remains outside the feedback component boundary', () => {
  assert.ok(
    !answerButtonsSource.includes('learningAnalytics') &&
      !answerButtonsSource.includes('trackLearningEvent'),
    'AnswerButtons must remain presentation and interaction only'
  );
});

runTest('answer state is committed before analytics observes the submission', () => {
  assertInOrder(
    practiceSessionHookSource,
    [
      'setFeedback(result.feedback)',
      'recordAttempt(result.pairId, result.correct, result.durationMin)',
      "name: 'pair_answered'",
    ],
    'answer state must not depend on analytics delivery'
  );
});
