// Checks a built Audito Auditor APK: it carries the configured API address and
// the web pages, and nothing secret (tokens, keys, env files, source maps,
// source code). Also prints the permissions it asks for.
//
// Usage: node scripts/android/verify-apk.mjs [path/to/app.apk]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSecretLikeContent } from "./checks.mjs";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apk = path.resolve(process.argv[2] || path.join(frontend, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"));
if (!fs.existsSync(apk)) {
  console.error(`APK not found: ${apk}`);
  process.exit(1);
}

const problems = [];
const work = fs.mkdtempSync(path.join(os.tmpdir(), "audito-apk-"));
try {
  // An APK is a zip file; tar (bsdtar) on Windows 10+ and macOS/Linux unpacks it.
  const unzip = spawnSync("tar", ["-xf", apk, "-C", work], { encoding: "utf8" });
  if (unzip.status !== 0) throw new Error(`could not unpack the APK: ${unzip.stderr}`);

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(work);
  const rel = (file) => path.relative(work, file).replace(/\\/g, "/");

  const publicDir = path.join(work, "assets", "public");
  if (!fs.existsSync(path.join(publicDir, "index.html"))) problems.push("assets/public/index.html is missing");

  const forbiddenNames = /(^|\/)\.env(\.|$)|\.map$|\.(tsx?|jks|keystore|pem|p12)$|(^|\/)(local|keystore|signing)\.properties$/;
  for (const file of files) {
    if (forbiddenNames.test(rel(file))) problems.push(`unexpected file ${rel(file)}`);
  }

  const env = Object.fromEntries(fs.readFileSync(path.join(frontend, ".env.android"), "utf8")
    .split(/\r?\n/).map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)).filter(Boolean).map((m) => [m[1], m[2]]));
  const apiUrl = (env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  let hasApi = false;
  for (const file of files.filter((f) => f.startsWith(publicDir) && /\.(js|html|json|txt)$/.test(f))) {
    const text = fs.readFileSync(file, "utf8");
    if (apiUrl && text.includes(apiUrl)) hasApi = true;
    const secret = findSecretLikeContent(text);
    if (secret) problems.push(`${rel(file)} contains ${secret}`);
    if (/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text)) problems.push(`${rel(file)} contains a JWT`);
  }
  if (!hasApi) problems.push(`the configured API ${apiUrl} was not found in the web assets`);

  const config = JSON.parse(fs.readFileSync(path.join(work, "assets", "capacitor.config.json"), "utf8"));
  if (config.server?.url) problems.push(`capacitor.config.json has a live-reload server.url (${config.server.url})`);
  if (config.server?.cleartext) problems.push("capacitor.config.json allows cleartext");
  console.log(`App: ${config.appName} (${config.appId})`);
  console.log(`API: ${apiUrl}${hasApi ? " (found in the web assets)" : ""}`);
  console.log(`Web assets: ${files.filter((f) => f.startsWith(publicDir)).length} files`);

  // Permissions, via aapt from the newest installed build-tools.
  const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || "", "audito-android-toolchain", "sdk");
  const buildTools = path.join(sdk, "build-tools");
  if (fs.existsSync(buildTools)) {
    const newest = fs.readdirSync(buildTools).sort().pop();
    const aapt = path.join(buildTools, newest, process.platform === "win32" ? "aapt.exe" : "aapt");
    const dump = spawnSync(aapt, ["dump", "permissions", apk], { encoding: "utf8" });
    const permissions = [...dump.stdout.matchAll(/name='([^']+)'/g)].map((m) => m[1]).filter((p) => p.includes("permission") || p.includes("."));
    console.log(`Permissions: ${permissions.join(", ") || "(none)"}`);
    for (const broad of ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "MANAGE_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO"]) {
      if (permissions.some((p) => p.endsWith(`.${broad}`))) problems.push(`asks for broad storage permission ${broad}`);
    }
    const badging = spawnSync(aapt, ["dump", "badging", apk], { encoding: "utf8" });
    const pkg = /package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/.exec(badging.stdout);
    if (pkg) console.log(`Package: ${pkg[1]}, versionCode ${pkg[2]}, versionName ${pkg[3]}`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`\nAPK check FAILED:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAPK check passed: configured API present; no secrets, tokens, env files, source maps or keystores found.");
