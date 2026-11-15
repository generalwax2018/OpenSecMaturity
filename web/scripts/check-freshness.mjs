// Catalog freshness report: entries not reviewed recently, and source links
// that no longer work. Run weekly by .github/workflows/freshness.yml, which
// files the report as an issue.
//   node scripts/check-freshness.mjs [--days 180] [--offline] [--out report.md] [--strict]
// --offline skips the link checks. --strict exits 1 when anything is found.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const days = Number(option("--days", "180"));
const out = option("--out", "");
const offline = args.includes("--offline");
const strict = args.includes("--strict");
const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL("../../catalog/" + name, import.meta.url)), "utf8"));
const products = load("products.json");
const suites = load("suites.json");
const today = new Date();

const stale = products
  .map((product) => ({ product, age: product.lastReviewed ? Math.floor((today - Date.parse(product.lastReviewed)) / 86_400_000) : Infinity }))
  .filter((row) => row.age > days)
  .sort((a, b) => b.age - a.age);

const links = new Map();
const addLink = (url, where) => {
  if (typeof url !== "string" || !url.startsWith("https://")) return;
  links.set(url, [...(links.get(url) ?? []), where]);
};
for (const product of products) {
  for (const source of product.sources ?? []) addLink(source.url, product.id);
  addLink(product.fedramp?.source?.url, product.id + " (FedRAMP)");
  addLink(product.euResidency?.source?.url, product.id + " (EU residency)");
  for (const extension of product.extensions ?? []) addLink(extension.pricingSource?.url, product.id + " / " + extension.name);
}
for (const suite of suites) for (const source of suite.sources ?? []) addLink(source.url, "suite " + suite.id);

async function probe(url) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "OpenSecMaturity catalog link check (+https://github.com/generalwax2018/OpenSecMaturity)" },
      });
      return response.status;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const status = await attempt("HEAD");
    if (status < 400) return { status, ok: true };
    const retry = await attempt("GET");
    return { status: retry, ok: retry < 400 };
  } catch (error) {
    return { status: 0, ok: false, error: error?.name === "AbortError" ? "timed out" : String(error?.cause?.code ?? error?.message ?? error) };
  }
}

const broken = [];
const blocked = [];
if (!offline) {
  const queue = [...links.keys()];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      const result = await probe(url);
      if (result.ok) continue;
      // Many vendor sites refuse automated requests; report those separately so a human can check.
      const row = { url, where: links.get(url), status: result.status, error: result.error };
      if ([401, 403, 405, 429, 999].includes(result.status)) blocked.push(row);
      else broken.push(row);
    }
  });
  await Promise.all(workers);
}

const lines = [
  "# Catalog freshness report",
  "",
  `Checked ${products.length} products and ${links.size} source links on ${today.toISOString().slice(0, 10)}.`,
  "",
  `## Not reviewed in the last ${days} days (${stale.length})`,
  "",
  ...(stale.length === 0
    ? ["None."]
    : stale.map(({ product, age }) => `- [ ] \`${product.id}\` ${product.name}: ${Number.isFinite(age) ? "last reviewed " + product.lastReviewed + " (" + age + " days)" : "never reviewed"}`)),
  "",
  `## Broken source links (${offline ? "not checked" : broken.length})`,
  "",
  ...(offline ? ["Run without --offline to check links."] : broken.length === 0 ? ["None."] : broken.map((row) => `- [ ] ${row.url} (${row.status || row.error}) used by ${row.where.join(", ")}`)),
  "",
  `## Links the site would not let the checker read (${offline ? "not checked" : blocked.length})`,
  "",
  ...(offline ? ["Run without --offline to check links."] : blocked.length === 0 ? ["None."] : blocked.map((row) => `- ${row.url} (${row.status}) used by ${row.where.join(", ")}. Check by hand.`)),
  "",
  "To fix an entry, re-check it against its sources, update the facts, and set `lastReviewed` to the date you checked. See CONTRIBUTING.md.",
];
const report = lines.join("\n") + "\n";
if (out) writeFileSync(out, report);
console.log(report);
const found = stale.length + broken.length;
if (strict && found > 0) process.exit(1);
