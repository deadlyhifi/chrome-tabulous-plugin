# Tabulous

A Chrome extension that gives you a tiled overview of every open tab across every window —
with previews, tab-group indicators, sorting, search, live updates and full tab management.

Styled after Safari's Tab Overview: a calm grid of uniform cards, system typography, and
automatic light and dark appearance.

## Features

- **Tiled overview** of all tabs in all windows, opened from the toolbar button.
- **Previews** of each tab, captured opportunistically as tabs become active and cached
  locally. Pages that cannot be captured fall back to a favicon and domain card.
- **Tab groups** shown as a chip on each card, using the group's real Chrome colour and name,
  and represented in the main grid by a navigable group tile that links to its distinct
  droppable section under each window (with the total group count alongside the tab and
  window count in the header).
- **Live updates** — the grid follows tabs as they are opened, closed, moved, renamed,
  grouped and ungrouped, without a manual refresh.
- **Sorting** by window order, recently used, time open, title, website, tab group, or memory,
  in either direction.
- **Grouping** by window or as one flat grid of every tab.
- **Search** across tab titles, addresses and group names. Press <kbd>/</kbd> to focus it.
- **Keyboard shortcut** — press <kbd>⌘</kbd><kbd>Shift</kbd><kbd>Y</kbd> on macOS (or
  <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Y</kbd> elsewhere) to open or focus Tabulous. The
  title-bar shortcut control shows the active binding; Chrome only permits changing extension
  shortcuts at <code>chrome://extensions/shortcuts</code>.
- **Tab management** — click to switch, hover for a close button, multi-select with
  <kbd>⌘</kbd>/<kbd>Ctrl</kbd> and <kbd>Shift</kbd>, and a bulk bar to group, close, or move
  tabs to a new window. The same "Move to new window" button also accepts a drag, so a
  single dragged tab — selected or not — can be dropped there without a dedicated drop zone
  taking up space on the board.
- **Group management** — rename a tab group by clicking its title or change its color from
  the group's section header, and drag tiles between a group's section and the window's
  ungrouped area or onto a group's “Drop tabs into group” tile area to add or remove tabs
  from the group. Collapse or expand a group from either its summary tile or section header —
  this toggles the real Chrome tab group's collapsed state in the browser's own tab strip;
  the dashboard's own tile and section stay visible either way so the group can still be
  managed here. Drag a group tile above or below another group to reorder them in
  Chrome's native window order. Chrome's own group state stays authoritative throughout.
- **Drag and drop** to reorder tabs, move them between windows, and move them into or out of
  a tab group by dropping on a group's section or the ungrouped grid.
- **Split View** — requires Chrome 155+. Two tabs already paired into a Chrome Split View
  render as one combined tile in the grid, with a button on each pane to jump to that tab, a
  swap-sides control, and an unsplit button. To create a new pair, drag one tab onto the
  small split icon that appears on another tile's badges; Tabulous lines the tabs up and pairs
  them for you. Split View has no orientation or ratio control exposed to extensions yet, so
  Tabulous can't offer a vertical/horizontal toggle.
- **Expandable details** per tab, opened from the chevron on each card. The panel is a
  non-modal popover anchored to its tile and drawn in the top layer, so opening it never
  reflows the grid. It shows how long the tab has been open, when it was last used, the full
  address, window, tab group, loading/discarded/frozen/audio state, which tab opened it,
  and memory usage where available. Press <kbd>Esc</kbd> or click away to dismiss.
- **Appearance** follows the system by default, with a manual Light / Dark override that
  syncs across your Chrome profile.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome:

1. Visit `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `dist/` folder.
4. Pin **Tabulous** to the toolbar and click it.

## Development

```bash
npm run dev        # Vite dev server with extension HMR
npm run build      # typecheck, then production build into dist/
npm run release    # lint, build, generate Store artwork, verify, and create dist.zip
npm run screenshots # create Chrome Web Store artwork in images/store/
npm run typecheck  # TypeScript only
npm run lint       # ESLint
npm run format     # Prettier
```

Load `dist/` as an unpacked extension for both `dev` and `build`.
The release command archives only the contents of `dist/`; repository folders such as
`docs/` and `images/` are not included.

Before generating store screenshots for the first time, install Playwright's Chromium build:

```bash
npm run screenshots:setup
```

The screenshot command uses an isolated browser profile and locally served sample pages, so it
does not capture personal tabs or depend on external websites. Set `CHROME_PATH` to use another
extension-capable Chromium executable.

Before submitting a release, run:

```bash
npm run release
```

This validates version consistency, package structure and size, required icons, listing-image
dimensions, and the presence of the privacy and Store submission documents. The generated
screenshots and promotional images are in `images/store/`; upload `dist.zip` as the extension
package. See [PRIVACY.md](PRIVACY.md) and
[docs/chrome-web-store-listing.md](docs/chrome-web-store-listing.md) for the text and checklist
used in the Developer Dashboard.

## Permissions

Required at install time:

| Permission  | Why                                                        |
| ----------- | ---------------------------------------------------------- |
| `tabs`      | Read tab titles, addresses and state; switch, move, close. |
| `tabGroups` | Read group names and colours, and group or ungroup tabs.   |
| `storage`   | Remember your preferences and when each tab was opened.    |
| `favicon`   | Show a site icon when a tab does not expose one.           |

Requested only when you opt in, from a bar at the top of the dashboard:

| Permission         | Why                                                         |
| ------------------ | ----------------------------------------------------------- |
| `<all_urls>` hosts | Capture tab previews. Without it, cards show favicons only. |
| `processes`        | Show per-tab memory and CPU usage.                          |

Nothing is sent anywhere. Previews live in a local IndexedDB database and are deleted when
the tab closes, or evicted once the cache exceeds 300 entries.

## Known Chrome limitations

- Chrome can only screenshot the **active** tab of a window, so previews appear for tabs
  you have visited while the extension has been installed. Opening the dashboard triggers a
  capture of each window's active tab.
- `chrome://` pages, the Chrome Web Store and the PDF viewer cannot be captured and always
  use fallback cards.
- Per-tab memory needs `chrome.processes`, which only ships on Chrome **Dev** and **Canary**.
  On stable Chrome the details panel reports memory as unavailable.
- Incognito tabs are only listed if you enable **Allow in incognito** for the extension on
  `chrome://extensions`.
- Drag to reorder is only available under the default **Window order** sort ascending, since
  any other order does not correspond to the tabs' real positions.

# One more thing

I am a seasoned software engineer but in the spirit of trying to understand what the future holds I have built this entirely through vibe coding.
