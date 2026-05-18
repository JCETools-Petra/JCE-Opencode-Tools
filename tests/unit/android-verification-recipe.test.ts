import { describe, expect, test } from "bun:test";
import { buildAndroidVerificationRecipe, detectAndroidChangeKinds } from "../../src/plugin/lib/android/verification-recipe.ts";

describe("Android verification recipe", () => {
  test("detects Kotlin ViewModel changes and recommends unit/build verification", () => {
    const recipe = buildAndroidVerificationRecipe({ files: ["app/src/main/java/com/example/ProfileViewModel.kt"] });
    expect(recipe.detected).toBe(true);
    expect(recipe.module).toBe(":app");
    expect(recipe.changeKinds).toContain("kotlin");
    expect(recipe.commands.map((item) => item.command)).toContain("./gradlew :app:testDebugUnitTest");
    expect(recipe.commands.map((item) => item.command)).toContain("./gradlew :app:assembleDebug");
  });

  test("adds release verification for R8 and AAB changes", () => {
    const recipe = buildAndroidVerificationRecipe({ prompt: "fix bundleRelease R8 missing class for AAB release" });
    expect(recipe.changeKinds).toContain("release");
    expect(recipe.changeKinds).toContain("r8-proguard");
    expect(recipe.commands.map((item) => item.command)).toContain("./gradlew :app:bundleRelease");
    expect(recipe.commands.map((item) => item.command)).toContain("./gradlew :app:lintVitalRelease");
  });

  test("detects no Android context for normal TypeScript files", () => {
    expect(detectAndroidChangeKinds({ files: ["src/index.ts"] })).toEqual([]);
    expect(buildAndroidVerificationRecipe({ files: ["src/index.ts"] }).detected).toBe(false);
  });
});
