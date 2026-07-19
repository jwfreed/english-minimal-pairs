const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const PROJECT_ROOT = path.join(__dirname, '..');

function resolveTsModule(request, parentFile) {
  if (request.startsWith('@/')) {
    return path.join(PROJECT_ROOT, request.slice(2));
  }
  if (request.startsWith('.')) {
    return path.resolve(path.dirname(parentFile), request);
  }
  return null;
}

function loadTsModule(entryPath, cache = new Map(), moduleMocks = {}) {
  const resolvedEntry = entryPath.endsWith('.ts') ? entryPath : `${entryPath}.ts`;
  if (cache.has(resolvedEntry)) return cache.get(resolvedEntry).exports;

  const source = fs.readFileSync(resolvedEntry, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolvedEntry,
  }).outputText;

  const module = { exports: {} };
  cache.set(resolvedEntry, module);

  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(moduleMocks, request)) {
      return moduleMocks[request];
    }
    const tsModulePath = resolveTsModule(request, resolvedEntry);
    if (tsModulePath) {
      const withTsExtension = tsModulePath.endsWith('.ts') ? tsModulePath : `${tsModulePath}.ts`;
      if (fs.existsSync(withTsExtension)) {
        return loadTsModule(withTsExtension, cache, moduleMocks);
      }
    }
    return require(request);
  };

  const script = new vm.Script(output, { filename: resolvedEntry });
  const context = vm.createContext({
    require: localRequire,
    module,
    exports: module.exports,
    __dirname: path.dirname(resolvedEntry),
    __filename: resolvedEntry,
    console,
    __DEV__: false,
  });
  script.runInContext(context);

  return module.exports;
}

module.exports = { loadTsModule };
