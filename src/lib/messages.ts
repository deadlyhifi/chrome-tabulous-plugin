export const MSG = {
  GET_TAB_AGES: 'get-tab-ages',
  CAPTURE_NOW: 'capture-now',
} as const;

export interface GetTabAgesRequest {
  type: typeof MSG.GET_TAB_AGES;
}

export interface GetTabAgesResponse {
  ages: Record<number, number>;
}

export interface CaptureNowRequest {
  type: typeof MSG.CAPTURE_NOW;
}

export type ExtensionRequest = GetTabAgesRequest | CaptureNowRequest;

export async function requestTabAges(): Promise<Record<number, number>> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MSG.GET_TAB_AGES,
    } satisfies GetTabAgesRequest)) as GetTabAgesResponse | undefined;
    return response?.ages ?? {};
  } catch {
    return {};
  }
}

export async function requestCaptureNow(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: MSG.CAPTURE_NOW } satisfies CaptureNowRequest);
  } catch {
    // The worker may be restarting; capture will happen on the next event.
  }
}
