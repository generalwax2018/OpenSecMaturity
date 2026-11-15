// Fails when the app, package, and catalog versions disagree, or when a
// release tag (passed as the first argument) does not match them.
//   node scripts/check-versions.mjs            check the files agree
//   node scripts/check-versions.mjs v2026.11.14   also check the tag
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const versions = {
  "web/package.json": JSON.parse(read("../package.json")).version,
  "web/public/app.json": JSON.parse(read("../public/app.json")).version,
  "catalog/version.json": JSON.parse(read("../../catalog/version.json")).version,
  "web/src/data/app-meta.ts": /APP_VERSION = "([^"]+)"/.exec(read("../src/data/app-meta.ts"))?.[1],
};
const tag = process.argv[2];
const distinct = new Set(Object.values(versions));
const problems = [];
if (distinct.size !== 1) problems.push("versions disagree: " + JSON.stringify(versions));
const [version] = distinct;
if (!/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(version ?? "")) problems.push("version must look like 2026.11.14 or 2026.11.14.2");
if (tag && tag !== "v" + version) problems.push("tag " + tag + " does not match version " + version);
if (!read("../../CHANGELOG.md").includes("## " + version)) problems.push("CHANGELOG.md has no section for " + version);
for (const line of problems) console.error("error    " + line);
if (problems.length > 0) process.exit(1);
console.log("versions agree: " + version + (tag ? " (tag " + tag + ")" : ""));
