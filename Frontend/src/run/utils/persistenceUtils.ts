export type PersistedSceneTheme = "day" | "night";

type ScenePreferences = {
  theme: PersistedSceneTheme;
};

const storageKey = "jevx.scene-preferences";
const changeEvent = "jevx:scene-preferences";
let cachedStoredValue: string | null | undefined;

export const defaultScenePreferences: ScenePreferences = {
  theme: "night",
};

let cachedPreferences = defaultScenePreferences;

export const getScenePreferences = (): ScenePreferences => {
  if (typeof window === "undefined") return defaultScenePreferences;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === cachedStoredValue) return cachedPreferences;

    cachedStoredValue = stored;
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    cachedPreferences =
      typeof parsed === "object" &&
      parsed !== null &&
      "theme" in parsed &&
      (parsed.theme === "day" || parsed.theme === "night")
        ? { theme: parsed.theme }
        : defaultScenePreferences;
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
    // Scene controls still work if the browser blocks storage.
  }
};

