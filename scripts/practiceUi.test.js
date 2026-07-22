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
const practiceAnalyticsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'analytics', 'practiceAnalytics.ts'),
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
    pairSelectorSource.includes('visible={isPickerVisible}'),
    'pair picker modal must track the disclosure state'
  );
});

runTest('overflowing practice controls use viewport-safe presentation states', () => {
  assert.ok(
    pairSelectorSource.includes('<Modal') &&
      pairSelectorSource.includes('presentationStyle="overFullScreen"'),
    'the expanded pair picker must not increase the practice card height'
  );
  assert.ok(
    practiceScreenSource.includes('{feedback === null && (') &&
      answerButtonsSource.includes('{!feedbackCopy && ('),
    'feedback must replace inactive controls instead of extending below them'
  );
});

runTest('pair selector renders the optional example-selection copy', () => {
  const copyUsages = pairSelectorSource.match(/tKeys\.chooseAnotherExample/g) || [];
  assert.strictEqual(
    copyUsages.length,
    4,
    'toggle text, toggle accessibility label, modal title, and picker label must share the example copy'
  );
});

const stylesSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'constants', 'styles.ts'),
  'utf8'
);
const listenControlsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'practice', 'ListenControls.tsx'),
  'utf8'
);

runTest('play button ambient glow matches the design keyframes', () => {
  assert.ok(
    stylesSource.includes('getAmbientGlowKeyframes'),
    'styles must export the ambient glow keyframes helper'
  );
  // Light mode: sharp ring rgb(191,87,0) + soft glow rgb(230,126,34)
  for (const stop of [
    '0 0 0 4px rgba(191, 87, 0, 0.85), 0 0 18px 6px rgba(230, 126, 34, 0.6)',
    '0 0 0 13px rgba(191, 87, 0, 0.3), 0 0 32px 13px rgba(230, 126, 34, 0.28)',
    '0 0 0 22px rgba(191, 87, 0, 0), 0 0 36px 18px rgba(230, 126, 34, 0)',
  ]) {
    assert.ok(
      stylesSource.includes(stop),
      `ambient glow light keyframe changed: ${stop}`
    );
  }
  // Dark mode: both layers rgb(247,158,74), 38% stop at .32/.3
  assert.ok(
    stylesSource.includes(
      '0 0 0 13px rgba(247, 158, 74, 0.32), 0 0 32px 13px rgba(247, 158, 74, 0.3)'
    ),
    'ambient glow dark keyframe changed'
  );
});

runTest('ambient glow pulses only while the play button is idle', () => {
  assert.ok(
    listenControlsSource.includes('{!isPlaying && (') ||
      listenControlsSource.includes('{!isPlaying ? ('),
    'glow overlay must be suppressed during playback'
  );
  assert.ok(
    listenControlsSource.includes("animationDuration: '4.5s'") &&
      listenControlsSource.includes("animationIterationCount: 'infinite'") &&
      listenControlsSource.includes("animationTimingFunction: 'ease-in-out'"),
    'glow must loop on the 4.5s ease-in-out cycle from the design'
  );
  assert.ok(
    listenControlsSource.includes('pointerEvents="none"'),
    'glow overlay must not intercept touches'
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
  const eventMappings = [
    ['practiceStarted', 'contrast_practice_started'],
    ['pairPresented', 'pair_presented'],
    ['answerSubmitted', 'pair_answered'],
    ['comparisonOpened', 'compare_mode_opened'],
    ['pairSelected', 'pair_selected'],
  ];
  for (const [practiceAction, eventName] of eventMappings) {
    assert.ok(
      practiceSessionHookSource.includes(`practiceAnalytics.${practiceAction}({`),
      `missing practice analytics action: ${practiceAction}`
    );
    assert.ok(
      practiceAnalyticsSource.includes(`name: '${eventName}'`),
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
    'practiceAnalytics',
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

runTest('practice analytics owns canonical identifiers and payload translation', () => {
  for (const requiredPayload of [
    'contrast_id: contrast',
    'mastery_level: masteryLevel',
    'contrast_id: pair.group',
    'pair_id: buildPairId(pair, category)',
    'difficulty_tier: pair.difficulty',
    'response_time_ms: responseTimeMs',
  ]) {
    assert.ok(
      practiceAnalyticsSource.includes(requiredPayload),
      `analytics payload lost canonical field: ${requiredPayload}`
    );
  }
  assert.ok(
    !practiceSessionHookSource.includes('trackLearningEvent') &&
      !practiceSessionHookSource.includes('buildPairId') &&
      !practiceSessionHookSource.includes('contrast_id') &&
      !practiceSessionHookSource.includes('pair_id') &&
      !practiceSessionHookSource.includes("name: '"),
    'practice workflow must not construct analytics events or identifiers'
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
      'practiceAnalytics.answerSubmitted({',
    ],
    'answer state must not depend on analytics delivery'
  );
});
