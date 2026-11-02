import type { ForestView } from "@/game/forest/types";

const storageKey = "jevtown.forest-view";
const changeEvent = "jevtown:forest-view";
const defaultForestView: ForestView = "isometric";
let cachedStoredValue: string | null | undefined;
let cachedView: ForestView = defaultForestView;

export const getForestView = (): ForestView => {
  if (typeof window === "undefined") return defaultForestView;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === cachedStoredValue) return cachedView;

    cachedStoredValue = stored;
    cachedView = stored === "plan" ? "plan" : defaultForestView;
    return cachedView;
  } catch {
    return defaultForestView;
  }
};

export const subscribeToForestView = (onStoreChange: () => void) => {
  window.addEventListener(changeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(changeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

export const saveForestView = (view: ForestView) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, view);
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    // Storage can be disabled by the browser; the next render still reflects the click.
  }
};
