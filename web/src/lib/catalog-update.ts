// Catalog updates: new products, sources, and review dates are plain data,
// so the app can fetch them from the project's GitHub repository without
// changing any code. The data is checked before use and cached in this
// browser. App code itself only changes when you download a new release.
import { GITHUB_REPO } from "@/data/app-meta";
import {
  BUNDLED_CATALOG_VERSION,
  CATALOG_FORMAT,
  applyCatalog,
  compareVersions,
  type CatalogData,
} from "@/data/catalog";

const RAW = "https://raw.githubusercontent.com/" + GITHUB_REPO + "/main/catalog/";
const CACHE_KEY = "opensecmaturity:catalog";
const MAX_BYTES = 4 * 1024 * 1024;

const https = (value: unknown) => typeof value === "string" && /^https:\/\/\S+$/.test(value) && value.length < 2048;
const text = (value: unknown, max = 4000) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const source = (value: unknown) => {
  const row = value as { title?: unknown; url?: unknown } | undefined;
  return Boolean(row) && text(row?.title, 300) && https(row?.url);
};
const LEVELS = ["required", "addressable", "recommended", "none"];
const FRAMEWORK_IDS = ["cis", "nist", "iso", "soc2", "pci", "hipaa"];

/** Returns a list of problems; an empty list means the catalog is usable. */
export function checkCatalog(data: CatalogData): string[] {
  const problems: string[] = [];
  const fail = (message: string) => problems.length < 20 && problems.push(message);
  if (!data || typeof data !== "object") return ["Catalog is not an object."];
  if (data.version?.format !== CATALOG_FORMAT) fail("Catalog format " + data.version?.format + " is not supported by this version of the app.");
  if (!/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(data.version?.version ?? "")) fail("Catalog version is missing.");
  if (!Array.isArray(data.categories) || data.categories.length === 0) return [...problems, "No categories."];
  if (!Array.isArray(data.products) || data.products.length === 0) return [...problems, "No products."];
  if (!Array.isArray(data.suites)) return [...problems, "Suites must be a list."];
  const categoryIds = new Set<string>();
  for (const category of data.categories) {
    if (!text(category?.id, 80) || !text(category?.name, 200) || !text(category?.summary)) fail("A category is missing its id, name, or summary.");
    if (!["Red Team", "Blue Team", "Governance"].includes(category?.domain)) fail("Category " + category?.id + " has an unknown domain.");
    for (const id of FRAMEWORK_IDS) {
      const row = category?.requirements?.[id as "cis"];
      if (!row || !LEVELS.includes(row.level) || !text(row.ref, 400)) fail("Category " + category?.id + " is missing the " + id + " requirement.");
    }
    categoryIds.add(category.id);
  }
  const productIds = new Set<string>();
  for (const product of data.products) {
    const at = "Product " + product?.id;
    if (!text(product?.id, 80) || productIds.has(product.id)) fail(at + " has a missing or duplicate id.");
    productIds.add(product?.id);
    if (!text(product?.name, 200) || !text(product?.vendor, 200) || !text(product?.description)) fail(at + " is missing its name, vendor, or description.");
    if (!categoryIds.has(product?.categoryId)) fail(at + " names an unknown category.");
    if (!["Low", "Medium", "High"].includes(product?.priceTier)) fail(at + " has an unknown price tier.");
    if (!Array.isArray(product?.bestFor) || product.bestFor.some((size) => !["SMB", "Mid-market", "Enterprise"].includes(size))) fail(at + " has unknown company sizes.");
    if (!Array.isArray(product?.deployment) || product.deployment.some((item) => !["SaaS", "Self-hosted"].includes(item))) fail(at + " has an unknown deployment.");
    if (!Array.isArray(product?.sources) || !product.sources.every(source)) fail(at + " has a source that is not an https link.");
    if (product?.fedramp && !source(product.fedramp.source)) fail(at + " has a FedRAMP claim without a source.");
    if (product?.euResidency && !source(product.euResidency.source)) fail(at + " has an EU residency claim without a source.");
    for (const addon of product?.extensions ?? []) {
      if (!text(addon?.name, 200) || !text(addon?.detail)) fail(at + " has an add-on without a name or detail.");
      if (addon?.covers !== undefined && !categoryIds.has(addon.covers)) fail(at + " has an add-on that covers an unknown category.");
      if (addon?.pricingSource !== undefined && !source(addon.pricingSource)) fail(at + " has an add-on pricing source that is not an https link.");
    }
  }
  for (const suite of data.suites) {
    if (!text(suite?.id, 80) || !text(suite?.name, 200)) fail("A suite is missing its id or name.");
    if (!Array.isArray(suite?.includes) || suite.includes.some((item) => !productIds.has(item?.product))) fail("Suite " + suite?.id + " includes an unknown product.");
    if (!Array.isArray(suite?.sources) || !suite.sources.every(source)) fail("Suite " + suite?.id + " has a source that is not an https link.");
  }
  return problems;
}

/** Called once before the app renders: use a cached catalog if it is newer and valid. */
export function loadCachedCatalog(): void {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as CatalogData;
    if (compareVersions(data.version.version, BUNDLED_CATALOG_VERSION) <= 0 || checkCatalog(data).length > 0) {
      window.localStorage.removeItem(CACHE_KEY);
      return;
    }
    applyCatalog(data);
  } catch {
    // Unreadable cache: keep the catalog that shipped with the app.
  }
}

async function getJson(name: string): Promise<unknown> {
  const response = await fetch(RAW + name, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not download " + name + " (" + response.status + ").");
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new Error(name + " is larger than expected.");
  return JSON.parse(body);
}

export type CatalogCheck = { remoteVersion: string; data: CatalogData; problems: string[] };

/** Downloads the catalog from GitHub and checks it. Nothing about the assessment is sent. */
export async function fetchRemoteCatalog(): Promise<CatalogCheck> {
  const [version, categories, products, suites] = await Promise.all([
    getJson("version.json"),
    getJson("categories.json"),
    getJson("products.json"),
    getJson("suites.json"),
  ]);
  const data = { version, categories, products, suites } as CatalogData;
  return { remoteVersion: (version as { version?: string })?.version ?? "unknown", data, problems: checkCatalog(data) };
}

/** Saves a checked catalog and reloads so every screen uses it. */
export function installCatalog(data: CatalogData): void {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  window.location.reload();
}

/** Goes back to the catalog that shipped with this copy of the app. */
export function resetCatalog(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing cached.
  }
  window.location.reload();
}
