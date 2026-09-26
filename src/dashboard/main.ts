import { requestCaptureNow, requestTabAges } from '../lib/messages';
import { memoryAvailability, readTabMemory, requestMemoryPermission } from '../lib/memory';
import { isReorderable, matchesFilter, sortTiles } from '../lib/sorting';
import { loadPreferences, onPreferencesChanged, savePreferences } from '../lib/storage';
import { collectSnapshot } from '../lib/tabs';
import { getAllThumbnails } from '../lib/thumbnail-store';
import { NO_GROUP, DEFAULT_PREFERENCES } from '../lib/types';
import type {
  DarkVariant,
  LightVariant,
  MemoryAvailability,
  Preferences,
  SortKey,
  TabGroupInfo,
  TabMemory,
  Tint,
  TileModel,
  TileSnapshot,
} from '../lib/types';
import {
  GROUP_COLORS,
  ICON_SPLIT,
  ICON_SWAP,
  ICON_UNSPLIT,
  SUPPORTS_ANCHOR,
  buildDetails,
  detailsPopoverId,
  faviconUrl,
  isSplitViewSupported,
  positionWithoutAnchor,
  renderTile,
  withIconFallback,
} from './tile';

const board = document.getElementById('board') as HTMLElement;
const emptyState = document.getElementById('empty') as HTMLElement;
const tabCountLabel = document.getElementById('tab-count') as HTMLElement;
const filterInput = document.getElementById('filter') as HTMLInputElement;
const sortKeySelect = document.getElementById('sort-key') as HTMLSelectElement;
const themeSelect = document.getElementById('theme') as HTMLSelectElement;
const appearanceButton = document.getElementById('appearance-settings') as HTMLButtonElement;
const appearancePopover = document.getElementById('appearance-options') as HTMLElement;
const lightVariantField = document.getElementById('light-variant-field') as HTMLElement;
const lightVariantSelect = document.getElementById('light-variant') as HTMLSelectElement;
const darkVariantField = document.getElementById('dark-variant-field') as HTMLElement;
const darkVariantSelect = document.getElementById('dark-variant') as HTMLSelectElement;
const tintSelect = document.getElementById('tint') as HTMLSelectElement;
const bulkBar = document.getElementById('bulk-bar') as HTMLElement;
const bulkCount = document.getElementById('bulk-count') as HTMLElement;
const bulkSplitButton = document.getElementById('bulk-split') as HTMLButtonElement;
const bulkNewWindowButton = document.getElementById('bulk-new-window') as HTMLButtonElement;
const permissionBar = document.getElementById('permission-bar') as HTMLElement;
const permissionText = document.getElementById('permission-text') as HTMLElement;
const permissionGrant = document.getElementById('permission-grant') as HTMLButtonElement;
const permissionDismiss = document.getElementById('permission-dismiss') as HTMLButtonElement;
const shortcutSettings = document.getElementById('shortcut-settings') as HTMLButtonElement;
const shortcutHelpKey = document.getElementById('shortcut-help__key') as HTMLElement;
const pinViewButton = document.getElementById('pin-view') as HTMLButtonElement;

interface State {
  prefs: Preferences;
  snapshot: TileSnapshot;
  thumbnails: Map<number, string>;
  memory: Map<number, TabMemory>;
  memoryState: MemoryAvailability;
  filter: string;
  selected: Set<number>;
  expandedId: number | undefined;
  expandedEl: HTMLElement | undefined;
  lastClickedId: number | undefined;
  collapsedWindows: Set<number>;
  windowDefaultsApplied: Set<number>;
}

const state: State = {
  prefs: { ...DEFAULT_PREFERENCES },
  snapshot: { tiles: [], windows: [], groups: {} },
  thumbnails: new Map(),
  memory: new Map(),
  memoryState: 'unsupported',
  filter: '',
  selected: new Set(),
  expandedId: undefined,
  expandedEl: undefined,
  lastClickedId: undefined,
  collapsedWindows: new Set(),
  windowDefaultsApplied: new Set(),
};

let currentWindowId: number | undefined;
let memoryTimer: ReturnType<typeof setInterval> | undefined;
let refreshHandle: ReturnType<typeof setTimeout> | undefined;

/* ---------------- Data ---------------- */

async function showShortcut(): Promise<void> {
  const command = (await chrome.commands.getAll()).find((item) => item.name === 'open-tiles-view');
  const shortcut = command?.shortcut || 'Not assigned';
  shortcutSettings.textContent = shortcut;
  shortcutSettings.title =
    'Open keyboard shortcut help. Chrome only allows changing extension shortcuts at chrome://extensions/shortcuts.';
  shortcutHelpKey.textContent = shortcut;
}

/** Reflects whether the Tabulous tab itself is pinned in Chrome's real tab strip. */
async function syncPinButton(): Promise<void> {
  const tab = await chrome.tabs.getCurrent();
  if (!tab) return;
  const pinned = tab.pinned ?? false;
  pinViewButton.setAttribute('aria-pressed', String(pinned));
  const label = pinned ? 'Unpin this Tabulous tab' : 'Pin this Tabulous tab';
  pinViewButton.setAttribute('aria-label', label);
  pinViewButton.title = label;
}

pinViewButton.addEventListener('click', () => {
  void (async () => {
    const tab = await chrome.tabs.getCurrent();
    if (!tab?.id) return;
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    await syncPinButton();
  })();
});

async function loadThumbnails(): Promise<void> {
  const records = await getAllThumbnails();
  const next = new Map<number, string>();
  for (const [tabId, record] of records) {
    const tile = state.snapshot.tiles.find((candidate) => candidate.id === tabId);
    // Only show a capture that still matches what the tab is displaying.
    if (!tile || tile.url !== record.url) continue;
    const existing = state.thumbnails.get(tabId);
    next.set(tabId, existing ?? URL.createObjectURL(record.blob));
  }
  for (const [tabId, url] of state.thumbnails) {
    if (!next.has(tabId)) URL.revokeObjectURL(url);
  }
  state.thumbnails = next;
}

async function refresh(): Promise<void> {
  const ages = await requestTabAges();
  state.snapshot = await collectSnapshot(ages);
  await loadThumbnails();
  render();
  void syncPinButton();
}

function scheduleRefresh(): void {
  if (refreshHandle) clearTimeout(refreshHandle);
  refreshHandle = setTimeout(() => {
    refreshHandle = undefined;
    void refresh();
  }, 80);
}

/* ---------------- Rendering ---------------- */

function visibleTiles(): TileModel[] {
  return state.snapshot.tiles.filter((tile) => matchesFilter(tile, state.filter));
}

function contextFor(tile: TileModel, tilesById: Map<number, TileModel>, draggable: boolean) {
  return {
    thumbnailUrl: state.thumbnails.get(tile.id),
    memory: state.memory.get(tile.id),
    memoryAvailability: state.memoryState,
    selected: state.selected.has(tile.id),
    draggable,
    tilesById,
    onDetailsToggle: handleDetailsToggle,
  };
}

function buildGrid(
  tiles: TileModel[],
  windowId: number | undefined,
  groupId?: number,
  newTabTarget?: number,
): HTMLUListElement {
  const grid = document.createElement('ul');
  grid.className = 'grid';
  grid.setAttribute('role', 'list');
  if (windowId !== undefined) grid.dataset.windowId = String(windowId);
  if (groupId !== undefined) grid.dataset.groupId = String(groupId);

  const tilesById = new Map(state.snapshot.tiles.map((tile) => [tile.id, tile]));
  const draggable = isReorderable(state.prefs);

  appendTilesWithSplitPairs(grid, tiles, tilesById, draggable);
  if (newTabTarget !== undefined) grid.append(buildNewTabTile(newTabTarget));
  return grid;
}

