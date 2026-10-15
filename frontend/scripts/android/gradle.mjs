// Runs a Gradle task in android/ with a JDK 21 and Android SDK, then reports
// where the APK is.
//
// JAVA_HOME and ANDROID_HOME are used when set. Otherwise the user-local
// toolchain in %LOCALAPPDATA%\audito-android-toolchain (jdk-21, sdk) is used,
// or Android Studio's bundled JDK and default SDK location.
//
// Usage: node scripts/android/gradle.mjs assembleDebug

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const androidDir = path.join(frontend, "android");
const task = process.argv[2] || "assembleDebug";
if (!/^[A-Za-z][A-Za-z0-9:]*$/.test(task)) {
  console.error(`Unexpected Gradle task name: ${task}`);
  process.exit(1);
}

function fail(message) {
  console.error(`\nAndroid build stopped: ${message}\n`);
  process.exit(1);
}

const firstExisting = (...candidates) => candidates.find((candidate) => candidate && fs.existsSync(candidate));
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const toolchain = path.join(localAppData, "audito-android-toolchain");

const javaHome = firstExisting(
  process.env.JAVA_HOME,
  path.join(toolchain, "jdk-21"),
  "C:\\Program Files\\Android\\Android Studio\\jbr",
);
const androidHome = firstExisting(
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(toolchain, "sdk"),
  path.join(localAppData, "Android", "Sdk"),
);
if (!javaHome) fail("no JDK found. Install JDK 21 and set JAVA_HOME.");
if (!androidHome) fail("no Android SDK found. Install it and set ANDROID_HOME.");
if (!fs.existsSync(path.join(androidDir, "gradlew"))) fail("android/ is missing. Run: npx cap add android");

const javaExe = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
const version = spawnSync(javaExe, ["-version"], { encoding: "utf8" });
const major = Number(/version "(\d+)/.exec(`${version.stderr}${version.stdout}`)?.[1]);
if (major !== 21) fail(`JDK 21 is required (found ${major || "unknown"} at ${javaHome}).`);

// local.properties is machine specific and ignored by git.
const localProps = path.join(androidDir, "local.properties");
fs.writeFileSync(localProps, `sdk.dir=${androidHome.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}\n`);

console.log(`JDK:         ${javaHome}`);
console.log(`Android SDK: ${androidHome}`);

// Full path: some shells do not run programs from the current directory by name.
// Windows runs the .bat through cmd as one command line (the task name is checked above).
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome };
const result = process.platform === "win32"
  ? spawnSync(`"${path.join(androidDir, "gradlew.bat")}" ${task} --no-daemon`, { cwd: androidDir, env, stdio: "inherit", shell: true })
  : spawnSync(path.join(androidDir, "gradlew"), [task, "--no-daemon"], { cwd: androidDir, env, stdio: "inherit" });
if (result.status !== 0) fail(`gradle ${task} failed.`);

const outputs = path.join(androidDir, "app", "build", "outputs", "apk");
const apks = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".apk")) apks.push(full);
  }
};
walk(outputs);
for (const apk of apks) console.log(`APK: ${apk} (${(fs.statSync(apk).size / 1024 / 1024).toFixed(1)} MB)`);
