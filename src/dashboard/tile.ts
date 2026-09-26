import { formatAbsolute, formatBytes, formatDuration } from '../lib/tabs';
import type { MemoryAvailability, TabMemory, TileModel } from '../lib/types';
import logoMarkUrl from '../assets/logo-mark.png';

const ICON_CLOSE =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor" d="M1.3.24 5 3.94 8.7.24a.75.75 0 0 1 1.06 1.06L6.06 5l3.7 3.7A.75.75 0 0 1 8.7 9.76L5 6.06l-3.7 3.7A.75.75 0 0 1 .24 8.7L3.94 5 .24 1.3A.75.75 0 0 1 1.3.24"/></svg>';

const ICON_CHEVRON =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor" d="M.7 3.3a.75.75 0 0 1 1.06 0L5 6.54l3.24-3.24A.75.75 0 1 1 9.3 4.36L5.53 8.12a.75.75 0 0 1-1.06 0L.7 4.36a.75.75 0 0 1 0-1.06"/></svg>';

const ICON_AUDIO =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 2.75v10.5a.75.75 0 0 1-1.23.58L3.73 11.2H2A1.5 1.5 0 0 1 .5 9.7V6.3A1.5 1.5 0 0 1 2 4.8h1.73l3.04-2.63A.75.75 0 0 1 8 2.75m3.1 1.6a.75.75 0 0 1 1.05.13 5.9 5.9 0 0 1 0 7.04.75.75 0 1 1-1.19-.92 4.4 4.4 0 0 0 0-5.2.75.75 0 0 1 .14-1.05"/></svg>';

const ICON_MUTED =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 2.75v10.5a.75.75 0 0 1-1.23.58L3.73 11.2H2A1.5 1.5 0 0 1 .5 9.7V6.3A1.5 1.5 0 0 1 2 4.8h1.73l3.04-2.63A.75.75 0 0 1 8 2.75m3.28 2.47L13 6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L14.06 8l1.72 1.72a.75.75 0 0 1-1.06 1.06L13 9.06l-1.72 1.72a.75.75 0 1 1-1.06-1.06L11.94 8l-1.72-1.72a.75.75 0 0 1 1.06-1.06"/></svg>';

const ICON_PIN =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M9.5.9a1.5 1.5 0 0 1 2.12 0l3.48 3.48a1.5 1.5 0 0 1 0 2.12l-.7.71a1.5 1.5 0 0 1-1.73.28l-1.9 1.9.2 2.46a1.5 1.5 0 0 1-2.55 1.18L5.8 10.9l-3.7 3.7a.75.75 0 1 1-1.06-1.06l3.7-3.7-2.13-2.13a1.5 1.5 0 0 1 1.18-2.55l2.46.2 1.9-1.9a1.5 1.5 0 0 1 .28-1.73z"/></svg>';

const ICON_CHECK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.7 3.9a1 1 0 0 1 0 1.4l-6.5 6.9a1 1 0 0 1-1.45.02L2.3 8.68a1 1 0 1 1 1.4-1.42l2.72 2.66 5.8-6.14a1 1 0 0 1 1.42.12"/></svg>';

const ICON_SLEEP =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a.75.75 0 0 0-1-.9 7.1 7.1 0 1 0 8.9 8.9.75.75 0 0 0-.9-1"/></svg>';

/** Two side-by-side panes represent Split View, both to invite and to label it. */
export const ICON_SPLIT =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h3A1.5 1.5 0 0 1 8 2.5v11A1.5 1.5 0 0 1 6.5 15h-3A1.5 1.5 0 0 1 2 13.5zm7 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5z"/></svg>';

export const ICON_SWAP =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(90 8 8)"><path fill="currentColor" d="M4.47 1.22a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1-1.06 1.06L5.75 3.56V11a.75.75 0 0 1-1.5 0V3.56L3.03 4.78a.75.75 0 0 1-1.06-1.06zm7.06 13.56a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.22 1.22V5a.75.75 0 0 1 1.5 0v7.44l1.22-1.22a.75.75 0 1 1 1.06 1.06z"/></g></svg>';

export const ICON_UNSPLIT =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h2A1.5 1.5 0 0 1 7 2.5v3.75a.75.75 0 0 1-1.5 0V2.5h-2v11h2V9.75a.75.75 0 0 1 1.5 0v2.75A1.5 1.5 0 0 1 5.5 14h-2A1.5 1.5 0 0 1 2 12.5zm11.03-.28a.75.75 0 0 1 0 1.06L11.31 5H13a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75V2.25a.75.75 0 0 1 1.5 0v1.69l1.72-1.72a.75.75 0 0 1 1.06 0m0 10.56a.75.75 0 0 0 0-1.06L11.31 9.5H13a.75.75 0 0 0 0-1.5h-3.5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-1.69l1.72 1.72a.75.75 0 0 0 1.06 0"/></svg>';

