const { spawnSync } = require('child_process');
const path = require('path');

const testName = 'Expo Speech generation lifecycle native suite';

if (process.platform !== 'darwin') {
  console.log(`ok - ${testName} (SKIP: requires Darwin and xcrun Swift toolchain)`);
} else {
  const repositoryRoot = path.join(__dirname, '..');
  const executablePath = '/tmp/soundwise-expo-speech-generation-tests';
  const compilerEnvironment = {
    ...process.env,
    CLANG_MODULE_CACHE_PATH: '/tmp/soundwise-clang-module-cache',
    SWIFT_MODULE_CACHE_PATH: '/tmp/soundwise-swift-module-cache',
  };
  const compile = spawnSync(
    'xcrun',
    [
      'swiftc',
      'node_modules/expo-speech/ios/SpeechGenerationLifecycle.swift',
      'scripts/expoSpeechGenerationLifecycleTests.swift',
      '-o',
      executablePath,
    ],
    { cwd: repositoryRoot, env: compilerEnvironment, stdio: 'inherit' }
  );

  if (compile.error) {
    throw compile.error;
  }
  if (compile.status !== 0) {
    throw new Error(`Swift compilation failed with exit code ${compile.status}`);
  }

  const execution = spawnSync(executablePath, [], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });

  if (execution.error) {
    throw execution.error;
  }
  if (execution.status !== 0) {
    throw new Error(`Swift test executable failed with exit code ${execution.status}`);
  }

  console.log(`ok - ${testName}`);
}
