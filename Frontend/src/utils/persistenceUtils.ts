export type PersistedSceneTheme = "day" | "night";
export type PersistedMapView = "isometric" | "plan";

export type ScenePreferences = {
  theme: PersistedSceneTheme;
  view: PersistedMapView;
};

const storageKey = "jevtown.scene-preferences";
const changeEvent = "jevtown:scene-preferences";
let cachedStoredValue: string | null | undefined;
let cachedPreferences: ScenePreferences;

export const defaultScenePreferences: ScenePreferences = {
  theme: "day",
  view: "plan",
};
cachedPreferences = defaultScenePreferences;

const isSceneTheme = (value: unknown): value is PersistedSceneTheme =>
  value === "day" || value === "night";

const isMapView = (value: unknown): value is PersistedMapView =>
  value === "isometric" || value === "plan";

export const loadScenePreferences = (): ScenePreferences | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("theme" in parsed) ||
      !("view" in parsed) ||
      !isSceneTheme(parsed.theme) ||
      !isMapView(parsed.view)
    ) {
      return null;
    }

    return { theme: parsed.theme, view: parsed.view };
  } catch {
    return null;
  }
};

export const getScenePreferences = (): ScenePreferences => {
  if (typeof window === "undefined") return defaultScenePreferences;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === cachedStoredValue) return cachedPreferences;

    cachedStoredValue = stored;
    cachedPreferences = loadScenePreferences() ?? defaultScenePreferences;
    return cachedPreferences;
  } catch {
    return defaultScenePreferences;
  }
};

export const subscribeToScenePreferences = (onStoreChange: () => void) => {
  window.addEventListener(changeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(changeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

export const saveScenePreferences = (preferences: ScenePreferences) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    // Storage can be disabled by the browser; scene controls still work.
  }
};
