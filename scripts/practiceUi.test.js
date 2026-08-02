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
  // Light mode: soft ring rgb(191,87,0) + faint glow rgb(230,126,34),
  // toned down (peak ring .4, tight 14px max spread) per user request.
  for (const stop of [
    '0 0 0 3px rgba(191, 87, 0, 0.4), 0 0 12px 4px rgba(230, 126, 34, 0.3)',
    '0 0 0 9px rgba(191, 87, 0, 0.15), 0 0 22px 9px rgba(230, 126, 34, 0.14)',
    '0 0 0 14px rgba(191, 87, 0, 0), 0 0 26px 12px rgba(230, 126, 34, 0)',
  ]) {
    assert.ok(
      stylesSource.includes(stop),
      `ambient glow light keyframe changed: ${stop}`
    );
  }
  // Dark mode: both layers rgb(247,158,74), 38% stop at .16/.15
  assert.ok(
    stylesSource.includes(
      '0 0 0 9px rgba(247, 158, 74, 0.16), 0 0 22px 9px rgba(247, 158, 74, 0.15)'
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
    'planNextTrial',
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

runTest('contrast-detail selections stay inside the active eligible examples', () => {
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

// ========== Soundwise Glow-up micro-interactions ==========
const motionSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'constants', 'motion.ts'),
  'utf8'
);
const sessionTimerSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'SessionTimer.tsx'),
  'utf8'
);
const levelIndicatorSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'LevelIndicator.tsx'),
  'utf8'
);
const levelUpCelebrationSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'components',
    'practice',
    'LevelUpCelebration.tsx'
  ),
  'utf8'
);
const settingsScreenSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(tabs)', 'settings.tsx'),
  'utf8'
);
const flashPressableSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'ui', 'FlashPressable.tsx'),
  'utf8'
);
const animatedToggleSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'ui', 'AnimatedToggle.tsx'),
  'utf8'
);

runTest('motion tokens match the design keyframes', () => {
  // Easings: entrance cubic-bezier(.22,1,.36,1), spring cubic-bezier(.34,1.56,.64,1)
  assert.ok(
    motionSource.includes('cubicBezier(0.22, 1, 0.36, 1)') &&
      motionSource.includes('cubicBezier(0.34, 1.56, 0.64, 1)'),
    'design easings changed'
  );
  // swBannerIn rises 14px; swBadgePop overshoots to 1.18 at 60%;
  // swPop peaks at 1.55 at 45%; swDot breathes to 1.55 at half opacity.
  assert.ok(
    motionSource.includes('translateY: 14') &&
      motionSource.includes("'60%': { transform: [{ scale: 1.18 }] }") &&
      motionSource.includes("'45%': { transform: [{ scale: 1.55 }] }") &&
      motionSource.includes("'50%': { opacity: 0.5, transform: [{ scale: 1.55 }] }"),
    'design keyframe values changed'
  );
});

runTest('feedback panel, badge, and rows animate in with the design cascade', () => {
  assert.ok(
    answerButtonsSource.includes('panelEntryAnimation') &&
      answerButtonsSource.includes('badgePopAnimation'),
    'feedback panel entry and badge pop must use the shared motion tokens'
  );
  // Correct: headline + IPA stagger. Incorrect: rows cascade through index 7.
  for (const row of ['cascade(1)', 'cascade(2)', 'cascade(3)', 'cascade(4)', 'cascade(5)', 'cascade(6)', 'cascade(7)']) {
    assert.ok(
      answerButtonsSource.includes(row),
      `feedback cascade lost a row: ${row}`
    );
  }
  assert.ok(
    motionSource.includes('FEEDBACK_ROW_STAGGER_MS = 50'),
    'feedback rows must stagger by 50ms as in the mock'
  );
});

runTest('compare mini-buttons expose a press state', () => {
  assert.ok(
    answerButtonsSource.includes('styles.compareButtonPressed'),
    'compare mini-buttons lost their pressed style'
  );
  assert.ok(
    stylesSource.includes('compareButtonPressed') &&
      stylesSource.includes('scale: 0.96'),
    'pressed mini-buttons must scale to 0.96 as in the mock'
  );
});

