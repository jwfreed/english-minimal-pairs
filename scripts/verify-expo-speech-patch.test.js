const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadManifest,
  verifyInstalledPatch,
  verifyBuildLogProvenance,
  formatStatusBlock,
} = require('./verify-expo-speech-patch');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const DEFAULT_SWIFT_SOURCE = [
  'import ExpoModulesCore',
  '',
  'public final class SpeechModule: Module {',
  '  private let soundwiseGenerationDrainSentinel =',
  '    "SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1"',
  '}',
  '',
].join('\n');

function sha256Of(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function withFixtureProject(overrides, fn) {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'expo-speech-patch-fixture-')
  );
  try {
    const swiftSourceContent =
      overrides.swiftSourceContent !== undefined
        ? overrides.swiftSourceContent
        : DEFAULT_SWIFT_SOURCE;

    const packageDir = path.join(projectRoot, 'node_modules', 'expo-speech');
    fs.mkdirSync(path.join(packageDir, 'ios'), { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'expo-speech',
        version: overrides.installedVersion || '14.0.7',
      })
    );
    fs.writeFileSync(
      path.join(packageDir, 'ios', 'SpeechModule.swift'),
      swiftSourceContent
    );

    if (overrides.includeXcframework) {
      fs.mkdirSync(path.join(packageDir, 'ios', 'ExpoSpeech.xcframework'), {
        recursive: true,
      });
    }

    fs.writeFileSync(
      path.join(projectRoot, 'package-lock.json'),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          'node_modules/expo-speech': {
            version: overrides.lockfileVersion || '14.0.7',
          },
        },
      })
    );

    if (overrides.includePatchFile !== false) {
      const patchFileName = overrides.patchFileName || 'expo-speech+14.0.7.patch';
      fs.mkdirSync(path.join(projectRoot, 'patches'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, 'patches', patchFileName),
        'diff --git a/node_modules/expo-speech/ios/SpeechModule.swift b/node_modules/expo-speech/ios/SpeechModule.swift\n'
      );
    }

    if (overrides.includeExperimentModule) {
      fs.mkdirSync(
        path.join(projectRoot, 'modules', 'tts-synthesizer-lifecycle-experiment'),
        { recursive: true }
      );
    }

    if (overrides.includeExperimentAdapter) {
      fs.mkdirSync(path.join(projectRoot, 'src', 'experiments'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(
          projectRoot,
          'src',
          'experiments',
          'ttsSynthesizerLifecycleExperiment.ts'
        ),
        'export const noop = true;\n'
      );
    }

    if (overrides.includeExperimentSelector) {
      fs.mkdirSync(path.join(projectRoot, 'src', 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, 'src', 'hooks', 'useAudio.ts'),
        'const flag = process.env.IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE;\n'
      );
    }

    const manifest = {
      packageName: 'expo-speech',
      version: overrides.manifestVersion || '14.0.7',
      patchFile: overrides.manifestPatchFile || 'patches/expo-speech+14.0.7.patch',
      swiftSource: 'node_modules/expo-speech/ios/SpeechModule.swift',
      sentinel:
        overrides.manifestSentinel || 'SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1',
      sha256:
        overrides.manifestSha256 !== undefined
          ? overrides.manifestSha256
          : sha256Of(swiftSourceContent),
    };

    fn({ projectRoot, manifest });
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

function writeBuildLog(projectRoot, lines) {
  const logPath = path.join(projectRoot, 'build.log');
  fs.writeFileSync(logPath, `${lines.join('\n')}\n`);
  return logPath;
}

runTest(
  'accepts an installed patch only when every provenance condition is satisfied',
  () => {
    withFixtureProject({}, ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.deepStrictEqual(result.errors, []);
      assert.strictEqual(result.status.version, '14.0.7');
      assert.strictEqual(result.status.sentinel, manifest.sentinel);
      assert.strictEqual(result.status.hash, manifest.sha256);
      assert.strictEqual(result.status.xcframeworkStatus, 'clean');
      assert.strictEqual(result.status.experimentStatus, 'clean');
      assert.ok(
        result.status.sourcePath.endsWith(path.join('ios', 'SpeechModule.swift'))
      );
    });
  }
);

