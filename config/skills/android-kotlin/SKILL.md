---
name: android-kotlin
description: Android app development with Kotlin, Java, Gradle Android Plugin, Jetpack Compose, XML Views, AndroidManifest.xml, Room, Hilt, WorkManager, testing, performance, release builds, and native/interop code. Use when working on Android apps, Android builds, APK/AAB, adb/logcat, Android Studio projects, app/src/main, build.gradle(.kts), or Android platform APIs.
---

# Skill: Android Kotlin / Android Apps

# Loaded on-demand for native Android apps, Kotlin/Java Android code, Jetpack Compose, XML Views, Gradle Android Plugin, AndroidManifest.xml, Room, Hilt, WorkManager, adb/logcat, APK/AAB builds, and Android app release/debug work.

---

## Auto-Detect

Trigger this skill when any of these appear:
- Paths: `app/src/main/`, `app/src/test/`, `app/src/androidTest/`, `AndroidManifest.xml`, `MainActivity.kt`, `MainActivity.java`, `res/layout/`, `res/values/`, `res/drawable/`, `jniLibs/`, `src/main/cpp/`
- Build files/plugins: `settings.gradle`, `settings.gradle.kts`, `build.gradle`, `build.gradle.kts`, `com.android.application`, `com.android.library`, `com.android.test`, `org.jetbrains.kotlin.android`, `com.google.devtools.ksp`, `kapt`, `com.google.dagger.hilt.android`
- Android APIs: `android.`, `androidx.`, `Activity`, `Fragment`, `ViewModel`, `LiveData`, `Flow`, `Room`, `DataStore`, `WorkManager`, `Hilt`, `Navigation`, `Paging`, `CameraX`, `Media3`
- Commands/errors: `./gradlew assembleDebug`, `connectedAndroidTest`, `adb`, `logcat`, `lintVitalRelease`, `minSdk`, `targetSdk`, `compileSdk`, `R8`, `ProGuard`, `ANR`, `StrictMode`
- Artifacts: `.apk`, `.aab`, `mapping.txt`, Play Console, signing config, release keystore

---

## Android Language Coverage

Android app work may involve several languages. Route by file/context:

| Area | Files | Use Guidance |
|---|---|---|
| Kotlin Android | `.kt`, `.kts` | Primary Android app language; prefer coroutines, Flow, sealed UI state, extension functions used sparingly. |
| Java Android | `.java` | Maintain interoperability; avoid introducing Kotlin-only patterns in Java modules unless migration is intended. |
| Gradle | `.gradle`, `.gradle.kts`, `settings.gradle(.kts)`, version catalogs | Treat build changes as high-impact; keep plugin/dependency versions centralized. |
| XML resources | `res/layout`, `res/values`, `AndroidManifest.xml`, drawables, navigation XML | Validate resource references, themes, permissions, exported components, and configuration qualifiers. |
| C/C++ NDK | `src/main/cpp`, `CMakeLists.txt`, `.c`, `.cpp`, `.h` | Watch ABI splits, JNI ownership, memory safety, CMake flags, and native crash symbols. |
| Rust via JNI/UniFFI | `.rs`, `Cargo.toml`, generated bindings | Keep FFI boundaries narrow; validate threading, ownership, and packaging of `.so` outputs. |
| Dart/Flutter module | `.dart`, Flutter module inside Android host | Use `flutter-dart` skill too; isolate host Android code from Flutter module behavior. |
| JavaScript/TypeScript bridges | React Native/Hybrid modules | Use `react-native`/`typescript` skill too; validate native module lifecycle and thread boundaries. |

When Android context is present, prefer this skill plus the relevant language/framework skill.

---

## Default Architecture

Prefer a small, testable, offline-aware architecture:
- UI: Jetpack Compose for new UI; XML/ViewBinding only for existing/legacy screens.
- State: `ViewModel` exposes immutable `StateFlow<UiState>` or Compose state holders; no mutable state leaks to UI.
- Domain: use cases are optional; add them only when business rules are shared or non-trivial.
- Data: repositories isolate network, Room, DataStore, file I/O, and platform APIs.
- DI: Hilt with constructor injection; avoid service locator singletons.
- Persistence: Room for relational/offline source of truth; DataStore for preferences/proto settings.
- Background: WorkManager for deferrable reliable work; foreground services only for active user-visible work.
- Navigation: Navigation Compose or typed navigation; keep route args small and serializable.