/**
 * Chrome only exposes Split View creation/unsplit APIs from Chrome 155 onward. A tab can
 * still report a `splitViewId` on older builds, so this only gates the controls that call
 * those methods (pairing new tabs, unsplitting) rather than whether an already-linked pair
 * displays as a combined tile.
 */
export function isSplitViewSupported(): boolean {
  return typeof chrome.tabs.createSplit === 'function' && typeof chrome.tabs.unsplit === 'function';
}

export const GROUP_COLORS: Record<string, string> = {
  grey: 'var(--group-grey)',
  blue: 'var(--group-blue)',
  red: 'var(--group-red)',
  yellow: 'var(--group-yellow)',
  green: 'var(--group-green)',
  pink: 'var(--group-pink)',
  purple: 'var(--group-purple)',
  cyan: 'var(--group-cyan)',
  orange: 'var(--group-orange)',
};

const GENERIC_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23999" d="M8 .5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15m5.9 6.75h-2.66a11.6 11.6 0 0 0-1.06-4.4 6.02 6.02 0 0 1 3.72 4.4M8 2.06c.6.86 1.4 2.5 1.6 5.19H6.4c.2-2.7 1-4.33 1.6-5.19M2.1 7.25a6.02 6.02 0 0 1 3.72-4.4 11.6 11.6 0 0 0-1.06 4.4zm0 1.5h2.66c.09 1.62.44 3.1 1.06 4.4a6.02 6.02 0 0 1-3.72-4.4M8 13.94c-.6-.86-1.4-2.5-1.6-5.19h3.2c-.2 2.7-1 4.33-1.6 5.19m2.18-.79c.62-1.3.97-2.78 1.06-4.4h2.66a6.02 6.02 0 0 1-3.72 4.4"/></svg>'.replace(
      /%23/g,
      '#',
    ),
  );

/** Favicon fetches fail for many pages, so fall back to a neutral globe. */
export function withIconFallback(img: HTMLImageElement): HTMLImageElement {
  // Native image dragging would otherwise pre-empt dragging the whole tile.
  img.draggable = false;
  img.addEventListener(
    'error',
    () => {
      img.src = GENERIC_ICON;
    },
    { once: true },
  );
  return img;
}

export interface TileContext {
  thumbnailUrl: string | undefined;
  memory: TabMemory | undefined;
  memoryAvailability: MemoryAvailability;
  selected: boolean;
  draggable: boolean;
  tilesById: Map<number, TileModel>;
  onDetailsToggle: (tabId: number, popover: HTMLElement, open: boolean) => void;
}

export function detailsPopoverId(tabId: number): string {
  return `tile-details-${tabId}`;
}

export const SUPPORTS_ANCHOR = CSS.supports('anchor-name', '--a');

/** Keeps a popover beside its disclosure button on browsers without CSS anchor positioning. */
export function positionWithoutAnchor(popover: HTMLElement, anchorEl: HTMLElement): void {
  const rect = anchorEl.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.margin = '0';
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const own = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + own.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - own.width - 8);
    }
    if (top + own.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - own.height - 4);
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.visibility = '';
  });
}

export function faviconUrl(tile: TileModel): string {
  // Reuse the plain mark, not the bordered manifest icon: `.tile__favicon` already frames it.
  if (tile.isDashboard) return logoMarkUrl;
  if (tile.favIconUrl && !tile.favIconUrl.startsWith('chrome://')) return tile.favIconUrl;
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', tile.url);
  url.searchParams.set('size', '32');
  return url.toString();
}

function buildDashboardPreview(): HTMLElement {
  const selfPreview = document.createElement('div');
  selfPreview.className = 'tile__self-preview';

  const mark = document.createElement('img');
  mark.src = logoMarkUrl;
  mark.alt = '';
  mark.draggable = false;

  const copy = document.createElement('div');
  copy.className = 'tile__self-copy';
  const name = document.createElement('strong');
  name.textContent = 'Tabulous';
  const tagline = document.createElement('span');
  tagline.textContent = 'Your tabs, at a glance';
  copy.append(name, tagline);

  selfPreview.append(mark, copy);
  return selfPreview;
}

