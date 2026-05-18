import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanAndroidProject } from "../../src/plugin/lib/android/project-scanner.ts";

function fixture(): string {
  return mkdtempSync(join(tmpdir(), "opencode-jce-android-scan-"));
}

describe("Android project scanner", () => {
  test("detects a single module Android Kotlin DSL project", () => {
    const root = fixture();
    try {
      mkdirSync(join(root, "app", "src", "test"), { recursive: true });
      mkdirSync(join(root, "gradle"), { recursive: true });
      writeFileSync(join(root, "gradlew"), "", "utf8");
      writeFileSync(join(root, "settings.gradle.kts"), "include(\":app\")", "utf8");
      writeFileSync(join(root, "gradle", "libs.versions.toml"), "agp = \"8.7.0\"\nkotlin = \"2.0.21\"\nksp = \"2.0.21-1.0.25\"", "utf8");
      writeFileSync(join(root, "app", "build.gradle.kts"), `plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("com.google.devtools.ksp") }
android { namespace = "com.example"; compileSdk = 35; defaultConfig { applicationId = "com.example"; minSdk = 26; targetSdk = 35 }; buildFeatures { compose = true } }
dependencies { implementation("androidx.room:room-runtime:2.6.1"); implementation("com.google.dagger:hilt-android:2.52") }`, "utf8");

      const scan = scanAndroidProject(root);
      expect(scan.detected).toBe(true);
      expect(scan.gradleWrapper.present).toBe(true);
      expect(scan.modules).toHaveLength(1);
      expect(scan.modules[0].path).toBe(":app");
      expect(scan.capabilities.compose).toBe(true);
      expect(scan.capabilities.room).toBe(true);
      expect(scan.capabilities.hilt).toBe(true);
      expect(scan.versions.agp).toBe("8.7.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns not detected for non-Android projects", () => {
    const root = fixture();
    try {
      writeFileSync(join(root, "package.json"), "{}", "utf8");
      expect(scanAndroidProject(root).detected).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
