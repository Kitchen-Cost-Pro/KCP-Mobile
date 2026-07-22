import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

// Read-only offline snapshots are a short-lived convenience, not a source of
// truth. Without an age gate an old snapshot (for example a purchase order that
// was already received or deleted on another device) keeps reappearing until
// the next successful online refresh. Anything older than this is treated as
// absent so the screen shows a clean empty/loading state instead of stale data.
export const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isSnapshotFresh(savedAt: string | number | null | undefined, maxAgeMs = SNAPSHOT_MAX_AGE_MS): boolean {
  const time = typeof savedAt === 'number' ? savedAt : Date.parse(String(savedAt || ''));
  if (!Number.isFinite(time)) return false;
  const age = Date.now() - time;
  return age >= 0 && age <= maxAgeMs;
}

// Every read-snapshot key uses one of these prefixes. Keeping the list here lets
// us clear them selectively without touching the secure session token, which
// lives in the same SecureStorage keychain.
const SNAPSHOT_KEY_PREFIXES = ['read-snapshot-v1-', 'low-stock-snapshot-v1-', 'kcp-mobile:task-snapshot:v1:'];

function isSnapshotKey(candidate: string): boolean {
  return SNAPSHOT_KEY_PREFIXES.some((prefix) => candidate.includes(prefix));
}

function clearWebSnapshots(storage: Storage) {
  const removable: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const candidate = storage.key(index);
    if (candidate && isSnapshotKey(candidate)) removable.push(candidate);
  }
  removable.forEach((candidate) => storage.removeItem(candidate));
}

// Remove every cached read snapshot for every workspace/user/location on this
// device, leaving the secure session and recovery drafts untouched. Safe to call
// on sign-out, on a user-initiated workspace switch, or from a manual control.
export async function clearReadSnapshots(): Promise<void> {
  try { clearWebSnapshots(window.sessionStorage); } catch { /* storage may be unavailable */ }
  try { clearWebSnapshots(window.localStorage); } catch { /* storage may be unavailable */ }
  if (!Capacitor.isNativePlatform()) return;
  try {
    const keys = await SecureStorage.keys();
    for (const candidate of keys) {
      if (!isSnapshotKey(candidate)) continue;
      try { await SecureStorage.remove(candidate, false); } catch { /* leave the rest intact */ }
    }
  } catch { /* secure storage cleanup is best-effort */ }
}
