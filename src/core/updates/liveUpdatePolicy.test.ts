import { describe, expect, it } from 'vitest';
import { decideLiveUpdate, parseLiveUpdateManifest, rolloutBucket, type LiveUpdateDevice } from './liveUpdatePolicy';

const sha256 = 'a'.repeat(64);
const manifest = { version: '0.22.1', url: 'https://updates.example.com/bundles/0.22.1.zip', sha256, minNativeBuild: 20 };
const device: LiveUpdateDevice = { currentVersion: '0.22.0', onBuiltin: true, builtinVersion: '0.22.0', nativeBuild: 20, deviceId: 'device-1', failedVersions: [] };

describe('parseLiveUpdateManifest', () => {
  it('accepts a complete manifest and normalises the checksum', () => {
    expect(parseLiveUpdateManifest({ ...manifest, sha256: sha256.toUpperCase(), rollout: 25 })).toEqual({ ...manifest, rollout: 25 });
  });

  it('rejects insecure URLs, malformed checksums and versions', () => {
    expect(parseLiveUpdateManifest({ ...manifest, url: 'http://updates.example.com/b.zip' })).toBeNull();
    expect(parseLiveUpdateManifest({ ...manifest, sha256: 'abc' })).toBeNull();
    expect(parseLiveUpdateManifest({ ...manifest, version: 'latest' })).toBeNull();
    expect(parseLiveUpdateManifest({ ...manifest, minNativeBuild: undefined })).toBeNull();
    expect(parseLiveUpdateManifest({ ...manifest, maxNativeBuild: 10 })).toBeNull();
    expect(parseLiveUpdateManifest({ ...manifest, rollout: 150 })).toBeNull();
    expect(parseLiveUpdateManifest(null)).toBeNull();
  });

  it('treats a kill-switch manifest as valid without bundle fields', () => {
    expect(parseLiveUpdateManifest({ resetToBuiltin: true })?.resetToBuiltin).toBe(true);
  });
});

describe('decideLiveUpdate', () => {
  it('downloads a new compatible bundle', () => {
    expect(decideLiveUpdate(manifest, device)).toEqual({ kind: 'download', manifest });
  });

  it('skips when already current, incompatible or previously failed', () => {
    expect(decideLiveUpdate(manifest, { ...device, currentVersion: '0.22.1', onBuiltin: false }).kind).toBe('none');
    expect(decideLiveUpdate(manifest, { ...device, nativeBuild: 19 }).kind).toBe('none');
    expect(decideLiveUpdate({ ...manifest, maxNativeBuild: 20 }, { ...device, nativeBuild: 21 }).kind).toBe('none');
    expect(decideLiveUpdate(manifest, { ...device, failedVersions: ['0.22.1'] }).kind).toBe('none');
    expect(decideLiveUpdate(null, device).kind).toBe('none');
  });

  it('rolls an updated device back to the store bundle via kill switch or by publishing the builtin version', () => {
    const updated = { ...device, currentVersion: '0.22.1', onBuiltin: false };
    expect(decideLiveUpdate({ ...manifest, minNativeBuild: 0, version: '', url: '', sha256: '', resetToBuiltin: true }, updated).kind).toBe('reset');
    expect(decideLiveUpdate({ ...manifest, version: '0.22.0' }, updated).kind).toBe('reset');
    expect(decideLiveUpdate({ ...manifest, version: '0.22.0' }, device).kind).toBe('none');
  });

  it('lets a channel move back to an older OTA bundle', () => {
    const updated = { ...device, currentVersion: '0.22.2', onBuiltin: false };
    expect(decideLiveUpdate(manifest, updated).kind).toBe('download');
  });

  it('honours staged rollout percentages deterministically', () => {
    const bucket = rolloutBucket(device.deviceId, manifest.version);
    expect(rolloutBucket(device.deviceId, manifest.version)).toBe(bucket);
    expect(decideLiveUpdate({ ...manifest, rollout: bucket }, device).kind).toBe('none');
    expect(decideLiveUpdate({ ...manifest, rollout: bucket + 1 }, device).kind).toBe('download');
    expect(decideLiveUpdate({ ...manifest, rollout: 0 }, device).kind).toBe('none');
  });
});
