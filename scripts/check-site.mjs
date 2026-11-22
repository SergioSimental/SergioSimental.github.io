// Checks the built site in _site/: every local link, image, script, font and
// video it references must exist. Exits with an error (failing CI) if not.
// Usage: npm run build && npm run check
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const OUT = "_site";
const prefix = (process.env.PATH_PREFIX || "/").replace(/\/?$/, "/");
// Files that are allowed to be missing (you add them yourself later).
const OPTIONAL = new Set(["/resume.pdf"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function toFile(url, fromFile) {
  url = url.split("#")[0].split("?")[0];
  if (!url || /^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) return null;
  let rel;
  if (url.startsWith("/")) {
    if (!url.startsWith(prefix)) return { url, missingPrefix: true };
    rel = url.slice(prefix.length);
  } else {
    rel = path.relative(OUT, path.join(path.dirname(fromFile), url));
  }
  let file = path.join(OUT, decodeURIComponent(rel));
  if (url.endsWith("/") || (existsSync(file) && statSync(file).isDirectory())) file = path.join(file, "index.html");
  return { url, file, site: "/" + rel };
}

const problems = [];
const files = walk(OUT);
if (!files.some((f) => f.endsWith(".html"))) problems.push("No HTML files found — did the build run?");

for (const f of files.filter((f) => /\.(html|css)$/.test(f))) {
  const text = readFileSync(f, "utf8");
  const urls = [];
  if (f.endsWith(".html")) {
    for (const m of text.matchAll(/\s(?:href|src|poster|data-demo)="([^"]+)"/g)) urls.push(m[1]);
    for (const m of text.matchAll(/\ssrcset="([^"]+)"/g))
      m[1].split(",").forEach((part) => urls.push(part.trim().split(/\s+/)[0]));
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text))
      problems.push(`${f}: still loads Google Fonts (fonts are self-hosted now)`);
  } else {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) urls.push(m[1]);
  }
  for (const u of urls) {
    const t = toFile(u, f);
    if (!t) continue;
    if (t.missingPrefix) { problems.push(`${f}: ${u} is missing the "${prefix}" path prefix`); continue; }
    if (OPTIONAL.has(t.site)) continue;
    if (!existsSync(t.file)) problems.push(`${f}: ${u} → not found`);
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) in ${OUT}/:\n  ` + [...new Set(problems)].join("\n  "));
  process.exit(1);
}
console.log(`✓ ${files.length} files checked in ${OUT}/ — all links and assets resolve.`);
