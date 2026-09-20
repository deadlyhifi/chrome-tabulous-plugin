/**
 * Ambient augmentation for Chrome's native Split View extension API (Chrome 155+), which
 * the pinned `@types/chrome` package does not yet declare. `Tab.splitViewId` merges with
 * the existing interface; `createSplit`/`unsplit` are new members of `chrome.tabs`.
 */
declare namespace chrome.tabs {
  /** The Split View ID used for tabs that aren't part of a Split View. */
  const SPLIT_VIEW_ID_NONE: -1;

  interface Tab {
    /** The ID of the Split View the tab belongs to, or `SPLIT_VIEW_ID_NONE`. */
    splitViewId?: number;
  }

  interface QueryInfo {
    /** Filters to tabs in the given Split View, or `SPLIT_VIEW_ID_NONE` for unsplit tabs. */
    splitViewId?: number;
  }

  interface CreateProperties {
    /** Pairs the newly created tab into a Split View with this existing tab. */
    splitWithTabId?: number;
  }

  /**
   * Pairs two existing, adjacent tabs (matching `windowId`, `pinned`, and `groupId`) into a
   * new Split View. Resolves with the new Split View's ID.
   */
  function createSplit(tabIds: [number, number]): Promise<number>;

  /** Separates the tabs of a Split View back into independent tabs. */
  function unsplit(splitViewId: number): Promise<void>;
}
