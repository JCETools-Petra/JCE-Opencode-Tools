---
name: android-release
description: Android release builds, bundleRelease, assembleRelease, APK, AAB, signingConfig, keystore, R8, ProGuard, mapping.txt, versionCode, versionName, and Play Console readiness. Use for release-sensitive Android changes.
---

# Skill: Android Release

- Use for APK/AAB packaging, signing, R8/ProGuard, versioning, and Play Console readiness.
- Never treat debug verification as enough for release-sensitive changes.
- Verify with `./gradlew :app:bundleRelease` and `./gradlew :app:lintVitalRelease`.
- Watch for keep rules, missing classes, signing mismatches, and versionCode/versionName drift.
- Call out release-only gaps explicitly.