function buildPreview(tile: TileModel, ctx: TileContext): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'tile__preview';

  if (tile.isDashboard) {
    preview.append(buildDashboardPreview());
  } else if (ctx.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = ctx.thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    preview.append(img);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'tile__fallback';
    const icon = document.createElement('img');
    icon.src = faviconUrl(tile);
    icon.alt = '';
    withIconFallback(icon);
    const domain = document.createElement('span');
    domain.className = 'tile__fallback-domain';
    domain.textContent = tile.domain || 'No preview';
    fallback.append(icon, domain);
    preview.append(fallback);
  }

  const badges = document.createElement('div');
  badges.className = 'tile__badges';

  // A custom checkbox rather than a native input, so its faint/solid states can match
  // the pin badge's hover affordance while staying obviously a checkbox, not a badge.
  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'tile__select';
  select.dataset.action = 'toggle-select';
  select.setAttribute('aria-pressed', String(ctx.selected));
  select.setAttribute('aria-label', `${ctx.selected ? 'Deselect' : 'Select'} ${tile.title}`);
  select.innerHTML = ICON_CHECK;
  badges.append(select);

  // Pinned tabs always show the badge; unpinned tabs get a faint one that pins on click.
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'badge tile__pin';
  pin.dataset.action = 'pin';
  pin.dataset.pinned = String(tile.pinned);
  pin.title = tile.pinned ? 'Unpin tab' : 'Pin tab';
  pin.setAttribute('aria-pressed', String(tile.pinned));
  pin.setAttribute('aria-label', `${tile.pinned ? 'Unpin' : 'Pin'} ${tile.title}`);
  pin.innerHTML = ICON_PIN;
  badges.append(pin);

  // Not a button: dragging another tab and dropping it here pairs the two into Split
  // View. Its own tab id is read from the ancestor `.tile` at drop time. Hidden entirely
  // when the browser's Split View API (chrome 155+) isn't available.
  if (!tile.splitViewId && isSplitViewSupported()) {
    const splitTarget = document.createElement('span');
    splitTarget.className = 'badge tile__split-target';
    splitTarget.title = 'Drop a tab here to open them together in Split View';
    splitTarget.setAttribute('aria-hidden', 'true');
    splitTarget.innerHTML = ICON_SPLIT;
    badges.append(splitTarget);
  }

  const addBadge = (container: HTMLElement, svg: string, label: string): void => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.title = label;
    badge.setAttribute('aria-label', label);
    badge.innerHTML = svg;
    container.append(badge);
  };
  preview.append(badges);

  // Separate from the badges above: these describe tab state rather than offering an
  // action, so they live in their own corner instead of crowding the interactive controls.
  const status = document.createElement('div');
  status.className = 'tile__status';
  if (tile.audible && !tile.muted) addBadge(status, ICON_AUDIO, 'Playing audio');
  if (tile.muted) addBadge(status, ICON_MUTED, 'Muted');
  if (tile.discarded || tile.frozen) {
    addBadge(status, ICON_SLEEP, tile.frozen ? 'Frozen' : 'Discarded');
  }
  if (status.childElementCount > 0) preview.append(status);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tile__close';
  close.dataset.action = 'close';
  close.title = 'Close tab';
  close.setAttribute('aria-label', `Close ${tile.title}`);
  close.innerHTML = ICON_CLOSE;
  preview.append(close);

  if (tile.group) {
    const chip = document.createElement('span');
    chip.className = 'group-chip';
    chip.style.setProperty('--group-color', GROUP_COLORS[tile.group.color] ?? 'var(--group-grey)');
    chip.innerHTML = '<span class="group-chip__dot"></span>';
    chip.append(document.createTextNode(tile.group.title));
    preview.append(chip);
  }

  return preview;
}

