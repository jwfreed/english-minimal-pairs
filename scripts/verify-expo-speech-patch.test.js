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
