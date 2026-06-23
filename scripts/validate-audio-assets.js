// The app uses device TTS for spoken words. This script validates only
// bundled audio assets required by the app; it does not validate runtime
// device TTS behavior, installed voices, or iOS silent-mode behavior.
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const requiredAudioAssets = [
  {
    name: 'iOS silent-mode TTS warmup audio',
    path: 'assets/audio/silent.mp3',
    referencedBy: 'src/hooks/useAudio.ts',
  },
];

function validateAudioAssets() {
  const errors = [];

  for (const asset of requiredAudioAssets) {
    const fullPath = path.join(PROJECT_ROOT, asset.path);
    if (!fs.existsSync(fullPath)) {
      errors.push(`${asset.name} is missing: ${asset.path}`);
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      errors.push(`${asset.name} is not a file: ${asset.path}`);
    } else if (stat.size === 0) {
      errors.push(`${asset.name} is empty: ${asset.path}`);
    }

    const referencePath = path.join(PROJECT_ROOT, asset.referencedBy);
    const source = fs.existsSync(referencePath)
      ? fs.readFileSync(referencePath, 'utf8')
      : '';
    const assetFileName = path.basename(asset.path);
    if (!source.includes(assetFileName)) {
      errors.push(
        `${asset.name} is not referenced by ${asset.referencedBy}: ${assetFileName}`
      );
    }
  }

  return errors;
}

function runCli() {
  const errors = validateAudioAssets();

  if (errors.length > 0) {
    console.error(`Audio asset validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  for (const asset of requiredAudioAssets) {
    console.log(`${asset.name}: ${asset.path}`);
  }
  console.log('Audio asset validation passed.');
}

if (require.main === module) {
  runCli();
}

module.exports = {
  requiredAudioAssets,
  validateAudioAssets,
};
