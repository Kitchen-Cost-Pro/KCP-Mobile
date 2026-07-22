# Android Build

## Environment

Install Android Studio and the SDK required by the generated Capacitor 8 project. The current native project targets Android SDK 36 and supports API 26 or newer. Phase 3 raises the minimum to API 26 for the native barcode scanner.

Confirm Java and Android SDK configuration in Android Studio before using the command-line wrapper.

## Debug build

```bash
npm ci
npm run check
npm run cap:sync
npx cap open android
```

In Android Studio:

1. Allow Gradle sync to finish.
2. Select a physical phone or an emulator with an up-to-date System WebView.
3. Run the `app` configuration.
4. Verify `npm run api:verify` passes, the mobile D1 migration is applied, and the Worker CORS steps are complete before testing login.
5. Grant camera access when prompted and validate EAN/UPC, Code 128 and at least one custom-UOM barcode.

Command-line builds can use:

```bash
cd android
./gradlew assembleDebug
```

The resulting APK is normally located at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release

Do not commit signing credentials. Copy `docs/release/keystore.properties.example` to `android/keystore.properties`, replace every value through the secure signing environment, and install the production `android/app/google-services.json`. Group 2 is version code 20 / version 0.20.0.

Run the combined verification and signing workflow on the approved runner:

```bash
npm run release:build
```

The script runs all checks, synchronises Capacitor, creates `app-release.aab` and verifies its JAR signature. See `PRODUCTION_RELEASE.md` for iOS signing, staged deployment and rollback.
