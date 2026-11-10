// Checks catalog/categories.json and catalog/products.json.
//   node scripts/validate-catalog.mjs            structural errors fail; unreviewed entries are listed
//   node scripts/validate-catalog.mjs --strict   unreviewed or stale entries fail too
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const strict = process.argv.includes("--strict");
const STALE_DAYS = 365;
const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL("../../catalog/" + name, import.meta.url)), "utf8"));

const categories = load("categories.json");
const products = load("products.json");
const suites = load("suites.json");
const version = load("version.json");
const errors = [];
const warnings = [];

const DOMAINS = ["Red Team", "Blue Team", "Governance"];
const LEVELS = ["required", "addressable", "recommended", "none"];
const DEPLOYMENTS = ["SaaS", "Self-hosted"];
const FEDRAMP = ["High", "Moderate", "Low", "Authorized"];
const PRICING = ["included", "higher-tier", "add-on", "usage", "service"];
const EXTENSION_KEYS = ["name", "detail", "covers", "pricing", "ai", "pricingNote", "pricingSource"];
const TIERS = ["Low", "Medium", "High"];
const SIZES = ["SMB", "Mid-market", "Enterprise"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (value) => typeof value === "string" && value.trim().length > 0;
const today = new Date();

const categoryIds = new Set();
for (const category of categories) {
  const at = "category " + (category.id ?? "(no id)");
  if (!ID.test(category.id ?? "")) errors.push(at + ": id must be lowercase letters, digits, and hyphens");
  if (categoryIds.has(category.id)) errors.push(at + ": duplicate id");
  categoryIds.add(category.id);
  if (!text(category.name) || !text(category.summary) || !text(category.nist)) errors.push(at + ": name, summary, and nist are required");
  if (!DOMAINS.includes(category.domain)) errors.push(at + ": domain must be one of " + DOMAINS.join(", "));
  if (typeof category.essential !== "boolean") errors.push(at + ": essential must be true or false");
  for (const key of ["cis", "nist", "iso", "soc2"]) {
    if (!text(category.controls?.[key])) errors.push(at + ": controls." + key + " is required");
  }
  for (const key of ["cis", "nist", "iso", "soc2", "pci", "hipaa"]) {
    const row = category.requirements?.[key];
    if (!row || !LEVELS.includes(row.level) || !text(row.ref)) errors.push(at + ": requirements." + key + " needs a level (" + LEVELS.join(", ") + ") and a ref");
    if (row?.level === "addressable" && key !== "hipaa") errors.push(at + ": only HIPAA uses the addressable level");
  }
}

const ALLOWED = new Set(["id", "name", "vendor", "aliases", "categoryId", "priceTier", "bestFor", "openSource", "deployment", "fedramp", "euResidency", "description", "extensions", "compete", "lastReviewed", "sources"]);
const productIds = new Set();
const aliasOwner = new Map();
const norm = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

for (const product of products) {
  const at = "product " + (product.id ?? "(no id)");
  for (const key of Object.keys(product)) if (!ALLOWED.has(key)) errors.push(at + ": unknown field " + key);
  if (!ID.test(product.id ?? "")) errors.push(at + ": id must be lowercase letters, digits, and hyphens");
  if (productIds.has(product.id)) errors.push(at + ": duplicate id");
  productIds.add(product.id);
  if (!text(product.name) || !text(product.vendor) || !text(product.description)) errors.push(at + ": name, vendor, and description are required");
  if (!categoryIds.has(product.categoryId)) errors.push(at + ": unknown categoryId " + product.categoryId);
  if (!TIERS.includes(product.priceTier)) errors.push(at + ": priceTier must be one of " + TIERS.join(", "));
  if (!Array.isArray(product.bestFor) || product.bestFor.length === 0 || product.bestFor.some((size) => !SIZES.includes(size))) {
    errors.push(at + ": bestFor must list at least one of " + SIZES.join(", "));
  }
  if (typeof product.openSource !== "boolean") errors.push(at + ": openSource must be true or false");
  if (!Array.isArray(product.deployment) || product.deployment.length === 0 || product.deployment.some((item) => !DEPLOYMENTS.includes(item))) {
    errors.push(at + ": deployment must list SaaS, Self-hosted, or both");
  }
  const checkSource = (label, source) => {
    if (!source || !text(source.title) || !/^https:\/\/\S+$/.test(source.url ?? "")) errors.push(at + ": " + label + " needs a source with a title and an https:// url");
  };
  if (product.fedramp !== undefined) {
    if (!FEDRAMP.includes(product.fedramp.level)) errors.push(at + ": fedramp.level must be one of " + FEDRAMP.join(", "));
    if (!product.deployment?.includes("SaaS")) errors.push(at + ": fedramp only applies to a SaaS offering");
    checkSource("fedramp", product.fedramp.source);
  }
  if (product.euResidency !== undefined) checkSource("euResidency", product.euResidency.source);
  for (const alias of [product.name, ...(product.aliases ?? [])]) {
    const key = norm(alias);
    if (aliasOwner.has(key) && aliasOwner.get(key) !== product.id) errors.push(at + ': name or alias "' + alias + '" is also used by ' + aliasOwner.get(key));
    aliasOwner.set(key, product.id);
  }
  for (const extension of product.extensions ?? []) {
    if (!text(extension.name) || !text(extension.detail)) errors.push(at + ": each extension needs name and detail");
    for (const key of Object.keys(extension)) if (!EXTENSION_KEYS.includes(key)) errors.push(at + ": extension " + extension.name + " has unknown field " + key);
    if (extension.pricing !== undefined && !PRICING.includes(extension.pricing)) errors.push(at + ": extension " + extension.name + " pricing must be one of " + PRICING.join(", "));
    if (extension.pricing !== undefined) checkSource("extension " + extension.name + " pricing", extension.pricingSource);
    if (extension.pricing === undefined && (extension.pricingNote !== undefined || extension.pricingSource !== undefined)) errors.push(at + ": extension " + extension.name + " has pricing details but no pricing");
    if (extension.ai !== undefined && typeof extension.ai !== "boolean") errors.push(at + ": extension " + extension.name + " ai must be true or false");
    if (extension.covers !== undefined && !categoryIds.has(extension.covers)) errors.push(at + ": extension covers unknown category " + extension.covers);
  }
  if (product.compete && (!text(product.compete.wins) || !text(product.compete.loses))) errors.push(at + ": compete needs both wins and loses");
  if (!product.compete) warnings.push(at + ": no compete note (where it wins and where it loses)");

  if (!Array.isArray(product.sources)) errors.push(at + ": sources must be a list (use [] if there are none yet)");
  for (const source of product.sources ?? []) {
    if (!text(source.title)) errors.push(at + ": each source needs a title");
    if (!/^https:\/\/\S+$/.test(source.url ?? "")) errors.push(at + ": source url must start with https://");
  }
  if (product.lastReviewed === null) {
    warnings.push(at + ": not reviewed yet");
  } else if (!DATE.test(product.lastReviewed ?? "") || Number.isNaN(Date.parse(product.lastReviewed))) {
    errors.push(at + ": lastReviewed must be YYYY-MM-DD or null");
  } else {
    if (Date.parse(product.lastReviewed) > today.getTime()) errors.push(at + ": lastReviewed is in the future");
    if ((product.sources ?? []).length === 0) errors.push(at + ": lastReviewed is set but no sources are cited");
    const age = Math.floor((today.getTime() - Date.parse(product.lastReviewed)) / 86_400_000);
    if (age > STALE_DAYS) warnings.push(at + ": last reviewed " + age + " days ago");
  }
}

const perCategory = new Map([...categoryIds].map((id) => [id, 0]));
for (const product of products) perCategory.set(product.categoryId, (perCategory.get(product.categoryId) ?? 0) + 1);
for (const [id, count] of perCategory) {
  if (count < 3) warnings.push("category " + id + ": only " + count + (count === 1 ? " product" : " products") + ", too few to compare");
}

const productSet = new Set(products.map((product) => product.id));
const suiteIds = new Set();
for (const suite of suites) {
  const at = "suite " + (suite.id ?? "(no id)");
  if (!ID.test(suite.id ?? "") || suiteIds.has(suite.id)) errors.push(at + ": id must be unique, lowercase letters, digits, and hyphens");
  suiteIds.add(suite.id);
  if (!text(suite.name) || !text(suite.vendor)) errors.push(at + ": name and vendor are required");
  if (!Array.isArray(suite.includes) || suite.includes.length === 0) errors.push(at + ": includes must list at least one product");
  for (const item of suite.includes ?? []) {
    if (!productSet.has(item.product)) errors.push(at + ": includes unknown product " + item.product);
    if (!text(item.as)) errors.push(at + ": each included product needs an 'as' (the licensed edition)");
  }
  if (!Array.isArray(suite.sources) || suite.sources.length === 0) errors.push(at + ": cite at least one source for what the suite includes");
  for (const source of suite.sources ?? []) {
    if (!text(source.title) || !/^https:\/\/\S+$/.test(source.url ?? "")) errors.push(at + ": each source needs a title and an https:// url");
  }
}

if (version.format !== 2) errors.push("version.json: format must be 2 for this app");
if (!/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(version.version ?? "")) errors.push("version.json: version must look like 2026.11.10 or 2026.11.10.2");

for (const line of warnings) console.log("warning  " + line);
for (const line of errors) console.error("error    " + line);
const reviewed = products.filter((product) => product.lastReviewed && product.sources?.length > 0).length;
console.log("\n" + products.length + " products in " + categories.length + " categories. " + reviewed + " reviewed against sources, " + suites.length + " licence suites. " + errors.length + " errors, " + warnings.length + " warnings.");
if (errors.length > 0 || (strict && warnings.length > 0)) process.exit(1);
