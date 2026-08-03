function dependenciesChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some(
    (dependency, index) => !Object.is(dependency, previous[index])
  );
}

function createHookHarness({ onStateChange = () => {} } = {}) {
  const states = [];
  const stateInitialized = [];
  const refs = [];
  const memos = [];
  const callbacks = [];
  const effectDependencies = [];
  const effectCleanups = [];

  let stateIndex = 0;
  let refIndex = 0;
  let memoIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let pendingEffects = [];
  let stateVersion = 0;
  let mounted = false;
  let mountCount = 0;

  const react = {
    useState(initialValue) {
      const index = stateIndex++;
      if (!stateInitialized[index]) {
        states[index] =
          typeof initialValue === 'function' ? initialValue() : initialValue;
        stateInitialized[index] = true;
      }

      const setState = (nextValue) => {
        const previous = states[index];
        const next =
          typeof nextValue === 'function'
            ? nextValue(previous)
            : nextValue;
        if (Object.is(previous, next)) return;
        states[index] = next;
        stateVersion += 1;
        onStateChange({ index, previous, next });
      };

      return [states[index], setState];
    },

    useRef(initialValue) {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initialValue };
      return refs[index];
    },

    useMemo(factory, dependencies) {
      const index = memoIndex++;
      const previous = memos[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        memos[index] = {
          dependencies,
          value: factory(),
        };
      }
      return memos[index].value;
    },

    useCallback(callback, dependencies) {
      const index = callbackIndex++;
      const previous = callbacks[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        callbacks[index] = { dependencies, callback };
      }
      return callbacks[index].callback;
    },

    useEffect(effect, dependencies) {
      const index = effectIndex++;
      if (dependenciesChanged(effectDependencies[index], dependencies)) {
        pendingEffects.push({ effect, index });
        effectDependencies[index] = dependencies;
      }
    },
  };

  function renderOnce(renderHook) {
    if (!mounted) {
      mounted = true;
      mountCount += 1;
    }
    stateIndex = 0;
    refIndex = 0;
    memoIndex = 0;
    callbackIndex = 0;
    effectIndex = 0;
    pendingEffects = [];

    const result = renderHook();
    for (const { effect, index } of pendingEffects) {
      effectCleanups[index]?.();
      const cleanup = effect();
      effectCleanups[index] =
        typeof cleanup === 'function' ? cleanup : undefined;
    }
    return result;
  }

  function unmount() {
    for (const cleanup of effectCleanups) cleanup?.();

    states.length = 0;
    stateInitialized.length = 0;
    refs.length = 0;
    memos.length = 0;
    callbacks.length = 0;
    effectDependencies.length = 0;
    effectCleanups.length = 0;
    pendingEffects = [];
    stateVersion = 0;
    mounted = false;
  }

  function renderUntilStable(renderHook, maxRenders = 25) {
    let result;
    for (let renderCount = 0; renderCount < maxRenders; renderCount += 1) {
      const versionBeforeRender = stateVersion;
      result = renderOnce(renderHook);
      if (stateVersion === versionBeforeRender) return result;
    }
    throw new Error(`Hook did not settle after ${maxRenders} renders`);
  }

  return {
    react,
    renderOnce,
    renderUntilStable,
    unmount,
    get mountCount() {
      return mountCount;
    },
  };
}

module.exports = { createHookHarness };
