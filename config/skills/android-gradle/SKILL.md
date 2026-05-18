---
name: android-gradle
description: Android Gradle, AGP, build.gradle, settings.gradle, libs.versions.toml, KSP, KAPT, dependency resolution, duplicate class, variant mismatch, and multi-module Android build debugging. Use when working on Android build configuration or Gradle failures.
---

# Skill: Android Gradle

- Use for `build.gradle(.kts)`, `settings.gradle(.kts)`, `libs.versions.toml`, AGP, Kotlin, KSP, KAPT, dependency graph, and variant/build failures.
- Check AGP/Kotlin/KSP compatibility before changing versions.
- Prefer `dependencyInsight` over blind excludes.
- Verify with `./gradlew :app:assembleDebug`, `./gradlew :app:dependencies`, and targeted `dependencyInsight`.
- Treat duplicate class, no matching variant, and could not resolve as dependency graph problems first.