runTest(
  'rejects an installed version that drifted from the pinned manifest version',
  () => {
    withFixtureProject({ installedVersion: '14.0.8' }, ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.ok(
        result.errors.some((error) => error.includes('installed expo-speech version')),
        `expected an installed-version error, got: ${JSON.stringify(result.errors)}`
      );
    });
  }
);

runTest(
  'rejects a lockfile version that drifted from the pinned manifest version',
  () => {
    withFixtureProject({ lockfileVersion: '14.0.8' }, ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.ok(
        result.errors.some((error) => error.includes('package-lock.json')),
        `expected a lockfile-version error, got: ${JSON.stringify(result.errors)}`
      );
    });
  }
);

runTest('rejects a missing patch file', () => {
  withFixtureProject({ includePatchFile: false }, ({ projectRoot, manifest }) => {
    const result = verifyInstalledPatch({ projectRoot, manifest });
    assert.ok(
      result.errors.some((error) => error.includes('patch file is missing')),
      `expected a missing-patch-file error, got: ${JSON.stringify(result.errors)}`
    );
  });
});

runTest(
  'rejects a patch filename that does not match the pinned manifest version',
  () => {
    withFixtureProject(
      {
        patchFileName: 'expo-speech+14.0.6.patch',
        manifestPatchFile: 'patches/expo-speech+14.0.6.patch',
      },
      ({ projectRoot, manifest }) => {
        const result = verifyInstalledPatch({ projectRoot, manifest });
        assert.ok(
          result.errors.some((error) => error.includes('patch filename')),
          `expected a patch-filename error, got: ${JSON.stringify(result.errors)}`
        );
      }
    );
  }
);

runTest('rejects installed source missing the required sentinel', () => {
  withFixtureProject(
    { swiftSourceContent: 'import ExpoModulesCore\n// no sentinel here\n' },
    ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.ok(
        result.errors.some((error) => error.includes('sentinel')),
        `expected a sentinel error, got: ${JSON.stringify(result.errors)}`
      );
    }
  );
});

runTest(
  'rejects installed source whose hash drifted from the pinned manifest sha256',
  () => {
    withFixtureProject(
      { manifestSha256: '0'.repeat(64) },
      ({ projectRoot, manifest }) => {
        const result = verifyInstalledPatch({ projectRoot, manifest });
        assert.ok(
          result.errors.some((error) => error.includes('sha256')),
          `expected a sha256-mismatch error, got: ${JSON.stringify(result.errors)}`
        );
      }
    );
  }
);

runTest(
  'rejects a vendored ExpoSpeech.xcframework introduced under the installed package',
  () => {
    withFixtureProject({ includeXcframework: true }, ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.ok(
        result.errors.some((error) => error.includes('ExpoSpeech.xcframework')),
        `expected an xcframework-drift error, got: ${JSON.stringify(result.errors)}`
      );
      assert.strictEqual(result.status.xcframeworkStatus, 'drift-detected');
    });
  }
);

runTest('rejects a leaked experiment module directory', () => {
  withFixtureProject({ includeExperimentModule: true }, ({ projectRoot, manifest }) => {
    const result = verifyInstalledPatch({ projectRoot, manifest });
    assert.ok(
      result.errors.some((error) => error.includes('experiment')),
      `expected an experiment-leak error, got: ${JSON.stringify(result.errors)}`
    );
    assert.strictEqual(result.status.experimentStatus, 'leak-detected');
  });
});

runTest('rejects a leaked experiment adapter file', () => {
  withFixtureProject({ includeExperimentAdapter: true }, ({ projectRoot, manifest }) => {
    const result = verifyInstalledPatch({ projectRoot, manifest });
    assert.ok(
      result.errors.some((error) => error.includes('experiment')),
      `expected an experiment-leak error, got: ${JSON.stringify(result.errors)}`
    );
  });
});

