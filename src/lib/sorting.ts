import type { Preferences, SortKey, TabMemory, TileModel } from './types';

export function matchesFilter(tile: TileModel, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    tile.title.toLowerCase().includes(needle) ||
    tile.url.toLowerCase().includes(needle) ||
    (tile.group?.title.toLowerCase().includes(needle) ?? false)
  );
}

function compareBy(
  key: SortKey,
  a: TileModel,
  b: TileModel,
  memory: Map<number, TabMemory>,
): number {
  switch (key) {
    case 'window':
      return a.windowId - b.windowId || a.index - b.index;
    case 'recent':
      // Most recently used first.
      return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0);
    case 'age':
      // Oldest tab first.
      return (a.openedAt ?? Number.MAX_SAFE_INTEGER) - (b.openedAt ?? Number.MAX_SAFE_INTEGER);
    case 'title':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'domain':
      return (
        a.domain.localeCompare(b.domain, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
    case 'group': {
      const aTitle = a.group?.title ?? '';
      const bTitle = b.group?.title ?? '';
      if (!aTitle && bTitle) return 1;
      if (aTitle && !bTitle) return -1;
      return aTitle.localeCompare(bTitle, undefined, { sensitivity: 'base' }) || a.index - b.index;
    }
    case 'memory': {
      const aBytes = memory.get(a.id)?.privateMemoryBytes;
      const bBytes = memory.get(b.id)?.privateMemoryBytes;
      if (aBytes === undefined && bBytes === undefined) return a.index - b.index;
      if (aBytes === undefined) return 1;
      if (bBytes === undefined) return -1;
      // Heaviest first.
      return bBytes - aBytes;
    }
    default:
      return 0;
  }
}

export function sortTiles(
  tiles: TileModel[],
  prefs: Preferences,
  memory: Map<number, TabMemory>,
): TileModel[] {
  return [...tiles].sort((a, b) => {
    // Pinned tabs stay at the front in native window order only.
    if (prefs.sortKey === 'window' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const result = compareBy(prefs.sortKey, a, b, memory);
    return result === 0 ? a.id - b.id : result;
  });
}

/** True when the chosen sort implies the tab order is no longer the window's real order. */
export function isReorderable(prefs: Preferences): boolean {
  return prefs.sortKey === 'window';
}
