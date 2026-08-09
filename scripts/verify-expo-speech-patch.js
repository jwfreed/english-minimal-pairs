const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPERIMENT_SEARCH_EXTENSIONS = /\.(ts|tsx|js|jsx|json|swift)$/;
const EXPERIMENT_MODULE_RELATIVE_PATH = path.join(
  'modules',
  'tts-synthesizer-lifecycle-experiment'
);
const EXPERIMENT_ADAPTER_RELATIVE_PATH = path.join(
  'src',
  'experiments',
  'ttsSynthesizerLifecycleExperiment.ts'
);
const EXPERIMENT_SELECTOR_IDENTIFIER = 'IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE';

function loadManifest(projectRoot) {
  const manifestPath = path.join(
    projectRoot,
    'scripts',
    'expoSpeechPatchManifest.json'
  );
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function resolveInstalledPackageJsonPath(projectRoot, packageName) {
  return require.resolve(`${packageName}/package.json`, { paths: [projectRoot] });
}

function relativeSourceWithinPackage(packageName, swiftSource) {
  return path.relative(path.join('node_modules', packageName), swiftSource);
}

function findEntriesNamed(rootDir, targetName) {
  const matches = [];
  if (!fs.existsSync(rootDir)) {
    return matches;
  }
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.name === targetName) {
        matches.push(entryPath);
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    }
  }
  return matches;
}

function findStringInTree(rootDir, needle) {
  const matches = [];
  if (!fs.existsSync(rootDir)) {
    return matches;
  }
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!EXPERIMENT_SEARCH_EXTENSIONS.test(entry.name)) {
        continue;
      }
      const content = fs.readFileSync(entryPath, 'utf8');
      if (content.includes(needle)) {
        matches.push(entryPath);
      }
    }
  }
  return matches;
}

function verifyInstalledPatch({ projectRoot, manifest }) {
  const errors = [];
  const status = {
    packageName: manifest.packageName,
    version: manifest.version,
    patchFile: manifest.patchFile,
    sentinel: manifest.sentinel,
    hash: null,
    xcframeworkStatus: 'unknown',
    experimentStatus: 'unknown',
    sourcePath: null,
  };

  let resolvedPackageJsonPath = null;
  try {
    resolvedPackageJsonPath = resolveInstalledPackageJsonPath(
      projectRoot,
      manifest.packageName
    );
  } catch (error) {
    errors.push(
      `${manifest.packageName} could not be resolved from ${projectRoot}: ${error.message}`
    );
  }

  let packageDir = null;
  if (resolvedPackageJsonPath) {
    packageDir = path.dirname(resolvedPackageJsonPath);
    const installedPackageJson = JSON.parse(
      fs.readFileSync(resolvedPackageJsonPath, 'utf8')
    );
    if (installedPackageJson.version !== manifest.version) {
      errors.push(
        `installed expo-speech version is ${installedPackageJson.version}, expected ${manifest.version} (run npm ci, or update the manifest after an intentional upgrade)`
      );
    }
  }

  const lockfilePath = path.join(projectRoot, 'package-lock.json');
  if (!fs.existsSync(lockfilePath)) {
    errors.push(`package-lock.json is missing at ${lockfilePath}`);
  } else {
    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
    const lockEntry =
      lockfile.packages &&
      lockfile.packages[`node_modules/${manifest.packageName}`];
    if (!lockEntry) {
      errors.push(
        `package-lock.json has no entry for node_modules/${manifest.packageName}`
      );
    } else if (lockEntry.version !== manifest.version) {
      errors.push(
        `package-lock.json pins ${manifest.packageName}@${lockEntry.version}, expected ${manifest.version}`
      );
    }
  }

  const expectedPatchFileName = `${manifest.packageName}+${manifest.version}.patch`;
  const actualPatchFileName = path.basename(manifest.patchFile);
  if (actualPatchFileName !== expectedPatchFileName) {
    errors.push(
      `manifest patch filename is ${actualPatchFileName}, expected ${expectedPatchFileName} for the pinned version`
    );
  }
  const patchFileAbsolutePath = path.join(projectRoot, manifest.patchFile);
  if (!fs.existsSync(patchFileAbsolutePath)) {
    errors.push(`patch file is missing at ${manifest.patchFile}`);
  }

  if (packageDir) {
    const sourceAbsolutePath = path.join(
      packageDir,
      relativeSourceWithinPackage(manifest.packageName, manifest.swiftSource)
    );
    status.sourcePath = sourceAbsolutePath;

    if (!fs.existsSync(sourceAbsolutePath)) {
      errors.push(
        `patched Swift source is missing at the resolved install path ${sourceAbsolutePath}`
      );
    } else {
      const sourceContent = fs.readFileSync(sourceAbsolutePath, 'utf8');
      if (!sourceContent.includes(manifest.sentinel)) {
        errors.push(
          `installed source is missing the required sentinel ${manifest.sentinel}; the patch did not land or was overwritten`
        );
      }
      const hash = crypto
        .createHash('sha256')
        .update(sourceContent, 'utf8')
        .digest('hex');
      status.hash = hash;
      if (hash !== manifest.sha256) {
        errors.push(
          `installed source sha256 is ${hash}, expected ${manifest.sha256}; the compiled source no longer matches the approved patch`
        );
      }
    }

    const xcframeworkMatches = findEntriesNamed(packageDir, 'ExpoSpeech.xcframework');
    if (xcframeworkMatches.length > 0) {
      status.xcframeworkStatus = 'drift-detected';
      errors.push(
        `unexpected ExpoSpeech.xcframework found under the installed package (${xcframeworkMatches.join(
          ', '
        )}); a future binary distribution could bypass source patching and silently disable this mitigation`
      );
    } else {
      status.xcframeworkStatus = 'clean';
    }
  }

  const experimentFindings = [];
  const experimentModuleDir = path.join(projectRoot, EXPERIMENT_MODULE_RELATIVE_PATH);
  if (fs.existsSync(experimentModuleDir)) {
    experimentFindings.push(experimentModuleDir);
  }
  const experimentAdapterFile = path.join(
    projectRoot,
    EXPERIMENT_ADAPTER_RELATIVE_PATH
  );
  if (fs.existsSync(experimentAdapterFile)) {
    experimentFindings.push(experimentAdapterFile);
  }
  experimentFindings.push(
    ...findStringInTree(path.join(projectRoot, 'src'), EXPERIMENT_SELECTOR_IDENTIFIER)
  );

  if (experimentFindings.length > 0) {
    status.experimentStatus = 'leak-detected';
    errors.push(
      `temporary lifecycle-experiment artifacts leaked into production: ${experimentFindings.join(
        ', '
      )}`
    );
  } else {
    status.experimentStatus = 'clean';
  }

  return { errors, status };
}