/**
 * A permanent, non-reorderable tile pinned to the end of a window's grid that opens a
 * fresh new tab in that window. Deliberately uses its own class (not `.tile`) so it is
 * excluded from every generic tile selector used for drag-and-drop, selection, and
 * sort/reorder logic elsewhere in this file — it always stays last regardless of sort
 * key and can never be dragged or dropped on.
 */
function buildNewTabTile(windowId: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'new-tab-tile';
  item.dataset.windowId = String(windowId);
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', 'Open a new tab');
  item.title = 'Open a new tab';
  item.draggable = false;

  const preview = document.createElement('div');
  preview.className = 'new-tab-tile__preview';
  const icon = document.createElement('span');
  icon.className = 'new-tab-tile__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '+';
  preview.append(icon);

  const body = document.createElement('div');
  body.className = 'new-tab-tile__body';
  const label = document.createElement('span');
  label.className = 'new-tab-tile__label';
  label.textContent = 'New tab';
  body.append(label);

  item.append(preview, body);

  const open = (): void => {
    void chrome.tabs.create({ windowId }).catch((error) => {
      console.warn('Could not open a new tab', error);
    });
  };
  item.addEventListener('click', open);
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  return item;
}

/**
 * Renders `tiles` in order, combining any two that share a Split View into a single
 * `.split-tile` (positioned where the first-encountered tab of the pair would have gone)
 * instead of two ordinary tiles.
 */
function appendTilesWithSplitPairs(
  grid: HTMLElement,
  tiles: TileModel[],
  tilesById: Map<number, TileModel>,
  draggable: boolean,
): void {
  const rendered = new Set<number>();
  for (const tile of tiles) {
    if (rendered.has(tile.id)) continue;
    if (tile.splitViewId !== undefined) {
      const partner = tiles.find(
        (candidate) => candidate.id !== tile.id && candidate.splitViewId === tile.splitViewId,
      );
      if (partner) {
        rendered.add(tile.id);
        rendered.add(partner.id);
        grid.append(buildSplitTile(tile, partner, draggable));
        continue;
      }
    }
    rendered.add(tile.id);
    grid.append(renderTile(tile, contextFor(tile, tilesById, draggable)));
  }
}

/**
 * Combines two Split View tabs into one tile so they read as a single unit alongside
 * regular tiles, with controls to swap which side each tab is on or unsplit them.
 */
function buildSplitTile(a: TileModel, b: TileModel, draggable: boolean): HTMLLIElement {
  const anchor = a.index <= b.index ? a : b;
  const item = document.createElement('li');
  item.className = 'split-tile';
  item.dataset.tabIds = `${a.id},${b.id}`;
  item.dataset.anchorTabId = String(anchor.id);
  item.dataset.windowId = String(a.windowId);
  item.tabIndex = 0;
  item.setAttribute('role', 'group');
  item.setAttribute('aria-label', `Split view of ${a.title} and ${b.title}`);
  item.draggable = draggable;
  if (draggable) item.title = 'Drag to reorder';

  const panes = document.createElement('div');
  panes.className = 'split-tile__panes';
  panes.append(buildSplitPane(a), buildSplitPane(b));
  item.append(panes);

  const body = document.createElement('div');
  body.className = 'split-tile__body';

  const icon = document.createElement('span');
  icon.className = 'split-tile__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = ICON_SPLIT;
  const label = document.createElement('span');
  label.className = 'split-tile__label';
  label.textContent = 'Split view';
  body.append(icon, label);

  const swap = document.createElement('button');
  swap.type = 'button';
  swap.className = 'split-tile__action';
  swap.dataset.action = 'swap-split';
  swap.dataset.tabA = String(a.id);
  swap.dataset.tabB = String(b.id);
  swap.title = 'Swap sides';
  swap.setAttribute('aria-label', 'Swap split view sides');
  swap.innerHTML = ICON_SWAP;
  body.append(swap);

  const unsplit = document.createElement('button');
  unsplit.type = 'button';
  unsplit.className = 'split-tile__action';
  unsplit.dataset.action = 'unsplit';
  unsplit.dataset.splitViewId = String(a.splitViewId);
  unsplit.setAttribute('aria-label', 'Separate split view into two tabs');
  unsplit.innerHTML = ICON_UNSPLIT;
  // Chrome may report an already-linked pair before it ships the API to unsplit it.
  if (isSplitViewSupported()) {
    unsplit.title = 'Unsplit';
  } else {
    unsplit.disabled = true;
    unsplit.title = 'Unsplit requires a newer Chrome version';
  }
  body.append(unsplit);

  item.append(body);
  return item;
}

/** One side of a combined split tile; clicking it activates that specific tab. */
function buildSplitPane(tile: TileModel): HTMLButtonElement {
  const pane = document.createElement('button');
  pane.type = 'button';
  pane.className = 'split-tile__pane';
  pane.dataset.action = 'activate-split-pane';
  pane.dataset.tabId = String(tile.id);
  pane.dataset.windowId = String(tile.windowId);
  pane.dataset.active = String(tile.active);
  pane.title = tile.title;
  pane.setAttribute('aria-label', `Go to ${tile.title}`);

  const thumbnailUrl = state.thumbnails.get(tile.id);
  if (thumbnailUrl) {
    const img = document.createElement('img');
    img.className = 'split-tile__thumbnail';
    img.src = thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    pane.append(img);
  } else {
    const icon = document.createElement('img');
    icon.className = 'split-tile__favicon';
    icon.src = faviconUrl(tile);
    icon.alt = '';
    withIconFallback(icon);
    pane.append(icon);
  }

  const label = document.createElement('span');
  label.className = 'split-tile__pane-title';
  label.textContent = tile.title;
  pane.append(label);
  return pane;
}

