# Releases

Android APKs are attached to [GitHub Releases](https://github.com/PrimeSalad/unhooked/releases), not committed here: each one is about 340 MB, over GitHub's 100 MB file limit. This folder keeps the notes for each build.

## v1.0.0

**Download:** [Unhooked-1.0.0-release.apk](https://github.com/PrimeSalad/unhooked/releases/download/v1.0.0/Unhooked-1.0.0-release.apk) (324 MB)

| | |
| --- | --- |
| Package | `ph.appbuilders.unhooked` |
| Version | 1.0.0 (versionCode 1) |
| Android | 7.0+ (minSdk 24, targetSdk 36) |
| CPU | arm64-v8a, armeabi-v7a, x86, x86_64 |
| Built | 2026-10-10, local Gradle release build (`./gradlew :app:assembleRelease`) |
| SHA-256 | `780c1ff9f544b2ff0a8dade92fab9ee532d9793cf91244826d5e364834bcf2f3` |

**Install**

1. Download the APK on the phone (or copy it over USB).
2. Open it and allow _Install unknown apps_ for your browser or file manager when asked.
3. Open Unhooked. To use the on-device model, go to **Ask Ginto → model settings** and tap **Download**.

Or from a computer with USB debugging on: `adb install -r Unhooked-1.0.0-release.apk`.

**Signing:** this build is signed with the default React Native debug key, for testing and demos. It installs over a local development build without losing data. A Play Store build needs its own release key.
