import { putThumbnail } from './thumbnail-store';

const MAX_WIDTH = 400;
const CAPTURE_QUALITY = 60;
const DEBOUNCE_MS = 600;
/** Chrome throttles captureVisibleTab; stay well inside MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND. */
const MIN_INTERVAL_MS = 1100;

const pending = new Map<number, ReturnType<typeof setTimeout>>();
let lastCaptureAt = 0;

const UNCAPTURABLE = /^(chrome|chrome-extension|devtools|edge|about|view-source):/i;

export function isCapturable(url: string | undefined): boolean {
  if (!url) return false;
  if (UNCAPTURABLE.test(url)) return false;
  if (url.startsWith('https://chromewebstore.google.com')) return false;
  if (url.startsWith('https://chrome.google.com/webstore')) return false;
  return true;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function downscale(dataUrl: string): Promise<Blob> {
  const sourceBlob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(sourceBlob);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return sourceBlob;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
}

async function captureWindow(windowId: number): Promise<void> {
  const elapsed = Date.now() - lastCaptureAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }

  const [activeTab] = await chrome.tabs.query({ active: true, windowId });
  if (!activeTab?.id || !isCapturable(activeTab.url)) return;
  if (activeTab.status !== 'complete') return;

  try {
    lastCaptureAt = Date.now();
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: CAPTURE_QUALITY,
    });
    if (!dataUrl) return;
    const blob = await downscale(dataUrl);
    await putThumbnail({
      tabId: activeTab.id,
      url: activeTab.url ?? '',
      blob,
      capturedAt: Date.now(),
    });
  } catch {
    // Capture fails without host permission or on protected pages; fallback cards are used.
  }
}

/** Debounced per window so rapid tab switching produces one capture. */
export function scheduleCapture(windowId: number): void {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const existing = pending.get(windowId);
  if (existing) clearTimeout(existing);
  pending.set(
    windowId,
    setTimeout(() => {
      pending.delete(windowId);
      void captureWindow(windowId);
    }, DEBOUNCE_MS),
  );
}

/** Captures the active tab of every normal window, one at a time. */
export async function captureAllWindows(): Promise<void> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  for (const win of windows) {
    if (win.id === undefined) continue;
    await captureWindow(win.id);
  }
}