/** A compact group tile keeps groups visible in the main tab grid without duplicating tabs. */
function buildGroupTile(info: TabGroupInfo, tiles: TileModel[], windowId: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'group-tile';
  item.dataset.groupId = String(info.id);
  item.dataset.windowId = String(windowId);
  item.style.setProperty('--group-color', GROUP_COLORS[info.color] ?? 'var(--group-grey)');
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Open ${info.title} group with ${tiles.length} tabs`);
  item.draggable = isReorderable(state.prefs);
  if (item.draggable) item.title = 'Click to view group. Drag to reorder group.';

  const preview = document.createElement('div');
  preview.className = 'group-tile__preview';
  const dot = document.createElement('span');
  dot.className = 'group-tile__dot';
  const title = document.createElement('strong');
  title.className = 'group-tile__title';
  title.textContent = info.title;
  const squares = buildGroupTabSquares(tiles.length);
  const toggle = buildGroupCollapseButton(info.id, info.title, info.collapsed);
  toggle.classList.add('group-tile__collapse');
  const details = document.createElement('div');
  details.className = 'group-tile__details';
  details.append(dot, title, squares);
  preview.append(details, toggle);

  const body = document.createElement('div');
  body.className = 'group-tile__body';
  const dropZone = document.createElement('div');
  dropZone.className = 'group-tile__drop';
  dropZone.textContent = 'Drop tabs into group';
  body.append(dropZone);
  item.append(preview, body);
  return item;
}

/**
 * A group's tiles render in their own droppable section, distinct from the window's
 * ungrouped grid, so tabs can be dragged into and out of a group by targeting either area.
 */
function buildGroupSection(info: TabGroupInfo, tiles: TileModel[], windowId: number): HTMLElement {
  const section = document.createElement('section');
  section.className = 'group-section';
  section.dataset.groupId = String(info.id);
  section.id = `tab-group-${info.id}`;
  section.style.setProperty('--group-color', GROUP_COLORS[info.color] ?? 'var(--group-grey)');

  const header = document.createElement('div');
  header.className = 'group-section__header';
  if (isReorderable(state.prefs)) {
    header.draggable = true;
    header.dataset.groupId = String(info.id);
    header.dataset.windowId = String(windowId);
    header.title = 'Drag to reorder group';
  }

  header.append(buildGroupColorPicker(info));

  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'group-section__title';
  title.dataset.action = 'rename-group';
  title.dataset.groupId = String(info.id);
  title.title = 'Rename group';
  title.setAttribute('aria-label', `Rename group ${info.title}`);
  title.textContent = info.title;
  header.append(title);

  const meta = document.createElement('span');
  meta.className = 'group-section__meta';
  meta.textContent = `${tiles.length} tab${tiles.length === 1 ? '' : 's'}`;
  header.append(meta);

  const moveButton = document.createElement('button');
  moveButton.type = 'button';
  moveButton.className = 'collapse-button';
  moveButton.dataset.action = 'move-group-to-new-window';
  moveButton.dataset.groupId = String(info.id);
  moveButton.setAttribute('aria-label', `Move group ${info.title} to a new window`);
  moveButton.title = 'Move group to a new window';
  moveButton.textContent = 'New window';
  header.append(moveButton);

  header.append(buildGroupCollapseButton(info.id, info.title, info.collapsed));
  // The button only toggles Chrome's real tab group; the dashboard's own section always
  // stays visible so the group can still be managed here regardless of collapsed state.
  const grid = buildGrid(tiles, windowId, info.id);
  section.append(header, grid);
  return section;
}

let colorPopoverSequence = 0;

/**
 * A single control that both shows the group's current color (as a dot) and opens a
 * popover to change it. Each option in the popover shows its own colored dot in front of
 * the color name, which a native `<select>`'s options cannot do cross-browser.
 */
function buildGroupColorPicker(info: TabGroupInfo): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'group-color-picker';

  const popoverId = `group-color-popover-${info.id}-${(colorPopoverSequence += 1)}`;
  const anchorName = `--group-color-${info.id}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'group-color-picker__dot';
  button.style.setProperty('--group-color', GROUP_COLORS[info.color] ?? 'var(--group-grey)');
  button.setAttribute('popovertarget', popoverId);
  button.setAttribute('aria-label', `Change color for group ${info.title}`);
  button.title = 'Change group color';

  const popover = document.createElement('div');
  popover.id = popoverId;
  popover.className = 'group-color-popover';
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('aria-label', `Choose color for group ${info.title}`);

  if (SUPPORTS_ANCHOR) {
    button.style.setProperty('anchor-name', anchorName);
    popover.style.setProperty('position-anchor', anchorName);
  }
  popover.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState !== 'open') return;
    if (!SUPPORTS_ANCHOR) positionWithoutAnchor(popover, button);
  });

  for (const color of Object.keys(GROUP_COLORS) as chrome.tabGroups.ColorEnum[]) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'group-color-popover__item';
    item.dataset.action = 'change-group-color';
    item.dataset.groupId = String(info.id);
    item.dataset.color = color;
    item.setAttribute('popovertarget', popoverId);
    item.setAttribute('popovertargetaction', 'hide');
    if (color === info.color) item.setAttribute('aria-current', 'true');

    const swatch = document.createElement('span');
    swatch.className = 'group-color-popover__swatch';
    swatch.style.setProperty('--group-color', GROUP_COLORS[color] ?? 'var(--group-grey)');
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = `${color[0]?.toUpperCase()}${color.slice(1)}`;
    item.append(swatch, label);
    popover.append(item);
  }

  wrap.append(button, popover);
  return wrap;
}

/**
 * Renders one small square per tab in the group so the count is visible at a glance,
 * without relying on reading a number. Caps the squares shown for very large groups and
 * folds the remainder into a "+N" label to keep the row from overflowing the tile.
 */
function buildGroupTabSquares(tabCount: number): HTMLElement {
  const MAX_SQUARES = 24;
  const wrap = document.createElement('span');
  wrap.className = 'group-tile__squares';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.setProperty('--group-square-size', `${squareSizeFor(tabCount)}px`);
  const shown = Math.min(tabCount, MAX_SQUARES);
  for (let index = 0; index < shown; index += 1) {
    const square = document.createElement('span');
    square.className = 'group-tile__square';
    wrap.append(square);
  }
  if (tabCount > MAX_SQUARES) {
    const overflow = document.createElement('span');
    overflow.className = 'group-tile__square-overflow';
    overflow.textContent = `+${tabCount - MAX_SQUARES}`;
    wrap.append(overflow);
  }
  return wrap;
}

/**
 * Squares start large (about 4x the original indicator size) and only shrink once there
 * are too many of them to comfortably fit on one tile, so small groups stay easy to read.
 */
function squareSizeFor(tabCount: number): number {
  if (tabCount <= 6) return 28;
  if (tabCount <= 10) return 22;
  if (tabCount <= 16) return 17;
  return 13;
}

/**
 * Reflects and toggles Chrome's own collapsed state for the tab group, so collapsing here
 * also collapses the group in the browser's real tab strip (and vice versa).
 */
