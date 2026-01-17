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
export async function freeSpaceScan() {
  if (!nativex?.freeSpaceScan) return;

  nativex.toast?.('Scanning...', false);

  try {
    const res = await fetch(NAPI.PENDING_REMOTE_CHECK());
    if (res.ok) {
      const pending: { auid: string; buid: string; dayid: number }[] = await res.json();
      const byDay: Record<number, typeof pending> = {};

      for (const p of pending) {
        (byDay[p.dayid] ??= []).push(p);
      }

      for (const dayId of Object.keys(byDay)) {
        try {
          // Fetch server day
          const sRes = await fetch(API.DAY(dayId));
          if (!sRes.ok) continue;

          const sPhotos: any[] = await sRes.json();
          const pPhotos = byDay[parseInt(dayId)];

          const matchesA: string[] = [];
          const matchesB: string[] = [];

          const serverAuids = new Set(sPhotos.map((p) => p.auid));
          const serverBuids = new Set(sPhotos.map((p) => p.buid));

          for (const p of pPhotos) {
            if (p.auid && serverAuids.has(p.auid)) matchesA.push(p.auid);
            else if (p.buid && serverBuids.has(p.buid)) matchesB.push(p.buid);
          }

          if (matchesA.length || matchesB.length) {
            nativex.setHasRemote(JSON.stringify(matchesA), JSON.stringify(matchesB), true);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  return nativex.freeSpaceScan();
}