runTest('goal bar surges forward on a correct answer and animates its width', () => {
  assert.ok(
    practiceScreenSource.includes(
      "progressBoost={feedback === 'correct' ? PROGRESS_SURGE_FRACTION : 0}"
    ),
    'practice screen must surge the goal bar only while correct feedback shows'
  );
  assert.ok(
    sessionTimerSource.includes('progressBoost') &&
      sessionTimerSource.includes('barFillTransition'),
    'session timer must accept the surge and animate width changes'
  );
});

runTest('correct feedback highlights durable mastery without filling another tier', () => {
  assert.ok(
    practiceScreenSource.includes("highlightCurrentTier={feedback === 'correct'}"),
    'practice screen must request a current-tier highlight only while correct feedback shows'
  );
  assert.ok(
    !practiceScreenSource.includes('previewNextTier') &&
      !levelIndicatorSource.includes('previewNextTier'),
    'the transient next-tier preview contract must be removed'
  );
  assert.ok(
    levelIndicatorSource.includes('const isFilled = tier <= currentTier;') &&
      levelIndicatorSource.includes("backgroundColor: isFilled ? '#E67E22' : theme.track"),
    'only tiers earned through currentTier may render as filled'
  );
  assert.ok(
    levelIndicatorSource.includes('level: currentTier') &&
      !levelIndicatorSource.includes('currentTier + 1'),
    'the visible tier count and label must remain derived only from currentTier'
  );
});

runTest('correct feedback pops only the current tier and respects reduced motion', () => {
  assert.ok(
    levelIndicatorSource.includes(
      'highlightCurrentTier && tier === currentTier'
    ),
    'the reward highlight must target the achieved current tier'
  );
  assert.ok(
    levelIndicatorSource.includes(
      'isHighlighted && !reduceMotion && levelPopAnimation'
    ),
    'the current-tier pop must be disabled when reduced motion is requested'
  );
});

runTest('real mastery promotion still renders the promoted tier celebration', () => {
  assert.ok(
    practiceScreenSource.includes('<LevelUpCelebration') &&
      practiceScreenSource.includes('promotedTier={promotedTier}'),
    'practice must continue passing actual promotion state to the celebration'
  );
  assert.ok(
    levelUpCelebrationSource.includes(
      '<LevelIndicator currentTier={promotedTier} compact />'
    ),
    'the promotion celebration must render mastery from promotedTier'
  );
});

runTest('play triangle nudges on press and the timer dot pulses', () => {
  assertInOrder(
    listenControlsSource,
    ['const handlePress', 'toValue: -3', 'toValue: 2', 'toValue: 0', 'onPlay()'],
    'play icon nudge sequence changed'
  );
  assert.ok(
    sessionTimerSource.includes('liveDotAnimation'),
    'session timer dot must use the live-dot pulse'
  );
});

runTest('settings rows flash warm on tap and toggles spring on flip', () => {
  assert.ok(
    !settingsScreenSource.includes('<TouchableOpacity\n            style={styles.sectionHeader}'),
    'settings rows must use FlashPressable, not TouchableOpacity'
  );
  const flashRowCount = (settingsScreenSource.match(/<FlashPressable/g) || []).length;
  assert.ok(
    flashRowCount >= 8,
    `all settings rows must flash on tap (found ${flashRowCount})`
  );
  assert.ok(
    flashPressableSource.includes("'rgba(230, 126, 34, 0.16)'") &&
      flashPressableSource.includes('FADE_MS = 400'),
    'row flash must be the warm highlight fading over 400ms'
  );
  assert.ok(
    settingsScreenSource.includes('<AnimatedToggle') &&
      animatedToggleSource.includes('toValue: 0.84') &&
      animatedToggleSource.includes('toValue: 1.12') &&
      animatedToggleSource.includes('Easing.bezier(0.34, 1.56, 0.64, 1)'),
    'toggle knob must squash (.84×1.12) and travel on the overshoot bezier'
  );
});

runTest('micro-interactions respect reduced motion', () => {
  for (const [name, source] of [
    ['AnswerButtons', answerButtonsSource],
    ['SessionTimer', sessionTimerSource],
    ['LevelIndicator', levelIndicatorSource],
    ['ListenControls', listenControlsSource],
    ['AnimatedToggle', animatedToggleSource],
  ]) {
    assert.ok(
      source.includes('useReducedMotion'),
      `${name} must gate its animation on useReducedMotion`
    );
  }
});