runTest('rejects a leaked experiment mode selector string', () => {
  withFixtureProject(
    { includeExperimentSelector: true },
    ({ projectRoot, manifest }) => {
      const result = verifyInstalledPatch({ projectRoot, manifest });
      assert.ok(
        result.errors.some((error) => error.includes('experiment')),
        `expected an experiment-leak error, got: ${JSON.stringify(result.errors)}`
      );
    }
  );
});

runTest(
  'rejects a build log lacking the canonical patched SpeechModule.swift compile entry',
  () => {
    withFixtureProject({}, ({ projectRoot, manifest }) => {
      const logPath = writeBuildLog(projectRoot, [
        'CompileSwift normal arm64 /some/other/path/NotSpeech.swift',
      ]);
      const result = verifyBuildLogProvenance({
        projectRoot,
        manifest,
        buildLogPath: logPath,
      });
      assert.ok(
        result.errors.some((error) => error.includes('does not reference')),
        `expected a missing-canonical-entry error, got: ${JSON.stringify(result.errors)}`
      );
    });
  }
);

runTest(
  'rejects a build log compiling a second distinct Expo Speech SpeechModule.swift source',
  () => {
    withFixtureProject({}, ({ projectRoot, manifest }) => {
      const canonicalPath = path.join(
        projectRoot,
        'node_modules',
        'expo-speech',
        'ios',
        'SpeechModule.swift'
      );
      const strayPath = path.join(
        projectRoot,
        '.build-cache',
        'expo-speech-stray',
        'ios',
        'SpeechModule.swift'
      );
      const logPath = writeBuildLog(projectRoot, [
        `CompileSwift normal arm64 ${canonicalPath}`,
        `CompileSwift normal arm64 ${strayPath}`,
      ]);
      const result = verifyBuildLogProvenance({
        projectRoot,
        manifest,
        buildLogPath: logPath,
      });
      assert.ok(
        result.errors.some((error) => error.includes('distinct')),
        `expected a distinct-source error, got: ${JSON.stringify(result.errors)}`
      );
    });
  }
);

runTest(
  'accepts a build log naming only the canonical patched SpeechModule.swift source',
  () => {
    withFixtureProject({}, ({ projectRoot, manifest }) => {
      const canonicalPath = path.join(
        projectRoot,
        'node_modules',
        'expo-speech',
        'ios',
        'SpeechModule.swift'
      );
      const logPath = writeBuildLog(projectRoot, [
        `CompileSwift normal arm64 ${canonicalPath}`,
      ]);
      const result = verifyBuildLogProvenance({
        projectRoot,
        manifest,
        buildLogPath: logPath,
      });
      assert.deepStrictEqual(result.errors, []);
    });
  }
);

runTest(
  'formats a success status block with every required provenance field',
  () => {
    const status = {
      packageName: 'expo-speech',
      version: '14.0.7',
      patchFile: 'patches/expo-speech+14.0.7.patch',
      sourcePath: '/tmp/x/node_modules/expo-speech/ios/SpeechModule.swift',
      sentinel: 'SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1',
      hash: 'abc123',
      xcframeworkStatus: 'clean',
      experimentStatus: 'clean',
    };
    const block = formatStatusBlock(status);
    for (const expected of [
      status.version,
      status.patchFile,
      status.sourcePath,
      status.sentinel,
      status.hash,
      status.xcframeworkStatus,
      status.experimentStatus,
    ]) {
      assert.ok(block.includes(expected), `status block missing ${expected}`);
    }
  }
);

runTest(
  'loads and verifies the real repository manifest against the real installed package',
  () => {
    const projectRoot = path.join(__dirname, '..');
    const manifest = loadManifest(projectRoot);
    const result = verifyInstalledPatch({ projectRoot, manifest });
    assert.deepStrictEqual(result.errors, []);
  }
);

// --- Task 6: macOS native CI workflow contract -----------------------------
//
// This is a deliberately minimal, line-scoped parser for this repository's
// simple workflow style (single-line `run: <command>` steps, no `run: |`
// blocks, no anchors/aliases) — not a general YAML parser. A real parser is
// available only as a transitive dependency (via eslint), not a direct one,
// and adding a direct dependency for one CI-contract test is out of scope.

