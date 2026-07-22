#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

cd "$ROOT"
npm ci
npm run check
npm run release:verify
npm run cap:sync

[[ -f android/keystore.properties ]] || fail "android/keystore.properties is required; copy docs/release/keystore.properties.example and use secure values."
[[ -f android/app/google-services.json ]] || fail "Android Firebase google-services.json is required for push notifications."
(cd android && ./gradlew clean bundleRelease)
jarsigner -verify -strict android/app/build/outputs/bundle/release/app-release.aab >/dev/null
printf 'Android release verified: android/app/build/outputs/bundle/release/app-release.aab\n'

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'iOS archive skipped: run this same command on the authorised macOS signing runner.\n'
  exit 0
fi
[[ -f ios/App/App/GoogleService-Info.plist ]] || fail "iOS Firebase GoogleService-Info.plist is required for push notifications."
[[ -n "${KCP_IOS_TEAM_ID:-}" ]] || fail "KCP_IOS_TEAM_ID is required for iOS signing."
[[ -f "${KCP_IOS_EXPORT_OPTIONS_PLIST:-}" ]] || fail "KCP_IOS_EXPORT_OPTIONS_PLIST must point to an approved export options plist."
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -archivePath "$ROOT/release/KCPLite.xcarchive" DEVELOPMENT_TEAM="$KCP_IOS_TEAM_ID" -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath "$ROOT/release/KCPLite.xcarchive" -exportPath "$ROOT/release/ios" -exportOptionsPlist "$KCP_IOS_EXPORT_OPTIONS_PLIST" -allowProvisioningUpdates
codesign --verify --deep --strict "$ROOT/release/KCPLite.xcarchive/Products/Applications/App.app"
printf 'iOS release verified: release/ios\n'
