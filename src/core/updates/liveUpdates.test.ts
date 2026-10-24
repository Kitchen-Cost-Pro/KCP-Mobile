import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, getLiveUpdateStatus, liveUpdatesConfigured } from './liveUpdates';

describe('live update status', () => {
  it('reports the package version baked into the bundle and stays off in the browser', async () => {
    const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
    expect(APP_VERSION).toBe(packageVersion);
    expect(liveUpdatesConfigured()).toBe(false);
    await expect(getLiveUpdateStatus()).resolves.toEqual({ webVersion: packageVersion, nativeBuild: null, pendingVersion: null });
  });
});
