#!/usr/bin/env node
// Checks that EVERY file in the repo belongs to exactly one thread.
//
//   node .claude/threads/check-ownership.mjs            full check (exit 1 when a file is unowned/conflicting)
//   node .claude/threads/check-ownership.mjs --who <path>   which thread owns this file?
//   node .claude/threads/check-ownership.mjs --summary      file count per thread
//   node .claude/threads/check-ownership.mjs --files list.txt   check a list of paths instead of git
//
// Source of truth: .claude/threads/ownership.json
// When several patterns match, the most specific wins (exact path beats glob; longer literal text beats shorter).
// Two different threads matching with equal specificity is reported as a conflict.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const config = JSON.parse(fs.readFileSync(path.join(here, "ownership.json"), "utf8"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

function globToRegex(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; out += "(?:.*/)?"; } else out += ".*";
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const specificity = (glob) => (/[*?]/.test(glob) ? glob.replace(/[*?]/g, "").length : 10000 + glob.length);

const rules = [];
for (const [thread, def] of Object.entries(config.threads)) for (const p of def.paths) rules.push({ thread, glob: p, re: globToRegex(p), score: specificity(p) });
for (const p of config.governance.paths) rules.push({ thread: "(governance)", glob: p, re: globToRegex(p), score: specificity(p) });
const ignores = config.ignore.map(globToRegex);

function owner(file) {
  const hits = rules.filter((r) => r.re.test(file));
  if (!hits.length) return { threads: [], hits };
  const best = Math.max(...hits.map((h) => h.score));
  const top = hits.filter((h) => h.score === best);
  return { threads: [...new Set(top.map((h) => h.thread))], hits: top };
}

const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");

if (valueOf("--who")) {
  const file = norm(valueOf("--who"));
  const { threads, hits } = owner(file);
  if (ignores.some((re) => re.test(file))) console.log(`${file}\n  ignored (build output, secret, or runtime data)`);
  else if (!threads.length) console.log(`${file}\n  NO OWNER - add it to .claude/threads/ownership.json`);
  else console.log(`${file}\n  owner: ${threads.join(" / ")}   (matched ${hits.map((h) => h.glob).join(", ")})`);
  process.exit(0);
}

let files;
if (valueOf("--files")) files = fs.readFileSync(valueOf("--files"), "utf8").split(/\r?\n/).filter(Boolean).map(norm);
else files = execSync("git ls-files -co --exclude-standard", { cwd: repoRoot, encoding: "utf8", maxBuffer: 1 << 28 }).split(/\r?\n/).filter(Boolean).map(norm);

const unowned = [], conflicts = [], counts = {};
let ignored = 0;
for (const file of files) {
  if (ignores.some((re) => re.test(file))) { ignored++; continue; }
  const { threads } = owner(file);
  if (!threads.length) unowned.push(file);
  else if (threads.length > 1) conflicts.push(`${file}  ->  ${threads.join(" vs ")}`);
  else counts[threads[0]] = (counts[threads[0]] || 0) + 1;
}

// A pattern that matches no file is a typo, a deleted file, or a path reserved for something not built yet.
const dead = rules.filter((r) => !files.some((f) => r.re.test(f)));

if (flag("--summary")) for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), t);

console.log(`Checked ${files.length} files (${ignored} ignored).`);
if (unowned.length) { console.log(`\nUNOWNED (${unowned.length}) - add these to a thread in ownership.json:`); unowned.forEach((f) => console.log("  " + f)); }
if (conflicts.length) { console.log(`\nCONFLICTS (${conflicts.length}) - two threads claim the same file at equal specificity:`); conflicts.forEach((f) => console.log("  " + f)); }
if (dead.length) { console.log(`\nInfo - patterns that match no file right now (fine if reserved for future files, otherwise a typo):`); dead.forEach((r) => console.log(`  ${r.thread}: ${r.glob}`)); }
if (!unowned.length && !conflicts.length) console.log("OK: every file has exactly one owner.");
process.exit(unowned.length || conflicts.length ? 1 : 0);