```kotlin
data class ProfileUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: UserRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState(isLoading = true))
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    fun load(userId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            repository.user(userId)
                .onSuccess { user -> _uiState.update { it.copy(isLoading = false, user = user) } }
                .onFailure { error -> _uiState.update { it.copy(isLoading = false, errorMessage = error.message) } }
        }
    }
}
```

---

## Jetpack Compose Rules

- UI is a function of state; keep composables deterministic.
- Hoist state to the lowest common owner; reusable composables should be stateless when possible.
- Collect flows with `collectAsStateWithLifecycle()`.
- Use `LaunchedEffect(key)`, `DisposableEffect`, and `rememberUpdatedState` deliberately for side effects.
- Never launch coroutines directly in composable bodies.
- Use stable keys in lazy lists; avoid heavy work in composition.
- Accessibility is part of done: content descriptions, semantic roles, touch target size, dynamic type, contrast.

```kotlin
@Composable
fun ProfileScreen(
    userId: String,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(userId) {
        viewModel.load(userId)
    }

    ProfileContent(
        state = state,
        onRetry = { viewModel.load(userId) },
    )
}
```

---

## XML Views And Resources

- Prefer ViewBinding over `findViewById` in legacy Views.
- Keep XML constraints explicit; test small/large screens, landscape, RTL, and font scaling.
- Use resource qualifiers intentionally: `values-night`, `layout-sw600dp`, `drawable-anydpi`, locale folders.
- Do not hardcode strings, dimensions, colors, or user-visible text in Kotlin/Java.
- Check `AndroidManifest.xml` for least-privilege permissions and `android:exported` correctness.

Manifest safety checklist:
- Components with intent filters explicitly set `android:exported`.
- Deep links validate input and auth state.
- Permissions are minimal and runtime permissions are requested contextually.
- Backup/network/security config is intentional.

---

## Coroutines, Flow, And Threading

- Use structured concurrency: `viewModelScope`, `lifecycleScope`, injected application scope for app-wide jobs.
- Never use `GlobalScope`.
- Blocking I/O belongs in repositories and `Dispatchers.IO`.
- CPU-heavy work uses `Dispatchers.Default` or dedicated execution.
- Use `stateIn`/`shareIn` for UI state streams with lifecycle-aware sharing.
- Handle cancellation; do not swallow `CancellationException`.

```kotlin
val uiState: StateFlow<FeedUiState> = repository.observeFeed()
    .map { items -> FeedUiState(items = items) }
    .catch { error -> emit(FeedUiState(errorMessage = error.message)) }
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = FeedUiState(isLoading = true),
    )
```

---

## Persistence And Offline Behavior

- Room is the source of truth for relational/offline data.
- Use transactions for multi-table updates.
- Keep entities separate from domain models when API/database shape differs from UI needs.
- DataStore is for small preferences/config, not queryable app data.
- Migrations must be deterministic and tested.

```kotlin
@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE id = :id")
    fun observeUser(id: String): Flow<UserEntity?>

    @Upsert
    suspend fun upsert(user: UserEntity)
}
```

---

## Gradle Android Build Guidance

