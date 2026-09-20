import type { MemoryAvailability, TabMemory } from './types';

/**
 * chrome.processes only exists on Chrome Dev/Canary builds, so every use is
 * feature-detected and the dashboard degrades to "unavailable" elsewhere.
 */
interface ProcessesApi {
  getProcessInfo(
    processIds: number[] | number,
    includeMemory: boolean,
  ): Promise<Record<string, ProcessInfo>>;
}

interface ProcessInfo {
  id: number;
  tasks: { tabId?: number; title: string }[];
  privateMemory?: number;
  cpu?: number;
}

function processesApi(): ProcessesApi | undefined {
  const api = (chrome as unknown as { processes?: ProcessesApi }).processes;
  return typeof api?.getProcessInfo === 'function' ? api : undefined;
}

export async function memoryAvailability(): Promise<MemoryAvailability> {
  if (!processesApi()) return 'unsupported';
  const granted = await chrome.permissions.contains({ permissions: ['processes'] });
  return granted ? 'available' : 'permission-required';
}

export async function requestMemoryPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['processes'] });
  } catch {
    return false;
  }
}

export async function readTabMemory(): Promise<Map<number, TabMemory>> {
  const result = new Map<number, TabMemory>();
  const api = processesApi();
  if (!api) return result;

  try {
    const processes = await api.getProcessInfo([], true);
    for (const process of Object.values(processes)) {
      for (const task of process.tasks ?? []) {
        if (task.tabId === undefined) continue;
        result.set(task.tabId, {
          tabId: task.tabId,
          privateMemoryBytes: process.privateMemory,
          cpuPercent: process.cpu,
        });
      }
    }
  } catch {
    // Permission may have been revoked between checks.
  }
  return result;
}
