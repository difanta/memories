import { API } from '@services/API';
import { NAPI, nativex } from './api';

/** Setting of whether a local folder is enabled */
export type LocalFolderConfig = {
  id: string;
  name: string;
  enabled: boolean;
};

/**
 * Set list of local folders configuration.
 */
export function setLocalFolders(config: LocalFolderConfig[]) {
  return nativex?.configSetLocalFolders(JSON.stringify(config));
}

/**
 * Get list of local folders configuration.
 * Should be called only if NativeX is available.
 */
export function getLocalFolders() {
  return JSON.parse(nativex?.configGetLocalFolders?.() ?? '[]') as LocalFolderConfig[];
}

/**
 * Check if the user has allowed media access.
 */
export function configHasMediaPermission() {
  return nativex?.configHasMediaPermission?.() ?? false;
}

/**
 * Allow access to media.
 */
export async function configAllowMedia(val: boolean = true) {
  return await fetch(NAPI.CONFIG_ALLOW_MEDIA(val));
}

/**
 * Scan for local files that are already backed up and prompt the user to delete them.
 */
export async function freeSpaceScan(
  onProgress?: (param: { current: number; total: number }) => void,
  signal?: AbortSignal,
) {
  if (!nativex?.freeSpaceScan) return;

  try {
    const res = await fetch(NAPI.PENDING_REMOTE_CHECK());
    if (res.ok) {
      const pending: { auid: string; buid: string; dayid: number }[] = await res.json();

      const total = pending.length;
      let current = 0;

      let matchesA: string[] = [];
      let matchesB: string[] = [];

      const flush = () => {
        if (matchesA.length || matchesB.length) {
          nativex.setHasRemote(JSON.stringify(matchesA), JSON.stringify(matchesB), true);
          matchesA = [];
          matchesB = [];
        }
      };

      const queue = [...pending];
      const LIMIT = 8;

      const runWorker = async () => {
        while (queue.length && !signal?.aborted) {
          const p = queue.shift();
          if (!p) break;

          try {
            let found = false;

            // Check AUID
            if (p.auid) {
              const r = await fetch(API.IMAGE_INFO(parseInt(p.auid)));
              if (r.ok) {
                matchesA.push(p.auid);
                found = true;
              }
            }

            // Check BUID if AUID not found
            if (!found && p.buid) {
              const r = await fetch(API.IMAGE_INFO(parseInt(p.buid)));
              if (r.ok) {
                matchesB.push(p.buid);
                found = true;
              }
            }

            if (Math.max(matchesA.length, matchesB.length) >= 64) {
              flush();
            }
          } catch (e) {
            console.error(e);
          } finally {
            current++;
            onProgress?.({ current, total });
          }
        }
      };

      await Promise.all(Array.from({ length: LIMIT }, runWorker));
      flush();
    }
  } catch (e) {
    console.error(e);
  }

  if (!signal?.aborted) {
    return nativex.freeSpaceScan();
  }
}
