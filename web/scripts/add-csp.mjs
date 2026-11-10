// Adds a strict Content-Security-Policy to the single-file build.
// The page may run only its own inlined script (pinned by hash) and may
// connect only to GitHub for the optional update check.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../dist/index.html", import.meta.url));
let html = readFileSync(file, "utf8");

const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((body) => body.trim().length > 0)
  .map((body) => "'sha256-" + createHash("sha256").update(body, "utf8").digest("base64") + "'");

if (hashes.length === 0) throw new Error("add-csp: no inline scripts found in dist/index.html");

const policy = [
  "default-src 'none'",
  "script-src " + hashes.join(" "),
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/g, "");
html = html.replace(/<meta charset="utf-8"\s*\/?>/i, (tag) => tag + '\n    <meta http-equiv="Content-Security-Policy" content="' + policy + '" />');
if (!html.includes("Content-Security-Policy")) throw new Error("add-csp: could not insert the policy");
writeFileSync(file, html);
console.log("add-csp: policy added with " + hashes.length + " script hash(es)");
