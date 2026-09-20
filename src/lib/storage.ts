import { DEFAULT_PREFERENCES } from './types';
import type { Preferences } from './types';

const PREFS_KEY = 'preferences';
const AGES_KEY = 'tabOpenedAt';

export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await chrome.storage.sync.get(PREFS_KEY);
    return { ...DEFAULT_PREFERENCES, ...(stored[PREFS_KEY] as Partial<Preferences> | undefined) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  try {
    await chrome.storage.sync.set({ [PREFS_KEY]: prefs });
  } catch {
    // Sync storage may be full or unavailable; preferences are non-critical.
  }
}

export function onPreferencesChanged(listener: (prefs: Preferences) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ): void => {
    if (area !== 'sync' || !changes[PREFS_KEY]) return;
    listener({ ...DEFAULT_PREFERENCES, ...(changes[PREFS_KEY].newValue as Partial<Preferences>) });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export async function loadTabAges(): Promise<Record<number, number>> {
  const stored = await chrome.storage.local.get(AGES_KEY);
  return (stored[AGES_KEY] as Record<number, number> | undefined) ?? {};
}

export async function saveTabAges(ages: Record<number, number>): Promise<void> {
  await chrome.storage.local.set({ [AGES_KEY]: ages });
}
