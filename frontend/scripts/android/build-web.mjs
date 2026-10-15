// Builds the web bundle for the Audito Auditor Android app into android-web/.
//
// Reads frontend/.env.android, refuses unsafe API addresses (missing, not
// HTTPS, localhost or the emulator host), runs the static Next.js export with
// NEXT_PUBLIC_APP_TARGET=android, and checks the result.
//
// Usage: npm run android:web

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSecretLikeContent, validateAndroidAddress } from "./checks.mjs";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const configFile = path.join(frontend, ".env.android");
const outDir = path.join(frontend, "android-web");

function fail(message) {
  console.error(`\nAndroid web build stopped: ${message}\n`);
  process.exit(1);
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(frontend, file)} is missing.`);
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith("#")) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const config = readEnvFile(configFile);
const allowed = new Set(["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_MEDIA_URL"]);
for (const key of Object.keys(config)) {
  if (!allowed.has(key)) fail(`.env.android may only set ${[...allowed].join(" and ")} (found ${key}).`);
}

const apiProblem = validateAndroidAddress(config.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL");
if (apiProblem) fail(apiProblem);
if (!/\/api\/?$/.test(config.NEXT_PUBLIC_API_URL)) fail("NEXT_PUBLIC_API_URL must end with /api.");
if (config.NEXT_PUBLIC_MEDIA_URL) {
  const mediaProblem = validateAndroidAddress(config.NEXT_PUBLIC_MEDIA_URL, "NEXT_PUBLIC_MEDIA_URL");
  if (mediaProblem) fail(mediaProblem);
}

const apiUrl = config.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
const mediaUrl = (config.NEXT_PUBLIC_MEDIA_URL || apiUrl.replace(/\/api$/, "")).replace(/\/+$/, "");
console.log(`Android API:   ${apiUrl}`);
console.log(`Android media: ${mediaUrl}`);

fs.rmSync(outDir, { recursive: true, force: true });

// Explicit values win over frontend/.env (Next.js never overrides variables already set).
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_TARGET: "android",
  NEXT_PUBLIC_API_URL: apiUrl,
  NEXT_PUBLIC_MEDIA_URL: mediaUrl,
};
const nextBin = path.join(frontend, "node_modules", "next", "dist", "bin", "next");
const build = spawnSync(process.execPath, [nextBin, "build"], { cwd: frontend, env, stdio: "inherit" });
if (build.status !== 0) fail("next build failed.");

if (!fs.existsSync(path.join(outDir, "index.html"))) fail("android-web/index.html was not produced.");
for (const page of ["login", "dashboard", "my-audits", "my-audits/execute", "my-caps", "ai-site-scan", "profile"]) {
  if (!fs.existsSync(path.join(outDir, page, "index.html"))) fail(`android-web/${page}/index.html was not produced.`);
}

// The bundle must carry the configured API and nothing secret.
const scripts = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|html|json|txt|map)$/.test(entry.name)) scripts.push(full);
  }
};
walk(outDir);
// Source maps are not needed in the app (Next.js emits one for its polyfills); none are shipped.
const maps = scripts.filter((file) => file.endsWith(".map"));
for (const map of maps) fs.rmSync(map);
if (maps.length) console.log(`Removed ${maps.length} source map(s) from android-web.`);
let hasApi = false;
for (const file of scripts.filter((file) => !file.endsWith(".map"))) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes(apiUrl)) hasApi = true;
  const secret = findSecretLikeContent(text);
  if (secret) fail(`${path.relative(frontend, file)} contains ${secret}.`);
}
if (!hasApi) fail(`the bundle does not contain ${apiUrl}.`);

console.log("\nAndroid web bundle ready in android-web/ (configured API found, no secrets detected).");
