import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { captureOperationalError, setMonitoringTag } from '../monitoring/monitoring';
import { decideLiveUpdate, parseLiveUpdateManifest, type LiveUpdateDecision } from './liveUpdatePolicy';

// Self-hosted live updates: the app reads a static manifest per channel, downloads the
// checksummed web bundle in the background and activates it only on the next cold start,
// so an in-progress count, receipt or transfer is never reloaded under the user.

const baseUrl = String(import.meta.env.VITE_KCP_OTA_BASE_URL || '').trim().replace(/\/+$/, '');
const channel = String(import.meta.env.VITE_KCP_OTA_CHANNEL || 'production').trim();
const FOREGROUND_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MANIFEST_TIMEOUT_MS = 10_000;

type Trigger = 'launch' | 'foreground';
let inFlight: Promise<LiveUpdateDecision | null> | null = null;
let lastCheckAt = 0;

export function liveUpdatesConfigured() {
  return Capacitor.isNativePlatform() && /^https:\/\//i.test(baseUrl) && /^[a-z0-9-]+$/i.test(channel);
}

export function liveUpdateManifestUrl() {
  return `${baseUrl}/${channel}/manifest.json`;
}

export async function initializeLiveUpdates() {
  if (!Capacitor.isNativePlatform()) return;
  // Confirm this bundle booted before anything else; otherwise the plugin rolls back on its own.
  const ready = await CapacitorUpdater.notifyAppReady().catch(() => null);
  setMonitoringTag('web_bundle', ready?.bundle?.version || 'builtin');
  if (!liveUpdatesConfigured()) return;
  void checkForLiveUpdate('launch');
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && Date.now() - lastCheckAt >= FOREGROUND_CHECK_INTERVAL_MS) void checkForLiveUpdate('foreground');
  });
}

export function checkForLiveUpdate(trigger: Trigger) {
  if (!liveUpdatesConfigured()) return Promise.resolve(null);
  inFlight ||= runCheck(trigger).finally(() => { inFlight = null; });
  return inFlight;
}

async function fetchManifest() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(liveUpdateManifestUrl(), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    return parseLiveUpdateManifest(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck(trigger: Trigger): Promise<LiveUpdateDecision | null> {
  lastCheckAt = Date.now();
  try {
    const [manifest, current, builtin, info, device, bundles] = await Promise.all([
      fetchManifest(),
      CapacitorUpdater.current(),
      CapacitorUpdater.getBuiltinVersion(),
      App.getInfo(),
      CapacitorUpdater.getDeviceId(),
      CapacitorUpdater.list()
    ]);
    const onBuiltin = current.bundle.id === 'builtin';
    const decision = decideLiveUpdate(manifest, {
      currentVersion: onBuiltin ? builtin.version : current.bundle.version,
      onBuiltin,
      builtinVersion: builtin.version,
      nativeBuild: Number.parseInt(info.build, 10) || 0,
      deviceId: device.deviceId,
      failedVersions: bundles.bundles.filter((bundle) => bundle.status === 'error').map((bundle) => bundle.version)
    });

    if (decision.kind === 'reset') {
      // Resetting reloads immediately, so only do it before the user has started working.
      if (trigger === 'launch') await CapacitorUpdater.reset();
      return decision;
    }
    if (decision.kind !== 'download') return decision;

    const pending = await CapacitorUpdater.getNextBundle().catch(() => null);
    if (pending?.version === decision.manifest.version) return decision;
    const existing = bundles.bundles.find((bundle) => bundle.version === decision.manifest.version && (bundle.status === 'success' || bundle.status === 'pending'));
    const bundle = existing ?? await CapacitorUpdater.download({
      url: decision.manifest.url,
      version: decision.manifest.version,
      checksum: decision.manifest.sha256
    });
    await CapacitorUpdater.next({ id: bundle.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
    return decision;
  } catch (error) {
    captureOperationalError(error, { area: 'live-update', trigger, channel });
    return null;
  }
}