function buildGroupCollapseButton(
  groupId: number,
  title: string,
  collapsed: boolean,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'collapse-button';
  button.dataset.action = 'toggle-group-collapse';
  button.dataset.groupId = String(groupId);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} group ${title}`);
  button.title = `${collapsed ? 'Expand' : 'Collapse'} group`;
  button.textContent = collapsed ? 'Expand' : 'Collapse';
  return button;
}

/**
 * Turns a group title into an inline text input. Committing an empty value or the same
 * value leaves the group's name untouched.
 */
function beginGroupRename(trigger: HTMLElement): void {
  const groupId = Number(trigger.dataset.groupId);
  if (!Number.isFinite(groupId)) return;
  const header = trigger.closest<HTMLElement>('.group-section__header');
  if (!header || header.querySelector('input')) return;

  const current = trigger.textContent ?? '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'group-section__rename-input';
  input.value = current;
  input.setAttribute('aria-label', 'Group name');
  trigger.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  const commit = (): void => {
    if (committed) return;
    committed = true;
    const value = input.value.trim();
    input.replaceWith(trigger);
    if (value && value !== current) {
      void chrome.tabGroups
        .update(groupId, { title: value })
        .then(() => scheduleRefresh())
        .catch((error) => console.warn('Could not rename group', error));
    }
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      input.value = current;
      input.blur();
    }
  });
  input.addEventListener('blur', commit, { once: true });
  input.addEventListener('click', (event) => event.stopPropagation());
}

/**
 * Popovers are recreated on every render, so stale close events from discarded
 * elements are ignored by comparing element identity.
 */
function handleDetailsToggle(tabId: number, popover: HTMLElement, open: boolean): void {
  if (open) {
    state.expandedId = tabId;
    state.expandedEl = popover;
  } else if (state.expandedEl === popover) {
    state.expandedId = undefined;
    state.expandedEl = undefined;
  }
}

/**
 * A visual indicator only — the whole header is the clickable control (see the header's
 * own `data-action="toggle-window-collapse"`), so this stays a non-interactive span to
 * avoid nesting a real button inside a `role="button"` element.
 */
function buildWindowCollapseIndicator(collapsed: boolean): HTMLSpanElement {
  const indicator = document.createElement('span');
  indicator.className = 'collapse-button';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = collapsed ? 'Expand' : 'Collapse';
  return indicator;
}

function windowLabel(windowId: number, incognito: boolean, focused: boolean): string {
  if (windowId === currentWindowId) return 'This window';
  const parts = [`Window ${windowId}`];
  if (incognito) parts.push('Incognito');
  if (focused) parts.push('Focused');
  return parts.join(' · ');
}

function render(): void {
  const scrollY = window.scrollY;
  board.textContent = '';
  board.dataset.selecting = String(state.selected.size > 0);

  const tiles = sortTiles(visibleTiles(), state.prefs, state.memory);
  const total = state.snapshot.tiles.length;
  const groupCount = Object.keys(state.snapshot.groups).length;
  const groupSuffix = groupCount > 0 ? ` · ${groupCount} group${groupCount === 1 ? '' : 's'}` : '';
  tabCountLabel.textContent =
    tiles.length === total
      ? `${total} tab${total === 1 ? '' : 's'} · ${state.snapshot.windows.length} window${
          state.snapshot.windows.length === 1 ? '' : 's'
        }${groupSuffix}`
      : `${tiles.length} of ${total} tabs`;

  emptyState.hidden = tiles.length > 0;

  const byWindow = new Map<number, TileModel[]>();
  for (const tile of tiles) {
    const bucket = byWindow.get(tile.windowId);
    if (bucket) bucket.push(tile);
    else byWindow.set(tile.windowId, [tile]);
  }

  const orderedWindows = [...byWindow.keys()].sort((a, b) => {
    if (a === currentWindowId) return -1;
    if (b === currentWindowId) return 1;
    return a - b;
  });

  for (const windowId of orderedWindows) {
    if (!state.windowDefaultsApplied.has(windowId)) {
      state.windowDefaultsApplied.add(windowId);
      // Only the current window starts open; other windows are collapsed by default so
      // the board isn't overwhelmed when several windows are open at once.
      if (orderedWindows.length > 1 && windowId !== currentWindowId) {
        state.collapsedWindows.add(windowId);
      }
    }

    const info = state.snapshot.windows.find((win) => win.id === windowId);
    const windowTiles = byWindow.get(windowId) ?? [];
    const collapsed = state.collapsedWindows.has(windowId);
    const section = document.createElement('section');
    section.className = 'window-section';
    section.dataset.windowId = String(windowId);
    section.dataset.collapsed = String(collapsed);

    const label = windowLabel(windowId, info?.incognito ?? false, info?.focused ?? false);
    const header = document.createElement('div');
    header.className = 'window-section__header';
    header.dataset.action = 'toggle-window-collapse';
    header.dataset.windowId = String(windowId);
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', String(!collapsed));
    header.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${label}`);
    header.title = `${collapsed ? 'Expand' : 'Collapse'} window`;
    const title = document.createElement('h2');
    title.className = 'window-section__title';
    title.textContent = label;
    const meta = document.createElement('span');
    meta.className = 'window-section__meta';
    meta.textContent = `${windowTiles.length} tab${windowTiles.length === 1 ? '' : 's'}`;
    header.append(title, meta, buildWindowCollapseIndicator(collapsed));
    section.append(header);

    if (collapsed) {
      board.append(section);
      continue;
    }

    // Tabs in a group render inside their own droppable section rather than mixed into
    // the window's flat grid, so a group is a distinct drag target both to join and leave.
    const ungroupedTiles: TileModel[] = [];
    const groupOrder: number[] = [];
    const groupedTiles = new Map<number, TileModel[]>();
    for (const tile of windowTiles) {
      if (tile.group) {
        if (!groupedTiles.has(tile.group.id)) {
          groupedTiles.set(tile.group.id, []);
          groupOrder.push(tile.group.id);
        }
        groupedTiles.get(tile.group.id)?.push(tile);
      } else {
        ungroupedTiles.push(tile);
      }
    }

    if (groupOrder.length > 0) {
      const mainGrid = buildGrid([], windowId, NO_GROUP);
      const tilesById = new Map(state.snapshot.tiles.map((tile) => [tile.id, tile]));
      const renderedGroups = new Set<number>();
      const renderedTiles = new Set<number>();
      for (const tile of windowTiles) {
        if (renderedTiles.has(tile.id)) continue;
        if (!tile.group) {
          if (tile.splitViewId !== undefined) {
            const partner = ungroupedTiles.find(
              (candidate) => candidate.id !== tile.id && candidate.splitViewId === tile.splitViewId,
            );
            if (partner) {
              renderedTiles.add(tile.id);
              renderedTiles.add(partner.id);
              mainGrid.append(buildSplitTile(tile, partner, isReorderable(state.prefs)));
              continue;
            }
          }
          renderedTiles.add(tile.id);
          mainGrid.append(
            renderTile(tile, contextFor(tile, tilesById, isReorderable(state.prefs))),
          );
          continue;
        }
        if (renderedGroups.has(tile.group.id)) continue;
        const groupInfo = state.snapshot.groups[tile.group.id];
        if (!groupInfo) continue;
        renderedGroups.add(tile.group.id);
        mainGrid.append(buildGroupTile(groupInfo, groupedTiles.get(tile.group.id) ?? [], windowId));
      }
      mainGrid.append(buildNewTabTile(windowId));
      section.append(mainGrid);
      for (const groupId of groupOrder) {
        const groupInfo = state.snapshot.groups[groupId];
        if (!groupInfo) continue;
        section.append(buildGroupSection(groupInfo, groupedTiles.get(groupId) ?? [], windowId));
      }
    } else {
      section.append(buildGrid(windowTiles, windowId, undefined, windowId));
    }

    board.append(section);
  }

  renderBulkBar();
  restoreOpenDetails();
  window.scrollTo({ top: scrollY });
}

/** Re-renders destroy the popover element, so reopen it against the fresh tile. */
function restoreOpenDetails(): void {
  const tabId = state.expandedId;
  if (tabId === undefined) return;
  const popover = board.querySelector<HTMLElement>(`#${CSS.escape(detailsPopoverId(tabId))}`);
  if (!popover) {
    state.expandedId = undefined;
    state.expandedEl = undefined;
    return;
  }
  state.expandedEl = popover;
  try {
    popover.showPopover();
  } catch {
    // The popover may already be open, or the element may have been replaced mid-render.
  }
}

function renderBulkBar(): void {
  const count = state.selected.size;
  bulkBar.hidden = count === 0;
  bulkCount.textContent = `${count} selected`;
  bulkSplitButton.hidden = !(count === 2 && isSplitViewSupported());
}

/* ---------------- Preferences ---------------- */

// System OS scheme, needed only to resolve whether "System" theme currently renders dark.
const prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');

function isEffectivelyDark(prefs: Preferences): boolean {
  return prefs.theme === 'dark' || (prefs.theme === 'system' && prefersDarkMedia.matches);
}

if (SUPPORTS_ANCHOR) {
  appearanceButton.style.setProperty('anchor-name', '--appearance-anchor');
  appearancePopover.style.setProperty('position-anchor', '--appearance-anchor');
}
appearancePopover.addEventListener('beforetoggle', (event) => {
  if ((event as ToggleEvent).newState !== 'open') return;
  if (!SUPPORTS_ANCHOR) positionWithoutAnchor(appearancePopover, appearanceButton);
});
prefersDarkMedia.addEventListener('change', () => {
  const dark = isEffectivelyDark(state.prefs);
  darkVariantField.hidden = !dark;
  lightVariantField.hidden = dark;
});

