import { describe, expect, test } from "bun:test";
import { determineSkillsForMessage } from "../../src/plugin/lib/skill-loader.ts";

describe("plugin skill loader", () => {
  test("routes native Android requests to Android Kotlin skill", () => {
    const skills = determineSkillsForMessage(
      "Fix Android build error in app/src/main AndroidManifest.xml using Jetpack Compose, Room, Hilt, build.gradle.kts, and adb logcat",
    );

    expect(skills).toContain("software-engineering");
    expect(skills).toContain("android-kotlin");
  });

  test("keeps JVM language guidance when Android Kotlin files are mentioned", () => {
    const skills = determineSkillsForMessage("Perbaiki MainActivity.kt di Android app dengan Gradle Android Plugin dan KSP");

    expect(skills).toContain("android-kotlin");
    expect(skills).toContain("java-kotlin");
  });

  test("prioritizes Android release and Gradle skills for release shrinker failures", () => {
    const skills = determineSkillsForMessage("Fix Android bundleRelease R8 missing class in app/build.gradle.kts with ProGuard rules");
    expect(skills).toEqual(expect.arrayContaining(["software-engineering", "android-kotlin", "android-release", "android-gradle"]));
    expect(skills.indexOf("android-kotlin")).toBeLessThan(skills.indexOf("android-release"));
  });

  test("routes Compose prompts to Android Compose skill", () => {
    const skills = determineSkillsForMessage("Review @Composable ProfileScreen with LaunchedEffect and collectAsStateWithLifecycle");
    expect(skills).toContain("android-kotlin");
    expect(skills).toContain("android-compose");
  });

  test("does not route Java backend prompts to Android", () => {
    const skills = determineSkillsForMessage("Fix Spring Boot UserService.java repository bug");
    expect(skills).toContain("java-kotlin");
    expect(skills).not.toContain("android-kotlin");
  });
});
