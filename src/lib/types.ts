export type ThemePreference = 'system' | 'light' | 'dark';

/** 'dim' trades some of dark mode's contrast for a lighter, less black backdrop. */
export type DarkVariant = 'darkest' | 'dim' | 'dimmer' | 'dimmest';

/** 'soft' trades some of light mode's contrast for a less stark white backdrop. */
export type LightVariant = 'brightest' | 'soft' | 'softer' | 'softest';

export type Tint = 'blue' | 'purple' | 'pink' | 'orange' | 'green' | 'red' | 'teal';

export type SortKey = 'window' | 'recent' | 'age' | 'title' | 'domain' | 'memory' | 'group';

export interface Preferences {
  theme: ThemePreference;
  darkVariant: DarkVariant;
  lightVariant: LightVariant;
  tint: Tint;
  sortKey: SortKey;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  darkVariant: 'darkest',
  lightVariant: 'brightest',
  tint: 'blue',
  sortKey: 'window',
};

export interface TabGroupInfo {
  id: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
  windowId: number;
}

export interface WindowInfo {
  id: number;
  focused: boolean;
  incognito: boolean;
  state: string | undefined;
  tabCount: number;
}

/** Everything the dashboard needs to render one tile. */
export interface TileModel {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  domain: string;
  favIconUrl: string | undefined;
  active: boolean;
  pinned: boolean;
  audible: boolean;
  muted: boolean;
  discarded: boolean;
  frozen: boolean;
  autoDiscardable: boolean;
  incognito: boolean;
  status: string | undefined;
  openerTabId: number | undefined;
  lastAccessed: number | undefined;
  /** Epoch ms when this tab was first seen by the extension. */
  openedAt: number | undefined;
  group: TabGroupInfo | undefined;
  /** The Split View this tab belongs to, or undefined when it isn't split. */
  splitViewId: number | undefined;
  /** True when this tile represents the dashboard tab itself. */
  isDashboard: boolean;
}

export interface TileSnapshot {
  tiles: TileModel[];
  windows: WindowInfo[];
  groups: Record<number, TabGroupInfo>;
}

export type MemoryAvailability = 'available' | 'unsupported' | 'permission-required';

export interface TabMemory {
  tabId: number;
  privateMemoryBytes: number | undefined;
  cpuPercent: number | undefined;
}

export const NO_GROUP = -1;
export const NO_SPLIT = -1;
