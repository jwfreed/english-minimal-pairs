// D8: light-theme text/background pairs the audit measured at ~2.8:1 must meet
// WCAG AA 4.5:1 (normal-size text: button and Play labels are 17–18px bold,
// below the large-text threshold). Ratios are computed from the real tokens
// and the real style factory.
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const { Colors } = loadTsModule(path.join(ROOT, 'src', 'constants', 'Colors.ts'));
const createStyles = loadTsModule(
  path.join(ROOT, 'src', 'constants', 'styles.ts'),
  new Map(),
  {
    'react-native': {
      StyleSheet: { create: (styles) => styles },
      Dimensions: { get: () => ({ width: 390, height: 844 }) },
    },
  }
).default;

const AA_NORMAL_TEXT = 4.5;

function channels(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composites an `#RRGGBBAA` token over an opaque background. */
function composite(hexWithAlpha, background) {
  const alpha = parseInt(hexWithAlpha.slice(7, 9), 16) / 255;
  const fg = channels(hexWithAlpha.slice(0, 7));
  const bg = channels(background);
  return `#${fg
    .map((c, index) =>
      Math.round((c * alpha + bg[index] * (1 - alpha)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
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

const light = Colors.light;
const styles = createStyles(light);

const pairs = [
  ['primary button label', styles.buttonText.color, styles.button.backgroundColor],
  ['Play label (idle)', styles.playButtonLabel.color, styles.playButton.backgroundColor],
  ['Play label (listening)', styles.playButtonLabel.color, styles.playButtonPlaying.backgroundColor],
  ['dropdown button label', styles.dropdownButtonText.color, styles.dropdownButton.backgroundColor],
  ['correct feedback text', styles.correctFeedback.color, light.surface],
  ['correct feedback circle mark', light.buttonText, styles.correctFeedbackCircle.backgroundColor],
  ['placement-completed status text', light.success, light.surface],
  ['contrast highlight text', styles.contrastContext.color, light.surface],
  ['replay button text', styles.replayButtonText.color, composite(styles.replayButton.backgroundColor, light.surface)],
  ['level-up text', styles.levelUpText.color, composite(styles.levelUpContainer.backgroundColor, light.surface)],
  ['refresh button text', styles.refreshButtonText.color, light.surface],
];

runTest('identified light-theme text pairs meet WCAG AA normal-text contrast', () => {
  const failures = pairs
    .map(([name, fg, bg]) => [name, contrast(fg, bg)])
    .filter(([, ratio]) => ratio < AA_NORMAL_TEXT)
    .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1`);
  assert.deepStrictEqual(failures, []);
});

runTest('the playing state stays visibly darker than idle', () => {
  assert.ok(
    luminance(styles.playButtonPlaying.backgroundColor) <
      luminance(styles.playButton.backgroundColor)
  );
});

runTest('dark theme tokens are unchanged by the light-theme fix', () => {
  assert.strictEqual(Colors.dark.primary, '#D35400');
  assert.strictEqual(Colors.dark.success, '#2ECC71');
});

// Practice-card text must hold in both themes: the instruction on the card,
// the IPA on the answer tiles, and the feedback panel's emphasis on the panel
// surface and on the tinted compare buttons.
runTest('practice and feedback text meet WCAG AA in both themes', () => {
  const failures = [];
  for (const [scheme, colors] of Object.entries(Colors)) {
    const themed = createStyles(colors);
    for (const [name, fg, bg] of [
      ['listening instruction on card', themed.contrastInstruction.color, colors.surface],
      ['answer tile IPA on tile', themed.answerTileIpa.color, themed.answerTile.backgroundColor],
      ['phoneme highlight on panel', themed.feedbackHighlight.color, colors.surface],
      ['phoneme highlight on compare button', themed.feedbackHighlight.color, themed.compareButton.backgroundColor],
      ['contrast label on panel', themed.contrastContext.color, colors.surface],
      ['compare tag on compare button', themed.compareTag.color, themed.compareButton.backgroundColor],
    ]) {
      const ratio = contrast(fg, bg);
      if (ratio < AA_NORMAL_TEXT) failures.push(`${scheme} ${name}: ${ratio.toFixed(2)}:1`);
    }
  }
  assert.deepStrictEqual(failures, []);
});

runTest('both palettes define the same tokens', () => {
  assert.deepStrictEqual(Object.keys(Colors.dark).sort(), Object.keys(Colors.light).sort());
});

// A palette change must be a Colors.ts edit: no hex literals elsewhere, and no
// scheme detection by comparing a color value (which silently breaks when the
// compared color changes). The TTS debug screen is a developer tool.
runTest('palette colors live only in Colors.ts', () => {
  const fs = require('fs');
  const allowed = new Set([
    path.join('src', 'constants', 'Colors.ts'),
    path.join('src', 'components', 'TTSDebugScreen.tsx'),
  ]);
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (/\.tsx?$/.test(entry.name) && !allowed.has(relative)) files.push(relative);
    }
  };
  ['src', 'app', 'utils'].forEach(walk);
  const offenders = files.filter((file) =>
    /#[0-9A-Fa-f]{6}\b|===\s*['"]#/.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))
  );
  assert.deepStrictEqual(offenders, []);
});

if (require.main === module) {
  for (const [name, fg, bg] of pairs) {
    console.log(`  ${contrast(fg, bg).toFixed(2)}:1  ${name}`);
  }
}