export function buildDetails(tile: TileModel, ctx: TileContext): HTMLElement {
  const details = document.createElement('dl');
  details.className = 'tile__details-list';

  const add = (term: string, value: string): void => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    details.append(dt, dd);
  };

  add(
    'Open for',
    tile.openedAt === undefined ? 'Unknown' : formatDuration(Date.now() - tile.openedAt),
  );
  add('Opened', formatAbsolute(tile.openedAt));
  add('Last used', formatAbsolute(tile.lastAccessed));
  add('Address', tile.isDashboard ? 'Tabulous dashboard' : tile.url || 'Unknown');
  add('Window', `#${tile.windowId}${tile.incognito ? ' (incognito)' : ''}`);
  add('Tab group', tile.group ? tile.group.title : 'None');

  const states: string[] = [];
  if (tile.active) states.push('Active');
  if (tile.pinned) states.push('Pinned');
  if (tile.audible) states.push('Audible');
  if (tile.muted) states.push('Muted');
  if (tile.discarded) states.push('Discarded');
  if (tile.frozen) states.push('Frozen');
  if (!tile.autoDiscardable) states.push('Never discard');
  if (tile.status && tile.status !== 'complete') states.push(`Loading (${tile.status})`);
  add('State', states.length > 0 ? states.join(', ') : 'Idle');

  if (tile.openerTabId !== undefined) {
    const opener = ctx.tilesById.get(tile.openerTabId);
    add('Opened from', opener ? opener.title : `Tab #${tile.openerTabId}`);
  }

  if (ctx.memoryAvailability === 'available') {
    add('Memory', formatBytes(ctx.memory?.privateMemoryBytes));
    if (ctx.memory?.cpuPercent !== undefined) {
      add('CPU', `${Math.round(ctx.memory.cpuPercent)}%`);
    }
  } else if (ctx.memoryAvailability === 'permission-required') {
    add('Memory', 'Permission needed');
  } else {
    add('Memory', 'Unavailable on this Chrome channel');
  }

  return details;
}

export function renderTile(tile: TileModel, ctx: TileContext): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'tile';
  item.dataset.tabId = String(tile.id);
  item.dataset.windowId = String(tile.windowId);
  item.dataset.active = String(tile.active);
  item.dataset.selected = String(ctx.selected);
  item.tabIndex = 0;
  item.draggable = ctx.draggable;
  item.setAttribute('role', 'listitem');
  item.setAttribute('aria-label', `${tile.title}${tile.domain ? ` — ${tile.domain}` : ''}`);

  item.append(buildPreview(tile, ctx));

  const body = document.createElement('div');
  body.className = 'tile__body';

  const favicon = document.createElement('img');
  favicon.className = 'tile__favicon';
  favicon.src = faviconUrl(tile);
  favicon.alt = '';
  withIconFallback(favicon);
  body.append(favicon);

  const text = document.createElement('div');
  text.className = 'tile__text';
  const title = document.createElement('div');
  title.className = 'tile__title';
  title.textContent = tile.title;
  const domain = document.createElement('div');
  domain.className = 'tile__domain';
  domain.textContent = tile.isDashboard ? 'Tab overview' : tile.domain || tile.url;
  text.append(title, domain);
  body.append(text);

  const disclosure = document.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'tile__disclosure';
  disclosure.dataset.action = 'expand';
  disclosure.setAttribute('aria-expanded', 'false');
  disclosure.setAttribute('aria-label', `Details for ${tile.title}`);
  disclosure.innerHTML = ICON_CHEVRON;
  body.append(disclosure);

  item.append(body);
  item.append(buildDetailsPopover(tile, ctx, disclosure));

  return item;
}

/**
 * The detail panel is a non-modal popover in the top layer, anchored to the disclosure
 * button that opens it, so opening it never reflows the surrounding grid.
 */
function buildDetailsPopover(
  tile: TileModel,
  ctx: TileContext,
  disclosure: HTMLButtonElement,
): HTMLElement {
  const popoverId = detailsPopoverId(tile.id);
  const anchorName = `--tile-${tile.id}`;

  const popover = document.createElement('dialog');
  popover.id = popoverId;
  popover.className = 'tile__details';
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('aria-label', `Details for ${tile.title}`);

  disclosure.setAttribute('popovertarget', popoverId);

  // Anchor to the disclosure button itself (not the whole card): anchoring to the
  // card meant a flipped-to-fit popover jumped a full tile-height away from the
  // button near the bottom of the viewport, reading as unanchored/floating.
  if (SUPPORTS_ANCHOR) {
    disclosure.style.setProperty('anchor-name', anchorName);
    popover.style.setProperty('position-anchor', anchorName);
  }

  let populated = false;
  popover.addEventListener('beforetoggle', (event) => {
    const opening = (event as ToggleEvent).newState === 'open';
    if (!opening) return;
    if (!populated) {
      popover.append(buildDetails(tile, ctx));
      populated = true;
    }
    if (!SUPPORTS_ANCHOR) positionWithoutAnchor(popover, disclosure);
  });

  popover.addEventListener('toggle', (event) => {
    const open = (event as ToggleEvent).newState === 'open';
    disclosure.setAttribute('aria-expanded', String(open));
    ctx.onDetailsToggle(tile.id, popover, open);
  });

  return popover;
}
