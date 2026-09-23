function resolveFallback(fallback) {
  return typeof fallback === "function" ? fallback() : fallback;
}

function getStorage(storage) {
  return storage ?? globalThis.localStorage;
}

export function loadJson(key, fallback = null, options = {}) {
  const { storage, validate, migrate } = options;
  try {
    const raw = getStorage(storage).getItem(key);
    if (raw === null) return resolveFallback(fallback);
    let value = JSON.parse(raw);
    if (migrate) value = migrate(value);
    if (validate && !validate(value)) return resolveFallback(fallback);
    return value;
  } catch {
    return resolveFallback(fallback);
  }
}

export function saveJson(key, value, options = {}) {
  try {
    getStorage(options.storage).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key, options = {}) {
  try {
    getStorage(options.storage).removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function loadDatedState(key, dateKey, options = {}) {
  const { isDaily = (state) => state?.mode === "daily", ...loadOptions } = options;
  const state = loadJson(key, null, loadOptions);
  if (!state) return null;
  if (isDaily(state) && state.dateKey !== dateKey) return null;
  return state;
}