function applyPreferences(prefs: Preferences): void {
  state.prefs = prefs;
  if (prefs.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.darkVariant = prefs.darkVariant;
  document.documentElement.dataset.lightVariant = prefs.lightVariant;
  document.documentElement.dataset.tint = prefs.tint;

  const dark = isEffectivelyDark(prefs);
  themeSelect.value = prefs.theme;
  darkVariantField.hidden = !dark;
  darkVariantSelect.value = prefs.darkVariant;
  lightVariantField.hidden = dark;
  lightVariantSelect.value = prefs.lightVariant;
  tintSelect.value = prefs.tint;
  sortKeySelect.value = prefs.sortKey;
}

async function updatePreferences(patch: Partial<Preferences>): Promise<void> {
  const next = { ...state.prefs, ...patch };
  applyPreferences(next);
  render();
  await savePreferences(next);
}

/* ---------------- Tab actions ---------------- */

async function activateTab(tabId: number, windowId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await chrome.tabs.remove(tabIds);
  for (const id of tabIds) {
    state.selected.delete(id);
    if (state.expandedId === id) {
      state.expandedId = undefined;
      state.expandedEl = undefined;
    }
  }
}

async function setPinned(tabIds: number[], pinned: boolean): Promise<void> {
  await Promise.all(tabIds.map((id) => chrome.tabs.update(id, { pinned })));
}

function renderedOrder(): number[] {
  return Array.from(board.querySelectorAll<HTMLElement>('.tile')).map((tile) =>
    Number(tile.dataset.tabId),
  );
}

function selectRange(toId: number): void {
  // Uses the rendered order so ranges follow what the user actually sees.
  const ordered = renderedOrder();
  const anchor = state.lastClickedId ?? toId;
  const from = ordered.indexOf(anchor);
  const to = ordered.indexOf(toId);
  if (from === -1 || to === -1) {
    state.selected.add(toId);
    return;
  }
  const [start, end] = from <= to ? [from, to] : [to, from];
  for (let i = start; i <= end; i += 1) {
    const id = ordered[i];
    if (id !== undefined) state.selected.add(id);
  }
}

/* ---------------- Events: board ---------------- */

board.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;

  const windowCollapseTrigger = target.closest<HTMLElement>(
    '[data-action="toggle-window-collapse"]',
  );
  if (windowCollapseTrigger) {
    event.stopPropagation();
    const windowId = Number(windowCollapseTrigger.dataset.windowId);
    if (!Number.isFinite(windowId)) return;
    if (state.collapsedWindows.has(windowId)) state.collapsedWindows.delete(windowId);
    else state.collapsedWindows.add(windowId);
    render();
    return;
  }

  const collapseTrigger = target.closest<HTMLElement>('[data-action="toggle-group-collapse"]');
  if (collapseTrigger) {
    event.stopPropagation();
    const groupId = Number(collapseTrigger.dataset.groupId);
    if (!Number.isFinite(groupId)) return;
    const collapsed = state.snapshot.groups[groupId]?.collapsed ?? false;
    void chrome.tabGroups
      .update(groupId, { collapsed: !collapsed })
      .then(() => scheduleRefresh())
      .catch((error) => console.warn('Could not toggle group collapse', error));
    return;
  }

  const moveGroupTrigger = target.closest<HTMLElement>('[data-action="move-group-to-new-window"]');
  if (moveGroupTrigger) {
    event.stopPropagation();
    const groupId = Number(moveGroupTrigger.dataset.groupId);
    if (!Number.isFinite(groupId)) return;
    void moveGroupToNewWindow(groupId);
    return;
  }

  const groupTile = target.closest<HTMLElement>('.group-tile');
  if (groupTile && !target.closest('.group-tile__drop')) {
    const groupId = Number(groupTile.dataset.groupId);
    const section = document.getElementById(`tab-group-${groupId}`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const renameTrigger = target.closest<HTMLElement>('[data-action="rename-group"]');
  if (renameTrigger) {
    event.stopPropagation();
    beginGroupRename(renameTrigger);
    return;
  }

  const splitPane = target.closest<HTMLElement>('[data-action="activate-split-pane"]');
  if (splitPane) {
    event.stopPropagation();
    const tabId = Number(splitPane.dataset.tabId);
    const windowId = Number(splitPane.dataset.windowId);
    if (Number.isFinite(tabId) && Number.isFinite(windowId)) void activateTab(tabId, windowId);
    return;
  }

  const swapTrigger = target.closest<HTMLElement>('[data-action="swap-split"]');
  if (swapTrigger) {
    event.stopPropagation();
    const tabA = Number(swapTrigger.dataset.tabA);
    const tabB = Number(swapTrigger.dataset.tabB);
    if (Number.isFinite(tabA) && Number.isFinite(tabB)) void swapSplitPanes(tabA, tabB);
    return;
  }

  const unsplitTrigger = target.closest<HTMLElement>('[data-action="unsplit"]');
  if (unsplitTrigger) {
    event.stopPropagation();
    const splitViewId = Number(unsplitTrigger.dataset.splitViewId);
    if (Number.isFinite(splitViewId)) void unsplitTabs(splitViewId);
    return;
  }

  const tile = target.closest<HTMLElement>('.tile');
  if (!tile) return;

  const tabId = Number(tile.dataset.tabId);
  const windowId = Number(tile.dataset.windowId);
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;

  if (action === 'close') {
    event.stopPropagation();
    void closeTabs([tabId]);
    return;
  }
  if (action === 'toggle-select') {
    event.stopPropagation();
    if (state.selected.has(tabId)) state.selected.delete(tabId);
    else state.selected.add(tabId);
    state.lastClickedId = tabId;
    render();
    return;
  }
  if (action === 'pin') {
    event.stopPropagation();
    const pinned = state.snapshot.tiles.find((t) => t.id === tabId)?.pinned ?? false;
    const targets = state.selected.has(tabId) ? [...state.selected] : [tabId];
    void setPinned(targets, !pinned);
    return;
  }
  if (action === 'expand') {
    // The button carries popovertarget, so the browser handles the toggle itself.
    event.stopPropagation();
    return;
  }
  if (target.closest('.tile__details')) return;

  if (event.metaKey || event.ctrlKey) {
    if (state.selected.has(tabId)) state.selected.delete(tabId);
    else state.selected.add(tabId);
    state.lastClickedId = tabId;
    render();
    return;
  }
  if (event.shiftKey) {
    selectRange(tabId);
    state.lastClickedId = tabId;
    render();
    return;
  }
  if (state.selected.size > 0) {
    state.selected.clear();
    render();
  }
  void activateTab(tabId, windowId);
});

board.addEventListener('click', (event) => {
  const colorItem = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action="change-group-color"]',
  );
  if (!colorItem) return;
  const groupId = Number(colorItem.dataset.groupId);
  const color = colorItem.dataset.color as chrome.tabGroups.ColorEnum;
  if (!Number.isFinite(groupId) || !(color in GROUP_COLORS)) return;

  void chrome.tabGroups
    .update(groupId, { color })
    .then(() => scheduleRefresh())
    .catch((error) => console.warn('Could not change group color', error));
});

