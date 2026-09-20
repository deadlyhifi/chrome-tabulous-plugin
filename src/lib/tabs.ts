import { NO_GROUP, NO_SPLIT } from './types';
import type { TabGroupInfo, TileModel, TileSnapshot, WindowInfo } from './types';

const DASHBOARD_PATH = 'src/dashboard/index.html';

export function dashboardUrl(): string {
  return chrome.runtime.getURL(DASHBOARD_PATH);
}

export function isDashboardTab(tab: chrome.tabs.Tab): boolean {
  return (tab.url ?? '').startsWith(dashboardUrl());
}

export function domainOf(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:') {
      return parsed.protocol.replace(':', '') + '://' + parsed.hostname;
    }
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Chrome exposes `frozen` only on newer releases, so it is read defensively.
 */
function readFrozen(tab: chrome.tabs.Tab): boolean {
  return (tab as chrome.tabs.Tab & { frozen?: boolean }).frozen === true;
}

export function toTileModel(
  tab: chrome.tabs.Tab,
  groups: Record<number, TabGroupInfo>,
  openedAt: number | undefined,
): TileModel | undefined {
  if (tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) return undefined;
  const groupId = tab.groupId ?? NO_GROUP;
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title?.trim() || domainOf(tab.url) || 'Untitled',
    url: tab.url ?? tab.pendingUrl ?? '',
    domain: domainOf(tab.url ?? tab.pendingUrl),
    favIconUrl: tab.favIconUrl,
    active: tab.active,
    pinned: tab.pinned,
    audible: tab.audible === true,
    muted: tab.mutedInfo?.muted === true,
    discarded: tab.discarded === true,
    frozen: readFrozen(tab),
    autoDiscardable: tab.autoDiscardable !== false,
    incognito: tab.incognito,
    status: tab.status,
    openerTabId: tab.openerTabId,
    lastAccessed: (tab as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed,
    openedAt,
    group: groupId === NO_GROUP ? undefined : groups[groupId],
    splitViewId:
      tab.splitViewId === undefined || tab.splitViewId === NO_SPLIT ? undefined : tab.splitViewId,
    isDashboard: isDashboardTab(tab),
  };
}

export async function collectGroups(): Promise<Record<number, TabGroupInfo>> {
  const groups: Record<number, TabGroupInfo> = {};
  if (!chrome.tabGroups) return groups;
  try {
    const found = await chrome.tabGroups.query({});
    for (const group of found) {
      groups[group.id] = {
        id: group.id,
        title: group.title?.trim() || 'Group',
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      };
    }
  } catch {
    // tabGroups is unavailable in some contexts; treat as "no groups".
  }
  return groups;
}

export async function collectSnapshot(openedAtMap: Record<number, number>): Promise<TileSnapshot> {
  const [tabs, windows, groups] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ populate: false }),
    collectGroups(),
  ]);

  const tiles: TileModel[] = [];
  for (const tab of tabs) {
    const tile = toTileModel(tab, groups, tab.id === undefined ? undefined : openedAtMap[tab.id]);
    if (tile) tiles.push(tile);
  }

  const tabCounts = new Map<number, number>();
  for (const tile of tiles) {
    tabCounts.set(tile.windowId, (tabCounts.get(tile.windowId) ?? 0) + 1);
  }

  const windowInfos: WindowInfo[] = windows
    .filter((win) => win.id !== undefined && win.type === 'normal')
    .map((win) => ({
      id: win.id as number,
      focused: win.focused,
      incognito: win.incognito,
      state: win.state,
      tabCount: tabCounts.get(win.id as number) ?? 0,
    }));

  // Include any window that owns tabs but was filtered out (e.g. popup windows).
  for (const [windowId, count] of tabCounts) {
    if (!windowInfos.some((win) => win.id === windowId)) {
      windowInfos.push({
        id: windowId,
        focused: false,
        incognito: tiles.find((tile) => tile.windowId === windowId)?.incognito ?? false,
        state: undefined,
        tabCount: count,
      });
    }
  }

  return { tiles, windows: windowInfos, groups };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function formatAbsolute(epochMs: number | undefined): string {
  if (epochMs === undefined) return '—';
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