function resolveCanonicalSourcePath({ projectRoot, manifest }) {
  const resolvedPackageJsonPath = resolveInstalledPackageJsonPath(
    projectRoot,
    manifest.packageName
  );
  const packageDir = path.dirname(resolvedPackageJsonPath);
  return canonicalizePath(
    path.join(
      packageDir,
      relativeSourceWithinPackage(manifest.packageName, manifest.swiftSource)
    )
  );
}

function canonicalizePath(candidatePath) {
  try {
    return fs.realpathSync(candidatePath);
  } catch (error) {
    return path.resolve(candidatePath);
  }
}

function extractSpeechModuleCompilePaths(buildLogText) {
  const matches = buildLogText.match(/\S*SpeechModule\.swift/g) || [];
  return Array.from(new Set(matches.map((match) => canonicalizePath(match))));
}

function verifyBuildLogProvenance({ projectRoot, manifest, buildLogPath }) {
  const errors = [];

  if (!fs.existsSync(buildLogPath)) {
    errors.push(`build log is missing at ${buildLogPath}`);
    return { errors };
  }

  let canonicalSourcePath;
  try {
    canonicalSourcePath = resolveCanonicalSourcePath({ projectRoot, manifest });
  } catch (error) {
    errors.push(
      `${manifest.packageName} could not be resolved for build-log provenance: ${error.message}`
    );
    return { errors };
  }

  const buildLogText = fs.readFileSync(buildLogPath, 'utf8');
  const compiledPaths = extractSpeechModuleCompilePaths(buildLogText);

  if (!compiledPaths.includes(canonicalSourcePath)) {
    errors.push(
      `build log does not reference the canonical patched source ${canonicalSourcePath}; the compiled binary may not contain the approved mitigation (this checks the build log text only and does not itself prove final compiled object provenance)`
    );
  }

  const distinctExpoSpeechSources = compiledPaths.filter((candidate) =>
    candidate.toLowerCase().includes(manifest.packageName.toLowerCase())
  );
  if (distinctExpoSpeechSources.length > 1) {
    errors.push(
      `build log compiles ${distinctExpoSpeechSources.length} distinct ${manifest.packageName} SpeechModule.swift sources (${distinctExpoSpeechSources.join(
        ', '
      )}); only the canonical patched source should be compiled`
    );
  }

  return { errors };
}

function formatStatusBlock(status) {
  return [
    'Expo Speech patch provenance verified:',
    `  package: ${status.packageName}@${status.version}`,
    `  patch: ${status.patchFile}`,
    `  source: ${status.sourcePath}`,
    `  sentinel: ${status.sentinel}`,
    `  sha256: ${status.hash}`,
    `  xcframework: ${status.xcframeworkStatus}`,
    `  experiment isolation: ${status.experimentStatus}`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = { installed: false, buildLogPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--installed') {
      args.installed = true;
    } else if (arg === '--build-log') {
      index += 1;
      args.buildLogPath = argv[index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function runCli(argv, projectRoot) {
  const args = parseArgs(argv);
  if (!args.installed) {
    console.error('Usage: verify-expo-speech-patch.js --installed [--build-log <path>]');
    process.exitCode = 1;
    return;
  }

  const manifest = loadManifest(projectRoot);
  const installedResult = verifyInstalledPatch({ projectRoot, manifest });
  let errors = installedResult.errors.slice();

  if (args.buildLogPath) {
    const buildLogResult = verifyBuildLogProvenance({
      projectRoot,
      manifest,
      buildLogPath: args.buildLogPath,
    });
    errors = errors.concat(buildLogResult.errors);
  }

  if (errors.length > 0) {
    console.error(
      `Expo Speech patch provenance verification failed with ${errors.length} error(s):`
    );
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(formatStatusBlock(installedResult.status));
}

if (require.main === module) {
  runCli(process.argv.slice(2), path.join(__dirname, '..'));
}

module.exports = {
  loadManifest,
  verifyInstalledPatch,
  verifyBuildLogProvenance,
  formatStatusBlock,
  runCli,
};
