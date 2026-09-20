import { captureAllWindows, scheduleCapture } from '../lib/capture';
import { MSG } from '../lib/messages';
import type { ExtensionRequest, GetTabAgesResponse } from '../lib/messages';
import { loadTabAges, saveTabAges } from '../lib/storage';
import { dashboardUrl } from '../lib/tabs';
import { deleteThumbnail, pruneMissingTabs } from '../lib/thumbnail-store';

/** Fire-and-forget guard so storage or IndexedDB failures never surface as unhandled rejections. */
function run(task: Promise<unknown>): void {
  void task.catch((error) => console.warn('Tabulous background task failed', error));
}

async function recordTabOpened(tabId: number): Promise<void> {
  const ages = await loadTabAges();
  if (ages[tabId] !== undefined) return;
  ages[tabId] = Date.now();
  await saveTabAges(ages);
}

async function forgetTab(tabId: number): Promise<void> {
  const ages = await loadTabAges();
  if (ages[tabId] === undefined) return;
  delete ages[tabId];
  await saveTabAges(ages);
}

/** Seeds open times for tabs that existed before the extension was installed or restarted. */
async function reconcileTabAges(): Promise<void> {
  const [tabs, ages] = await Promise.all([chrome.tabs.query({}), loadTabAges()]);
  const liveIds = new Set<number>();
  const now = Date.now();
  let changed = false;

  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    liveIds.add(tab.id);
    if (ages[tab.id] === undefined) {
      ages[tab.id] = (tab as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed ?? now;
      changed = true;
    }
  }

  for (const key of Object.keys(ages)) {
    if (!liveIds.has(Number(key))) {
      delete ages[Number(key)];
      changed = true;
    }
  }

  if (changed) await saveTabAges(ages);
  await pruneMissingTabs(liveIds);
}

/**
 * Opens (or focuses) a Tabulous tab in a given window. Each window gets its own instance
 * rather than the whole browser sharing a single tab, so the dashboard can be open side by
 * side in more than one window at once.
 */
async function openDashboard(windowId?: number): Promise<void> {
  const url = dashboardUrl();
  const existing = await chrome.tabs.query({ url: `${url}*`, windowId });
  const target = existing[0];

  if (target?.id !== undefined) {
    await chrome.tabs.update(target.id, { active: true });
  } else {
    // Pinned from the start so the tab stays put at the edge of the strip instead of
    // landing among ordinary tabs, matching what the in-app pin button offers manually.
    await chrome.tabs.create({ url, windowId, pinned: true });
  }
  run(captureAllWindows());
}

chrome.action.onClicked.addListener((tab) => {
  run(openDashboard(tab.windowId));
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'open-tiles-view') return;
  run(chrome.windows.getCurrent().then((win) => openDashboard(win.id)));
});

chrome.runtime.onInstalled.addListener(() => {
  run(reconcileTabAges());
});

chrome.runtime.onStartup.addListener(() => {
  run(reconcileTabAges());
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) run(recordTabOpened(tab.id));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  run(forgetTab(tabId));
  run(deleteThumbnail(tabId));
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  run(forgetTab(removedTabId));
  run(deleteThumbnail(removedTabId));
  run(recordTabOpened(addedTabId));
});

chrome.tabs.onActivated.addListener((info) => {
  scheduleCapture(info.windowId);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    scheduleCapture(tab.windowId);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  scheduleCapture(windowId);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  if (message?.type === MSG.GET_TAB_AGES) {
    void loadTabAges().then((ages) => sendResponse({ ages } satisfies GetTabAgesResponse));
    return true;
  }
  if (message?.type === MSG.CAPTURE_NOW) {
    void captureAllWindows().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

run(reconcileTabAges());