function parseWorkflowJobs(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex === -1) return {};

  const jobs = {};
  let currentJobName = null;

  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const jobHeaderMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobHeaderMatch) {
      currentJobName = jobHeaderMatch[1];
      jobs[currentJobName] = { runsOn: null, timeoutMinutes: null, runCommands: [] };
      continue;
    }

    if (currentJobName === null) continue;
    if (/^\S/.test(line)) break; // dedented past `jobs:` entirely

    const runsOnMatch = line.match(/^\s+runs-on:\s*(.+)$/);
    if (runsOnMatch) {
      jobs[currentJobName].runsOn = runsOnMatch[1].trim();
      continue;
    }
    const timeoutMatch = line.match(/^\s+timeout-minutes:\s*(\d+)\s*$/);
    if (timeoutMatch) {
      jobs[currentJobName].timeoutMinutes = Number(timeoutMatch[1]);
      continue;
    }
    const runMatch = line.match(/^\s+run:\s*(.+)$/);
    if (runMatch) {
      jobs[currentJobName].runCommands.push(runMatch[1].trim());
    }
  }

  return jobs;
}

function loadWorkflowJobs() {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'test.yml');
  return parseWorkflowJobs(fs.readFileSync(workflowPath, 'utf8'));
}

runTest('CI still runs the existing Ubuntu check job unmodified', () => {
  const jobs = loadWorkflowJobs();
  const ubuntuJob = Object.values(jobs).find((job) => job.runsOn === 'ubuntu-latest');
  assert.ok(ubuntuJob, 'expected an ubuntu-latest job to remain in the workflow');
  assert.ok(
    ubuntuJob.runCommands.some((cmd) => cmd.includes('npm run check')),
    'expected the ubuntu-latest job to still run npm run check'
  );
});

runTest('CI adds a macOS job that runs npm ci, patch provenance, then native Swift tests, in that order', () => {
  const jobs = loadWorkflowJobs();
  const macJob = Object.values(jobs).find((job) => /^macos-/.test(job.runsOn || ''));
  assert.ok(macJob, 'expected a macos-* job in the workflow');

  const ciIndex = macJob.runCommands.findIndex((cmd) => cmd.includes('npm ci'));
  const verifyIndex = macJob.runCommands.findIndex((cmd) =>
    cmd.includes('npm run verify:expo-speech-patch')
  );
  const nativeIndex = macJob.runCommands.findIndex((cmd) =>
    cmd.includes('npm run test:expo-speech-native')
  );

  assert.notStrictEqual(ciIndex, -1, 'expected the macOS job to run npm ci');
  assert.notStrictEqual(verifyIndex, -1, 'expected the macOS job to verify patch provenance');
  assert.notStrictEqual(nativeIndex, -1, 'expected the macOS job to run the native Swift tests');
  assert.ok(ciIndex < verifyIndex, 'npm ci must run before patch provenance verification');
  assert.ok(
    verifyIndex < nativeIndex,
    'patch provenance must be verified before compiling native Swift tests'
  );
});

runTest('the macOS job declares a bounded timeout', () => {
  const jobs = loadWorkflowJobs();
  const macJob = Object.values(jobs).find((job) => /^macos-/.test(job.runsOn || ''));
  assert.ok(macJob, 'expected a macos-* job in the workflow');
  assert.ok(
    Number.isInteger(macJob.timeoutMinutes) && macJob.timeoutMinutes > 0,
    'expected the macOS job to declare a positive timeout-minutes'
  );
});

runTest('the macOS job does not run the full lint/typecheck/full-suite check', () => {
  const jobs = loadWorkflowJobs();
  const macJob = Object.values(jobs).find((job) => /^macos-/.test(job.runsOn || ''));
  assert.ok(macJob, 'expected a macos-* job in the workflow');
  assert.ok(
    macJob.runCommands.every((cmd) => !cmd.includes('npm run check')),
    'the macOS job should only run the two commands that actually need Darwin, not the full check suite'
  );
});
