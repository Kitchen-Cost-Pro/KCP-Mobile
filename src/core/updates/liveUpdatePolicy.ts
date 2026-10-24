// Pure decision logic for KCP Lite over-the-air (live) web bundle updates.
// Kept free of Capacitor imports so every rule is unit-testable.

export type LiveUpdateManifest = {
  /** Web bundle version, e.g. "0.22.1". Must differ from the installed bundle to be applied. */
  version: string;
  /** HTTPS URL of the zipped `dist` folder. */
  url: string;
  /** Lowercase hex SHA-256 of the zip; the native plugin refuses a bundle that does not match. */
  sha256: string;
  /** Lowest native build number (Android versionCode / iOS CFBundleVersion) this bundle runs on. */
  minNativeBuild: number;
  /** Optional highest native build number; newer store builds ignore the bundle. */
  maxNativeBuild?: number;
  /** Percentage of devices (0–100) that receive this bundle. Defaults to 100. */
  rollout?: number;
  /** Kill switch: return every device on this channel to the web bundle shipped in its store build. */
  resetToBuiltin?: boolean;
  releasedAt?: string;
  notes?: string;
};

export type LiveUpdateDevice = {
  /** Version of the bundle currently running ("builtin" bundles report the native version). */
  currentVersion: string;
  /** True when running the bundle shipped inside the store binary. */
  onBuiltin: boolean;
  /** Version name of the bundle shipped inside the store binary. */
  builtinVersion: string;
  nativeBuild: number;
  deviceId: string;
  /** Versions that failed to start on this device and were rolled back by the native plugin. */
  failedVersions: string[];
};

export type LiveUpdateDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'reset'; reason: string }
  | { kind: 'download'; manifest: LiveUpdateManifest };

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function parseLiveUpdateManifest(value: unknown): LiveUpdateManifest | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.resetToBuiltin === true) {
    return { version: '', url: '', sha256: '', minNativeBuild: 0, resetToBuiltin: true };
  }
  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const sha256 = typeof raw.sha256 === 'string' ? raw.sha256.trim().toLowerCase() : '';
  const minNativeBuild = Number(raw.minNativeBuild);
  if (!VERSION_PATTERN.test(version) || !SHA256_PATTERN.test(sha256)) return null;
  if (!/^https:\/\//i.test(url)) return null;
  if (!Number.isInteger(minNativeBuild) || minNativeBuild < 0) return null;
  const manifest: LiveUpdateManifest = { version, url, sha256, minNativeBuild };
  if (raw.maxNativeBuild !== undefined) {
    const maxNativeBuild = Number(raw.maxNativeBuild);
    if (!Number.isInteger(maxNativeBuild) || maxNativeBuild < minNativeBuild) return null;
    manifest.maxNativeBuild = maxNativeBuild;
  }
  if (raw.rollout !== undefined) {
    const rollout = Number(raw.rollout);
    if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) return null;
    manifest.rollout = rollout;
  }
  if (typeof raw.releasedAt === 'string') manifest.releasedAt = raw.releasedAt;
  if (typeof raw.notes === 'string') manifest.notes = raw.notes;
  return manifest;
}

/** Stable 0–99 bucket per device and version, so a staged rollout widens without reshuffling devices. */
export function rolloutBucket(deviceId: string, version: string) {
  let hash = 2166136261;
  for (const character of `${deviceId}:${version}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function decideLiveUpdate(manifest: LiveUpdateManifest | null, device: LiveUpdateDevice): LiveUpdateDecision {
  if (!manifest) return { kind: 'none', reason: 'No valid manifest.' };
  if (manifest.resetToBuiltin) {
    return device.onBuiltin ? { kind: 'none', reason: 'Already on the store bundle.' } : { kind: 'reset', reason: 'Channel kill switch is active.' };
  }
  if (device.nativeBuild < manifest.minNativeBuild) return { kind: 'none', reason: 'Native build is older than the bundle requires.' };
  if (manifest.maxNativeBuild !== undefined && device.nativeBuild > manifest.maxNativeBuild) {
    return { kind: 'none', reason: 'Native build is newer than the bundle supports.' };
  }
  if (manifest.version === device.currentVersion) return { kind: 'none', reason: 'Already running this bundle.' };
  // Publishing the store build's own version is how a channel rolls devices back to the builtin bundle.
  if (manifest.version === device.builtinVersion) {
    return device.onBuiltin ? { kind: 'none', reason: 'Already on the store bundle.' } : { kind: 'reset', reason: 'Channel points at the store bundle.' };
  }
  if (device.failedVersions.includes(manifest.version)) return { kind: 'none', reason: 'This bundle previously failed to start.' };
  const rollout = manifest.rollout ?? 100;
  if (rolloutBucket(device.deviceId, manifest.version) >= rollout) return { kind: 'none', reason: 'Device is outside the staged rollout.' };
  return { kind: 'download', manifest };
}
