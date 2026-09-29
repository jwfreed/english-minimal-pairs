// N1: under Reduce Motion the Play control's repeating idle glow and looping
// playback bars stop, while the playing state stays perceivable (static raised
// bars, "Listening…" label). Real React render with an observable Animated.
const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

function mountListenControls() {
  const motion = { reduced: false, loopsStarted: 0, loopsStopped: 0, nudges: 0 };
  class Value {
    constructor(value) {
      this.value = value;
    }
    setValue(value) {
      this.value = value;
    }
  }
  const handle = (kind) => ({
    start() {
      if (kind === 'loop') motion.loopsStarted += 1;
      if (kind === 'nudge') motion.nudges += 1;
    },
    stop() {
      if (kind === 'loop') motion.loopsStopped += 1;
    },
  });
  const Animated = {
    Value,
    View: 'AnimatedView',
    timing: () => handle('timing'),
    delay: () => handle('delay'),
    loop: () => ({ ...handle('inner'), __loop: true }),
    // A sequence wrapping a loop is a playback bar; otherwise it is the nudge.
    sequence: (steps) =>
      handle(steps.some((step) => step && step.__loop) ? 'loop' : 'nudge'),
  };

  const { default: ListenControls } = loadTsModule(
    path.join(ROOT, 'src', 'components', 'practice', 'ListenControls.tsx'),
    new Map(),
    {
      'react-native': {
        Animated,
        Easing: { out: () => null, inOut: () => null, ease: null },
        Text: 'Text',
        TouchableOpacity: 'TouchableOpacity',
        View: 'View',
      },
      'react-native-reanimated': {
        __esModule: true,
        default: { View: 'ReanimatedView' },
        useReducedMotion: () => motion.reduced,
      },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '@/src/constants/styles': { getAmbientGlowKeyframes: () => ({}) },
      '@/src/context/theme': { useAllThemeColors: () => ({}) },
      '@/src/context/LanguageContext': { useLanguage: () => ({ translate: (key) => key }) },
    }
  );

  let root;
  const render = (isPlaying) =>
    TestRenderer.act(() => {
      const element = React.createElement(ListenControls, {
        label: 'playAudio',
        disabled: false,
        onPlay: () => {},
        isPlaying,
        styles: {},
      });
      if (root) root.update(element);
      else root = TestRenderer.create(element);
    });
  const view = {
    motion,
    render,
    glowShown: () => root.root.findAllByType('ReanimatedView').length > 0,
    barValues: () =>
      root.root
        .findAllByType('AnimatedView')
        .map((node) => node.props.style?.transform?.[0]?.scaleY?.value)
        .filter((value) => value !== undefined),
    label: () => root.root.findAllByType('Text').map((node) => node.props.children).join(''),
    press: () => TestRenderer.act(() => root.root.findByType('TouchableOpacity').props.onPress()),
    unmount: () => TestRenderer.act(() => root.unmount()),
  };
  return view;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

try {
  runTest('with motion allowed, idle glows and playback bars loop', () => {
    const view = mountListenControls();
    view.render(false);
    assert.strictEqual(view.glowShown(), true);
    view.render(true);
    assert.strictEqual(view.motion.loopsStarted, 3);
    view.press();
    assert.strictEqual(view.motion.nudges, 1);
    view.unmount();
  });

  runTest('Reduce Motion removes the idle glow and the looping bars but keeps the playing state', () => {
    const view = mountListenControls();
    view.motion.reduced = true;
    view.render(false);
    assert.strictEqual(view.glowShown(), false);
    view.press();
    assert.strictEqual(view.motion.nudges, 0);

    view.render(true);
    assert.strictEqual(view.motion.loopsStarted, 0);
    assert.deepStrictEqual(view.barValues(), [0.8, 0.8, 0.8]);
    assert.strictEqual(view.label(), 'listening');
    view.unmount();
  });

  runTest('turning on Reduce Motion during playback stops the running loops', () => {
    const view = mountListenControls();
    view.render(true);
    assert.strictEqual(view.motion.loopsStarted, 3);
    view.motion.reduced = true;
    view.render(true);
    assert.strictEqual(view.motion.loopsStopped, 3);
    assert.strictEqual(view.motion.loopsStarted, 3);
    assert.deepStrictEqual(view.barValues(), [0.8, 0.8, 0.8]);
    view.render(false);
    assert.strictEqual(view.glowShown(), false);
    view.unmount();
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