- Prefer Gradle Kotlin DSL and version catalogs for new projects.
- Keep `compileSdk`, `targetSdk`, `minSdk`, AGP, Kotlin, KSP, Compose compiler, and Hilt versions compatible.
- Build logic belongs in convention plugins for multi-module projects.
- Avoid dynamic dependency versions (`+`).
- Treat signing config, keystores, and API keys as secrets; never commit them.
- Validate both debug and release paths when touching build config.

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "com.example.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
}
```

Common verification commands:
- `./gradlew :app:assembleDebug`
- `./gradlew :app:testDebugUnitTest`
- `./gradlew :app:lintDebug`
- `./gradlew :app:connectedDebugAndroidTest` (requires device/emulator)
- `./gradlew :app:bundleRelease` and `lintVitalRelease` for release-sensitive changes

---

## Testing Strategy

- JVM unit tests: ViewModels, reducers, use cases, mappers, repositories with fakes.
- Coroutine tests: `kotlinx-coroutines-test`, `runTest`, test dispatcher, `advanceUntilIdle()`.
- Room tests: in-memory database, migration tests.
- Compose UI tests: semantics and critical user journeys.
- Instrumented tests: platform integration, permissions, storage, camera/location, notifications.
- Screenshot tests: design-system or layout-sensitive screens when available.

```kotlin
@Test
fun load_updatesStateWithUser() = runTest {
    val repository = FakeUserRepository(User(id = "1", name = "Ada"))
    val viewModel = ProfileViewModel(repository)

    viewModel.load("1")
    advanceUntilIdle()

    assertEquals("Ada", viewModel.uiState.value.user?.name)
}
```

---

## Debugging Workflow

1. Reproduce with the smallest command or device flow.
2. Read the full Gradle/stacktrace/logcat output; do not guess from the final line only.
3. Identify layer: Gradle config, compilation, resource merge, manifest merge, runtime crash, ANR, network, storage, rendering, release shrinker.
4. Make one focused fix.
5. Re-run the smallest failing command, then a wider command proportional to risk.

Useful commands:
- `./gradlew :app:dependencies`
- `./gradlew :app:dependencyInsight --dependency <name> --configuration debugRuntimeClasspath`
- `./gradlew :app:processDebugMainManifest --info`
- `adb logcat`
- `adb shell dumpsys activity`, `adb shell dumpsys package <id>`

---

## Performance, Reliability, And Security

- Avoid main-thread I/O; use StrictMode in debug when possible.
- Watch recomposition hotspots, unstable parameters, large bitmaps, and unbounded lazy lists.
- Use Paging for large data sets.
- Handle process death: persist critical state and avoid assuming singleton state survives.
- Runtime permissions must be least-privilege and explainable to users.
- Do not store secrets in APK/AAB; use backend-issued tokens and secure server-side controls.
- Use EncryptedSharedPreferences/DataStore only for appropriate local secrets; hardware-backed security varies by device.
- Network security config, certificate pinning, and cleartext traffic must be intentional.

---

## NDK / JNI / Native Interop

- Keep JNI surface small and typed; validate inputs on both Java/Kotlin and native sides.
- Manage ownership and lifetimes explicitly; avoid leaking global refs.
- Package correct ABIs and symbol files for crash reporting.
- Use sanitizers/debug symbols for native crash investigation when feasible.
- Verify CMake/Gradle integration after changing native code.

---

## Review Checklist

- [ ] Correct skill/language context loaded for Kotlin, Java, Gradle, XML, C/C++, Rust, Flutter, or React Native Android code.
- [ ] UI state is immutable and lifecycle-aware.
- [ ] Side effects are outside composable bodies and lifecycle-safe.
- [ ] Repository boundaries isolate network/database/preferences/platform APIs.
- [ ] Main thread is not blocked by I/O or heavy computation.
- [ ] Manifest permissions/components are least-privilege and exported status is intentional.
- [ ] Build config changes are compatible across AGP/Kotlin/KSP/Compose/Hilt versions.
- [ ] Tests or verification commands match the touched layer.
- [ ] Release changes account for signing, R8/ProGuard, mapping files, `versionCode`, and Play requirements.

---

## Common Pitfalls

| Pitfall | Risk | Prefer |
|---|---|---|
| Coroutine launched in composable body | repeated side effects, leaks | `LaunchedEffect`, ViewModel events |
| `GlobalScope` | leaks, unbounded work | structured scopes |
| Blocking main thread | ANR/jank | repository + dispatcher boundary |
| Secrets in APK | extractable credentials | backend-issued tokens/server config |
| Untested Room migration | production data loss | migration tests |
| Only debug build verified | release shrink/signing breakage | release build/lint when build config changes |
| Random XML/Compose mixing | inconsistent state/lifecycle | isolate legacy Views or migrate deliberately |
| Broad Gradle version bumps | dependency breakage | compatibility matrix and focused verification |
