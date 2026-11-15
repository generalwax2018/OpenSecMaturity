import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG_FORMAT, compareVersions, type CatalogData } from "@/data/catalog";
import { checkCatalog } from "@/lib/catalog-update";
import { isValidEntry } from "@/lib/workspace-schema";

const read = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL("../../../catalog/" + name, import.meta.url)), "utf8"));
const bundled = (): CatalogData => ({
  version: read("version.json"),
  categories: read("categories.json"),
  products: read("products.json"),
  suites: read("suites.json"),
});

describe("checkCatalog", () => {
  it("accepts the bundled catalog", () => {
    expect(checkCatalog(bundled())).toEqual([]);
  });

  it("rejects an older catalog format", () => {
    const data = bundled();
    data.version = { format: CATALOG_FORMAT - 1, version: data.version.version };
    expect(checkCatalog(data)[0]).toMatch(/not supported/);
  });

  it("rejects a category without vendor questions or practices", () => {
    const data = bundled();
    const [first] = data.categories;
    data.categories[0] = { ...first, practices: [], vendorQuestions: undefined as never };
    const problems = checkCatalog(data);
    expect(problems.some((line) => line.includes("practices"))).toBe(true);
    expect(problems.some((line) => line.includes("vendor questions"))).toBe(true);
  });

  it("rejects a product source that is not https", () => {
    const data = bundled();
    data.products[0] = { ...data.products[0], sources: [{ title: "x", url: "javascript:alert(1)" }] };
    expect(checkCatalog(data).some((line) => line.includes("https"))).toBe(true);
  });
});

describe("catalog content", () => {
  it("gives every category one to three practices and vendor questions", () => {
    for (const category of bundled().categories) {
      expect(category.practices.length).toBeGreaterThan(0);
      expect(category.practices.length).toBeLessThanOrEqual(3);
      expect(category.vendorQuestions.claims.length).toBeGreaterThan(0);
    }
  });
});

describe("compareVersions", () => {
  it("compares dotted date versions", () => {
    expect(compareVersions("2026.11.14", "2026.11.10.4")).toBeGreaterThan(0);
    expect(compareVersions("2026.11.10", "2026.11.10.0")).toBe(0);
    expect(compareVersions("2026.11.10.2", "2026.11.10.10")).toBeLessThan(0);
  });
});

describe("workspace schema", () => {
  it("accepts practices and rejects bad shapes", () => {
    expect(isValidEntry("practices", { endpoint: ["coverage"] })).toBe(true);
    expect(isValidEntry("practices", { endpoint: "coverage" })).toBe(false);
    expect(isValidEntry("practices", [])).toBe(false);
  });
});
