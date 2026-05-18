---
name: android-testing
description: Android testing with testDebugUnitTest, androidTest, connectedDebugAndroidTest, Robolectric, Compose UI testing, Room migration tests, and coroutine testing. Use when adding or fixing Android tests or choosing Android verification strategy.
---

# Skill: Android Testing

- Use for JVM unit tests, instrumented tests, Compose tests, Room migration tests, and coroutine tests.
- Prefer `testDebugUnitTest` for ViewModel/repository/reducer logic.
- Use `connectedDebugAndroidTest` only when platform/device behavior matters.
- Note explicitly when emulator/device verification was not run.
- Room schema changes should trigger migration-focused tests.