board.addEventListener('keydown', (event) => {
  if ((event.target as HTMLElement).closest('.tile__details')) return;
  const windowHeader = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action="toggle-window-collapse"]',
  );
  if (windowHeader && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    windowHeader.click();
    return;
  }
  const groupTile = (event.target as HTMLElement).closest<HTMLElement>('.group-tile');
  if (groupTile && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    const groupId = Number(groupTile.dataset.groupId);
    document
      .getElementById(`tab-group-${groupId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const tile = (event.target as HTMLElement).closest<HTMLElement>('.tile');
  if (!tile) return;
  const tabId = Number(tile.dataset.tabId);
  const windowId = Number(tile.dataset.windowId);

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    void activateTab(tabId, windowId);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    void closeTabs([tabId]);
  }
});

/* ---------------- Events: drag and drop ---------------- */

let dragIds: number[] = [];
let draggedGroup: { groupId: number; windowId: number } | undefined;
/** True while the bulk bar is shown only to act as a drop target for an unselected drag. */
let bulkBarShownForDrag = false;

board.addEventListener('dragstart', (event) => {
  const groupTile = (event.target as HTMLElement).closest<HTMLElement>('.group-tile');
  if (groupTile) {
    if (targetIsGroupDropZone(event.target) || !groupTile.draggable) {
      event.preventDefault();
      return;
    }
    const groupId = Number(groupTile.dataset.groupId);
    const windowId = Number(groupTile.dataset.windowId);
    if (!Number.isFinite(groupId) || !Number.isFinite(windowId)) return;
    draggedGroup = { groupId, windowId };
    groupTile.dataset.dragging = 'true';
    event.dataTransfer?.setData('text/plain', String(groupId));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    return;
  }

  const groupHeader = (event.target as HTMLElement).closest<HTMLElement>('.group-section__header');
  if (groupHeader?.draggable && !(event.target as HTMLElement).closest('button, select, input')) {
    const groupId = Number(groupHeader.dataset.groupId);
    const windowId = Number(groupHeader.dataset.windowId);
    if (!Number.isFinite(groupId) || !Number.isFinite(windowId)) return;
    draggedGroup = { groupId, windowId };
    groupHeader.closest<HTMLElement>('.group-section')!.dataset.dragging = 'true';
    event.dataTransfer?.setData('text/plain', String(groupId));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    return;
  }

  const splitTile = (event.target as HTMLElement).closest<HTMLElement>('.split-tile');
  if (splitTile) {
    const ids = (splitTile.dataset.tabIds ?? '').split(',').map(Number).filter(Number.isFinite);
    if (ids.length !== 2) return;
    dragIds = ids;
    splitTile.dataset.dragging = 'true';
    event.dataTransfer?.setData('text/plain', String(ids[0]));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      const rect = splitTile.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        splitTile,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    }
    if (bulkBar.hidden) {
      bulkBarShownForDrag = true;
      bulkBar.hidden = false;
      bulkCount.textContent = `${dragIds.length} dragged`;
    }
    return;
  }

  const tile = (event.target as HTMLElement).closest<HTMLElement>('.tile');
  if (!tile) return;
  const tabId = Number(tile.dataset.tabId);
  dragIds = state.selected.has(tabId) ? [...state.selected] : [tabId];
  tile.dataset.dragging = 'true';
  event.dataTransfer?.setData('text/plain', String(tabId));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Without this the snapshot can be limited to the sub-element under the cursor.
    const rect = tile.getBoundingClientRect();
    event.dataTransfer.setDragImage(tile, event.clientX - rect.left, event.clientY - rect.top);
  }

  // The board no longer has its own "new window" drop target, so surface the bulk bar's
  // existing button as the drop target for a drag that started without a selection.
  if (bulkBar.hidden) {
    bulkBarShownForDrag = true;
    bulkBar.hidden = false;
    bulkCount.textContent = `${dragIds.length} dragged`;
  }
});

board.addEventListener('dragend', () => {
  dragIds = [];
  draggedGroup = undefined;
  for (const el of board.querySelectorAll<HTMLElement>('[data-dragging], [data-drop-target]')) {
    delete el.dataset.dragging;
    delete el.dataset.dropTarget;
    delete el.dataset.dropPosition;
  }
  delete bulkNewWindowButton.dataset.dropTarget;
  if (bulkBarShownForDrag) {
    bulkBarShownForDrag = false;
    renderBulkBar();
  }
});

board.addEventListener('dragover', (event) => {
  if (draggedGroup) {
    const target = groupReorderTarget(event.target);
    if (!target || targetIsGroupDropZone(event.target)) {
      return;
    }
    const targetWindowId = Number(
      target.dataset.windowId ?? target.closest<HTMLElement>('.window-section')?.dataset.windowId,
    );
    const targetGroupId = Number(target.dataset.groupId);
    if (
      targetWindowId !== draggedGroup.windowId ||
      (target.classList.contains('group-tile') && targetGroupId === draggedGroup.groupId)
    )
      return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    for (const section of board.querySelectorAll<HTMLElement>(
      '.tile[data-drop-target], .group-section[data-drop-target], .group-tile[data-drop-target]',
    )) {
      delete section.dataset.dropTarget;
      delete section.dataset.dropPosition;
    }
    target.dataset.dropTarget = 'true';
    target.dataset.dropPosition =
      event.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2
        ? 'before'
        : 'after';
    return;
  }

  if (dragIds.length === 0) return;

  // A single dragged tab hovering over another tile's split-target badge previews forming
  // a Split View there, distinct from the ordinary reorder-by-dropping-on-a-tile behavior.
  if (dragIds.length === 1) {
    const splitTarget = (event.target as HTMLElement).closest<HTMLElement>('.tile__split-target');
    if (splitTarget) {
      const hostTile = splitTarget.closest<HTMLElement>('.tile');
      const targetId = Number(hostTile?.dataset.tabId);
      if (hostTile && Number.isFinite(targetId) && !dragIds.includes(targetId)) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        for (const el of board.querySelectorAll<HTMLElement>('[data-drop-target]')) {
          delete el.dataset.dropTarget;
        }
        splitTarget.dataset.dropTarget = 'true';
        return;
      }
    }
  }

  const zone = (event.target as HTMLElement).closest<HTMLElement>(
    '.tile, .grid, .group-tile, .group-tile__drop, .split-tile',
  );
  if (!zone) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  for (const el of board.querySelectorAll<HTMLElement>('[data-drop-target]')) {
    delete el.dataset.dropTarget;
  }
  zone.dataset.dropTarget = 'true';
});

board.addEventListener('drop', (event) => {
  if (draggedGroup) {
    const source = draggedGroup;
    draggedGroup = undefined;
    const target = groupReorderTarget(event.target);
    if (!target || targetIsGroupDropZone(event.target)) {
      return;
    }
    event.preventDefault();
    const targetWindowId = Number(
      target.dataset.windowId ?? target.closest<HTMLElement>('.window-section')?.dataset.windowId,
    );
    if (targetWindowId !== source.windowId) return;
    const after = target.dataset.dropPosition === 'after';
    const targetIndex = groupReorderIndex(target);
    if (targetIndex === undefined) return;
    void moveGroup(source.groupId, source.windowId, targetIndex, after);
    return;
  }

  if (dragIds.length === 0) return;
  event.preventDefault();
  const ids = [...dragIds];
  dragIds = [];

  // Dropping a single tab precisely onto another tile's split-target badge pairs the two
  // into a Split View, instead of the ordinary reorder that dropping elsewhere on a tile does.
  if (ids.length === 1) {
    const splitTarget = (event.target as HTMLElement).closest<HTMLElement>('.tile__split-target');
    if (splitTarget) {
      const hostTile = splitTarget.closest<HTMLElement>('.tile');
      const targetId = Number(hostTile?.dataset.tabId);
      const sourceId = ids[0];
      if (
        hostTile &&
        Number.isFinite(targetId) &&
        sourceId !== undefined &&
        sourceId !== targetId
      ) {
        void splitTabs(sourceId, targetId);
        return;
      }
    }
  }

  const groupDropZone = (event.target as HTMLElement).closest<HTMLElement>('.group-tile__drop');
  if (groupDropZone) {
    const groupTile = groupDropZone.closest<HTMLElement>('.group-tile');
    const groupId = Number(groupTile?.dataset.groupId);
    const windowId = Number(groupTile?.dataset.windowId);
    if (!Number.isFinite(groupId) || !Number.isFinite(windowId)) return;
    void moveTabs(ids, windowId, -1, groupId);
    return;
  }

  const groupTile = (event.target as HTMLElement).closest<HTMLElement>('.group-tile');
  if (groupTile) {
    const groupId = Number(groupTile.dataset.groupId);
    const windowId = Number(groupTile.dataset.windowId);
    const target = state.snapshot.tiles
      .filter((tile) => tile.windowId === windowId && tile.group?.id === groupId)
      .sort((a, b) => a.index - b.index)[0];
    if (!target) return;
    // Dropping on a group card changes position only. Its explicit drop area handles grouping.
    void moveTabsPreservingGroup(ids, windowId, target.index);
    return;
  }

  const splitTile = (event.target as HTMLElement).closest<HTMLElement>('.split-tile');
  if (splitTile) {
    const anchorId = Number(splitTile.dataset.anchorTabId);
    const target = state.snapshot.tiles.find((tile) => tile.id === anchorId);
    if (!target) return;
    // A Split View only ever pairs two tabs, so dropping a third tile on it repositions
    // the dragged tab(s) alongside it rather than attempting to join the split.
    void moveTabsPreservingGroup(ids, target.windowId, target.index);
    return;
  }

  const targetTile = (event.target as HTMLElement).closest<HTMLElement>('.tile');
  if (targetTile) {
    const targetId = Number(targetTile.dataset.tabId);
    if (ids.includes(targetId)) return;
    const target = state.snapshot.tiles.find((tile) => tile.id === targetId);
    if (!target) return;
    void moveTabs(ids, target.windowId, target.index, target.group?.id);
    return;
  }

  const grid = (event.target as HTMLElement).closest<HTMLElement>('.grid[data-window-id]');
  if (grid) {
    // A grid's own group id (NO_GROUP for the ungrouped grid) decides whether the drop
    // joins a tab group or leaves one, so a group is a distinct target in both directions.
    const groupIdAttr = grid.dataset.groupId;
    const groupId =
      groupIdAttr === undefined || Number(groupIdAttr) === NO_GROUP
        ? undefined
        : Number(groupIdAttr);
    void moveTabs(ids, Number(grid.dataset.windowId), -1, groupId);
  }
});

function targetIsGroupDropZone(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.group-tile__drop') !== null;
}

function groupReorderTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest<HTMLElement>('.tile, .group-section, .group-tile');
}

function groupReorderIndex(target: HTMLElement): number | undefined {
  if (target.classList.contains('tile')) {
    const tabId = Number(target.dataset.tabId);
    return state.snapshot.tiles.find((tile) => tile.id === tabId)?.index;
  }
  const groupId = Number(target.dataset.groupId);
  const windowId = Number(
    target.dataset.windowId ?? target.closest<HTMLElement>('.window-section')?.dataset.windowId,
  );
  const tiles = state.snapshot.tiles
    .filter((tile) => tile.windowId === windowId && tile.group?.id === groupId)
    .sort((a, b) => a.index - b.index);
  if (target.classList.contains('group-section') || target.classList.contains('group-tile')) {
    return tiles[0]?.index;
  }
  return undefined;
}

// The bulk bar's "Move to new window" button doubles as the drop target for drag and drop,
// covering both a multi-tab selection and a lone dragged tile.
bulkNewWindowButton.addEventListener('dragover', (event) => {
  if (dragIds.length === 0) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  bulkNewWindowButton.dataset.dropTarget = 'true';
});

bulkNewWindowButton.addEventListener('dragleave', () => {
  delete bulkNewWindowButton.dataset.dropTarget;
});

bulkNewWindowButton.addEventListener('drop', (event) => {
  if (dragIds.length === 0) return;
  event.preventDefault();
  delete bulkNewWindowButton.dataset.dropTarget;
  const ids = [...dragIds];
  dragIds = [];
  void moveToNewWindow(ids);
});

async function moveTabs(
  tabIds: number[],
  windowId: number,
  index: number,
  groupId: number | undefined,
): Promise<void> {
  try {
    await chrome.tabs.move(tabIds, { windowId, index });
    if (groupId !== undefined) await chrome.tabs.group({ groupId, tabIds });
    else await chrome.tabs.ungroup(tabIds);
  } catch (error) {
    console.warn('Could not move tabs', error);
  }
  scheduleRefresh();
}

async function moveTabsPreservingGroup(
  tabIds: number[],
  windowId: number,
  index: number,
): Promise<void> {
  try {
    await chrome.tabs.move(tabIds, { windowId, index });
  } catch (error) {
    console.warn('Could not reorder tabs', error);
  }
  scheduleRefresh();
}

/**
 * Pairs two tabs into a Split View. Chrome requires the pair to be adjacent and to share
 * `windowId`, `pinned`, and `groupId`, so the dragged tab is first lined up next to the
 * target and matched to its pinned/group state before the pairing is requested.
 */
async function splitTabs(sourceId: number, targetId: number): Promise<void> {
  if (!isSplitViewSupported()) return;
  const source = state.snapshot.tiles.find((tile) => tile.id === sourceId);
  const target = state.snapshot.tiles.find((tile) => tile.id === targetId);
  if (!source || !target) return;
  try {
    await chrome.tabs.move(sourceId, { windowId: target.windowId, index: target.index + 1 });
    if (source.pinned !== target.pinned) {
      await chrome.tabs.update(sourceId, { pinned: target.pinned });
    }
    if (source.group?.id !== target.group?.id) {
      if (target.group) await chrome.tabs.group({ groupId: target.group.id, tabIds: [sourceId] });
      else await chrome.tabs.ungroup([sourceId]);
    }
    await chrome.tabs.createSplit([targetId, sourceId]);
  } catch (error) {
    console.warn('Could not create split view', error);
  }
  scheduleRefresh();
}

/** Swaps which side of the Split View each tab renders on by swapping their tab order. */
async function swapSplitPanes(tabIdA: number, tabIdB: number): Promise<void> {
  const b = state.snapshot.tiles.find((tile) => tile.id === tabIdB);
  if (!b) return;
  try {
    await chrome.tabs.move(tabIdA, { index: b.index });
  } catch (error) {
    console.warn('Could not swap split view sides', error);
  }
  scheduleRefresh();
}

/** Separates a Split View back into two independent tabs. */
async function unsplitTabs(splitViewId: number): Promise<void> {
  if (!isSplitViewSupported()) return;
  try {
    await chrome.tabs.unsplit(splitViewId);
  } catch (error) {
    console.warn('Could not unsplit tabs', error);
  }
  scheduleRefresh();
}

async function moveGroup(
  groupId: number,
  windowId: number,
  targetIndex: number,
  after: boolean,
): Promise<void> {
  const groupTabs = state.snapshot.tiles
    .filter((tile) => tile.windowId === windowId && tile.group?.id === groupId)
    .sort((a, b) => a.index - b.index);
  if (groupTabs.length === 0) return;

  let index = after ? targetIndex + 1 : targetIndex;
  if (groupTabs[0]!.index < index) index -= groupTabs.length;

  try {
    await chrome.tabs.move(
      groupTabs.map((tab) => tab.id),
      { windowId, index },
    );
  } catch (error) {
    console.warn('Could not reorder group', error);
  }
  scheduleRefresh();
}

async function moveToNewWindow(tabIds: number[]): Promise<void> {
  const [first, ...rest] = tabIds;
  if (first === undefined) return;
  try {
    const win = await chrome.windows.create({ tabId: first, focused: false });
    if (rest.length > 0 && win?.id !== undefined) {
      await chrome.tabs.move(rest, { windowId: win.id, index: -1 });
    }
  } catch (error) {
    console.warn('Could not open a new window', error);
  }
  state.selected.clear();
  scheduleRefresh();
}

/**
 * Moves an entire group (all its tabs, in order, keeping color/title/collapsed state)
 * into a brand new window. Uses tabGroups.move rather than moving tabs individually so
 * the group survives the move instead of being dissolved.
 */
async function moveGroupToNewWindow(groupId: number): Promise<void> {
  try {
    const win = await chrome.windows.create({ focused: true });
    const placeholderId = win?.tabs?.[0]?.id;
    if (win?.id === undefined) return;
    await chrome.tabGroups.move(groupId, { windowId: win.id, index: -1 });
    if (placeholderId !== undefined) {
      await chrome.tabs.remove(placeholderId).catch(() => {});
    }
  } catch (error) {
    console.warn('Could not move group to a new window', error);
  }
  scheduleRefresh();
}

/* ---------------- Events: toolbar ---------------- */

filterInput.addEventListener('input', () => {
  state.filter = filterInput.value;
  render();
});

sortKeySelect.addEventListener('change', () => {
  void updatePreferences({ sortKey: sortKeySelect.value as SortKey });
});

themeSelect.addEventListener('change', () => {
  void updatePreferences({ theme: themeSelect.value as Preferences['theme'] });
});

darkVariantSelect.addEventListener('change', () => {
  void updatePreferences({ darkVariant: darkVariantSelect.value as DarkVariant });
});

lightVariantSelect.addEventListener('change', () => {
  void updatePreferences({ lightVariant: lightVariantSelect.value as LightVariant });
});

tintSelect.addEventListener('change', () => {
  void updatePreferences({ tint: tintSelect.value as Tint });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.selected.size > 0) {
    // Let the browser dismiss an open details popover first.
    if (state.expandedId !== undefined) return;
    state.selected.clear();
    render();
    return;
  }
  if (event.key === '/' && document.activeElement !== filterInput) {
    event.preventDefault();
    filterInput.focus();
  }
});

/* ---------------- Events: bulk bar ---------------- */

document.getElementById('bulk-close')?.addEventListener('click', () => {
  void closeTabs([...state.selected]);
});

document.getElementById('bulk-clear')?.addEventListener('click', () => {
  state.selected.clear();
  render();
});

document.getElementById('bulk-new-window')?.addEventListener('click', () => {
  void moveToNewWindow([...state.selected]);
});

document.getElementById('bulk-group')?.addEventListener('click', () => {
  void (async () => {
    const tabIds = [...state.selected];
    if (tabIds.length === 0) return;
    try {
      await chrome.tabs.group({ tabIds });
    } catch (error) {
      console.warn('Could not group tabs', error);
    }
    state.selected.clear();
    scheduleRefresh();
  })();
});

document.getElementById('bulk-split')?.addEventListener('click', () => {
  void (async () => {
    const [sourceId, targetId] = [...state.selected];
    if (sourceId === undefined || targetId === undefined) return;
    await splitTabs(sourceId, targetId);
    state.selected.clear();
    render();
  })();
});

/* ---------------- Permissions ---------------- */

let permissionMode: 'capture' | 'memory' | undefined;

function showPermissionBar(mode: 'capture' | 'memory', message: string): void {
  permissionMode = mode;
  permissionText.textContent = message;
  permissionBar.hidden = false;
}

permissionDismiss.addEventListener('click', () => {
  permissionBar.hidden = true;
  permissionMode = undefined;
});

permissionGrant.addEventListener('click', () => {
  void (async () => {
    if (permissionMode === 'capture') {
      const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
      permissionBar.hidden = true;
      if (granted) await requestCaptureNow();
    } else if (permissionMode === 'memory') {
      const granted = await requestMemoryPermission();
      permissionBar.hidden = true;
      if (granted) {
        state.memoryState = 'available';
        startMemoryPolling();
      }
    }
    permissionMode = undefined;
  })();
});

async function checkPermissions(): Promise<void> {
  const hasHosts = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  state.memoryState = await memoryAvailability();

  if (!hasHosts) {
    showPermissionBar(
      'capture',
      'Allow Tabulous to capture visible tab screenshots for previews. They stay on this device and are deleted with the tab; without access, tabs use favicons instead.',
    );
  } else if (state.memoryState === 'permission-required') {
    showPermissionBar('memory', 'Allow process access to show per-tab memory usage.');
  }
}

/* ---------------- Memory polling ---------------- */

/** Updates an open popover in place so memory polling does not close it. */
function refreshOpenDetails(): void {
  const tabId = state.expandedId;
  const popover = state.expandedEl;
  if (tabId === undefined || !popover) return;
  const tile = state.snapshot.tiles.find((candidate) => candidate.id === tabId);
  if (!tile) return;
  const tilesById = new Map(state.snapshot.tiles.map((candidate) => [candidate.id, candidate]));
  popover.textContent = '';
  popover.append(buildDetails(tile, contextFor(tile, tilesById, isReorderable(state.prefs))));
}

function startMemoryPolling(): void {
  if (state.memoryState !== 'available' || memoryTimer) return;
  const poll = async (): Promise<void> => {
    if (document.hidden) return;
    state.memory = await readTabMemory();
    if (state.prefs.sortKey === 'memory') render();
    else refreshOpenDetails();
  };
  void poll();
  memoryTimer = setInterval(() => void poll(), 5000);
}

function stopMemoryPolling(): void {
  if (!memoryTimer) return;
  clearInterval(memoryTimer);
  memoryTimer = undefined;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMemoryPolling();
  } else {
    startMemoryPolling();
    scheduleRefresh();
  }
});

/* ---------------- Live updates ---------------- */

function subscribe(): void {
  const handler = (): void => scheduleRefresh();

  chrome.tabs.onCreated.addListener(handler);
  chrome.tabs.onRemoved.addListener(handler);
  chrome.tabs.onUpdated.addListener(handler);
  chrome.tabs.onMoved.addListener(handler);
  chrome.tabs.onActivated.addListener(handler);
  chrome.tabs.onAttached.addListener(handler);
  chrome.tabs.onDetached.addListener(handler);
  chrome.tabs.onReplaced.addListener(handler);

  chrome.windows.onCreated.addListener(handler);
  chrome.windows.onRemoved.addListener(handler);
  chrome.windows.onFocusChanged.addListener(handler);

  if (chrome.tabGroups) {
    chrome.tabGroups.onCreated.addListener(handler);
    chrome.tabGroups.onUpdated.addListener(handler);
    chrome.tabGroups.onRemoved.addListener(handler);
    chrome.tabGroups.onMoved.addListener(handler);
  }

  onPreferencesChanged((prefs) => {
    applyPreferences(prefs);
    render();
  });
}

/* ---------------- Boot ---------------- */

/** The toolbar wraps on narrow windows, so sticky headers track its real height. */
function trackToolbarHeight(): void {
  const toolbar = document.querySelector<HTMLElement>('.toolbar');
  if (!toolbar) return;
  const apply = (): void => {
    document.documentElement.style.setProperty(
      '--toolbar-height',
      `${Math.round(toolbar.getBoundingClientRect().height)}px`,
    );
  };
  apply();
  new ResizeObserver(apply).observe(toolbar);
}

async function init(): Promise<void> {
  const [prefs, win] = await Promise.all([loadPreferences(), chrome.windows.getCurrent()]);
  currentWindowId = win.id;
  applyPreferences(prefs);
  await showShortcut();
  trackToolbarHeight();
  subscribe();
  await refresh();
  await checkPermissions();
  startMemoryPolling();
  await requestCaptureNow();
  // Thumbnails captured during the request above land after a short delay.
  setTimeout(() => void refresh(), 1500);
}

void init();
