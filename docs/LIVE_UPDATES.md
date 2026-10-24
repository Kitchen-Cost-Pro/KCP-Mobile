# Live (over-the-air) updates

KCP Lite is a React/Vite web app inside a Capacitor 8 shell, so most changes (screens, styling, workflow logic, API calls) live in the web bundle. Live updates ship a new web bundle to installed apps without a Play Store or App Store release. Anything that touches native code (a new or upgraded Capacitor plugin, permissions, `AndroidManifest.xml`, `Info.plist`, icons, splash screens, signing) still needs a store release.

## How it works

- **Plugin:** [`@capgo/capacitor-updater`](https://github.com/Cap-go/capacitor-updater) in manual mode. Capgo's cloud is not used: automatic checks are off and statistics reporting is disabled (`statsUrl: ''`) in `capacitor.config.ts`.
- **Hosting:** an assets-only Cloudflare Worker (`kcp-lite-updates`) with no Worker script. Cloudflare states that requests to static assets are free and unlimited on every Workers plan, and an assets-only Worker never runs a script, so serving update checks and downloads is not metered. Each channel has one `/<channel>/manifest.json`; bundles live at `/bundles/<version>-<hash>.zip`. Any static HTTPS host would also work; only the deploy step in the publish script is Cloudflare-specific.
- **Client (`src/core/updates`):**
  1. On launch the app calls `notifyAppReady()` first. If a new bundle fails to reach that point within 15 seconds, the plugin rolls back to the last working bundle automatically and the failed version is never retried.
  2. It then fetches the channel manifest, and again on foreground at most every 30 minutes.
  3. If the manifest offers a different, compatible bundle, it downloads it in the background, verifies the SHA-256 checksum, and queues it for the **next cold start**. A running Stock Take, GRV or transfer is never reloaded under the user.
- **Compatibility gate:** every manifest carries `minNativeBuild` (Android `versionCode` / iOS `CFBundleVersion`). Devices on an older store build ignore the bundle. When users install a new store build, any downloaded bundles are discarded (`resetWhenUpdate`).
- **Staged rollout:** `rollout` (0–100) selects a stable percentage of devices per version.
- **Rollback:** publish an older version to the channel, publish the store build's own version (devices return to the builtin bundle), or publish the kill switch (`--reset`), which returns every device to its store bundle on next launch.

## Manifest format

```json
{
  "version": "0.22.1",
  "url": "https://updates.kitchencostpro.com/bundles/0.22.1-6ab99cfd184b.zip",
  "sha256": "6ab99cfd184b7f1ed283eaf61c0c246fabe92200a46edc00af0a95b5f8bd3cf8",
  "minNativeBuild": 20,
  "rollout": 100,
  "releasedAt": "2026-10-24T02:32:14.624Z"
}
```

Kill switch: `{ "resetToBuiltin": true }`.

## One-time setup

1. Pick the address: either the free `https://kcp-lite-updates.<your-subdomain>.workers.dev`, or a custom domain such as `updates.kitchencostpro.com` (pass `--domain updates.kitchencostpro.com` on publish).
2. Set `VITE_KCP_OTA_BASE_URL` to that address (and optionally `VITE_KCP_OTA_CHANNEL`, default `production`) in the environment used for production builds.
3. Ship one store release that contains this plugin. Live updates only reach devices running that build or later. Until `VITE_KCP_OTA_BASE_URL` is set, the app never checks for updates.

For a test build, set `VITE_KCP_OTA_CHANNEL=staging` so testers receive staging bundles before production.

## Publishing an update

```bash
npm run check
npm run build
# writes ota-out/site and prints the deploy command
npm run ota:publish -- --channel staging --base-url https://updates.kitchencostpro.com --version 0.22.1
# or deploy directly (requires `wrangler login` or CLOUDFLARE_API_TOKEN)
npm run ota:publish -- --channel production --version 0.22.1 --rollout 10 --deploy
```

A deploy replaces every file on the update Worker, so the script first downloads each channel's live manifest (`--channels`, default `production,staging`) and the bundle it points at, verifies its checksum, and redeploys them alongside the new one. Older bundles drop off automatically.

Options: `--min-native-build` (defaults to the current Android/iOS build number), `--max-native-build`, `--rollout`, `--notes`, `--reset`, `--worker` (default `kcp-lite-updates`), `--domain`, `--channels`. `KCP_OTA_BASE_URL` and `KCP_OTA_WORKER` can replace the flags.

Bump `--version` for every publish. Raise the rollout by re-running the command with the same version and a higher `--rollout`.

## Rules for what may ship over the air

- Web-only changes: yes. Native plugin additions or upgrades: no, use a store release and raise `minNativeBuild`.
- Store policy: Apple (guideline 3.3.1(b)/4.7) and Google Play allow interpreted web code updates that do not change the app's primary purpose or bypass review. Use live updates for fixes and workflow improvements, not to launch a substantially different app.
- Keep the Worker backward compatible with the oldest bundle still on the channel, as today.

## Cost

Hosting on Workers static assets has no usage charge: Cloudflare's [static assets billing page](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) states that requests to static assets are free and unlimited, and only requests that invoke a Worker script are billed. This Worker has no script. Limits: 25 MiB per file and 100,000 files per version on Workers Paid (20,000 on Free); a bundle is about 11 MB and the script refuses one over 25 MiB.

To guard against any misconfiguration, set a Cloudflare budget alert (Billing → Budget alerts) at $1.

## Follow-ups

- **Bundle signing:** checksums stop corrupted or truncated downloads, but whoever controls the Cloudflare account controls the code. Capgo supports RSA-signed, encrypted bundles (`publicKey` in config plus `npx @capgo/cli bundle encrypt`); adding that removes the hosting account as a single point of compromise.
- **Smaller downloads:** the bundle is about 11 MB, mostly the background PNGs. Converting them to WebP or shipping them only in the store build would cut each update to roughly 1 MB.
- **CI publishing:** a GitHub Actions workflow on release tags can run `npm run ota:publish -- --deploy` with a Cloudflare API token secret.
