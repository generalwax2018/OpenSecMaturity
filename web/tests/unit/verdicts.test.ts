import { describe, expect, it } from "vitest";
import { addonOpportunities, competeCall, gapFit, licensedProducts, SUITES, TOOLS } from "@/data/catalog";
import { tool } from "./fixtures";

const cheap = tool("cheap", "edr", { priceTier: "Low", bestFor: ["SMB", "Mid-market"] });
const middle = tool("middle", "edr", { priceTier: "Medium" });
const pricey = tool("pricey", "edr", { priceTier: "High", bestFor: ["Enterprise"] });
const field = [cheap, middle, pricey];

describe("competeCall verdicts", () => {
  it("Shop: nothing owned names the cheapest fit", () => {
    const call = competeCall([], field, "edr", "Mid-market", "Balanced");
    expect(call.verdict).toBe("Shop");
    expect(call.why).toContain("cheap");
  });

  it("Shop: says so when nothing fits", () => {
    const call = competeCall([], [pricey], "edr", "SMB", "Lean");
    expect(call.verdict).toBe("Shop");
    expect(call.why).toMatch(/Nothing in the catalog fits/);
  });

  it("Drop one: two products in one category", () => {
    const call = competeCall([cheap, middle], field, "edr", "Mid-market", "Balanced");
    expect(call.verdict).toBe("Drop one");
  });

  it("Switch: product not aimed at the company size", () => {
    const call = competeCall([pricey], field, "edr", "SMB", "Open");
    expect(call.verdict).toBe("Switch");
    expect(call.why).toContain("not built for a SMB company");
  });

  it("Switch: product above the budget", () => {
    const enterpriseHigh = tool("big", "edr", { priceTier: "High" });
    const call = competeCall([enterpriseHigh], [...field, enterpriseHigh], "edr", "Mid-market", "Lean");
    expect(call.verdict).toBe("Switch");
    expect(call.why).toContain("above a Lean budget");
  });

  it("Stay: product fits size and budget", () => {
    const call = competeCall([middle], field, "edr", "Mid-market", "Balanced");
    expect(call.verdict).toBe("Stay");
  });

  it("orders the field cheapest first", () => {
    const call = competeCall([], [pricey, middle, cheap], "edr", "Mid-market", "Open");
    expect(call.field.map((item) => item.id)).toEqual(["cheap", "middle", "pricey"]);
  });
});

describe("gapFit", () => {
  it("Yours", () => {
    expect(gapFit(middle, [middle], "Mid-market", "Balanced").kind).toBe("Yours");
  });

  it("Overlaps when another product runs in the category", () => {
    expect(gapFit(cheap, [middle], "Mid-market", "Balanced").kind).toBe("Overlaps");
  });

  it("Fills the gap when it fits", () => {
    expect(gapFit(middle, [], "Mid-market", "Balanced").kind).toBe("Fills the gap");
  });

  it("Fills it, with a catch, when size or budget do not fit", () => {
    const fit = gapFit(pricey, [], "SMB", "Lean");
    expect(fit.kind).toBe("Fills it, with a catch");
    expect(fit.detail).toContain("not aimed at a SMB company");
    expect(fit.detail).toContain("above a Lean budget");
  });

  it("Already licensed through a suite, using the real Microsoft 365 E3 entry", () => {
    const suite = SUITES.find((item) => item.id === "m365-e3");
    expect(suite).toBeDefined();
    const licensed = licensedProducts(["m365-e3"]);
    const productId = suite!.includes[0].product;
    const product = TOOLS.find((item) => item.id === productId)!;
    expect(gapFit(product, [], "Mid-market", "Balanced", licensed).kind).toBe("Already licensed");
  });

  it("Overlaps when you license one product but run another in the same category", () => {
    const licensed = licensedProducts(["m365-e3"]);
    const productId = SUITES.find((item) => item.id === "m365-e3")!.includes[0].product;
    const product = TOOLS.find((item) => item.id === productId)!;
    const other = TOOLS.find((item) => item.categoryId === product.categoryId && item.id !== product.id)!;
    expect(gapFit(product, [other], "Mid-market", "Balanced", licensed).kind).toBe("Overlaps");
  });
});

describe("addonOpportunities", () => {
  const agent = tool("agent", "edr", {
    extensions: [
      { name: "Vuln module", detail: "d", covers: "vuln" },
      { name: "AI helper", detail: "d", ai: true },
    ],
  });

  it("closes a gap, or strengthens without changing the score", () => {
    const rows = addonOpportunities([agent], [], new Set(["edr"]));
    expect(rows.map((row) => [row.addon.name, row.effect])).toEqual([
      ["Vuln module", "Closes a gap"],
      ["AI helper", "Strengthens"],
    ]);
  });

  it("overlaps when the other category is already covered", () => {
    const rows = addonOpportunities([agent], [], new Set(["edr", "vuln"]));
    expect(rows.find((row) => row.addon.name === "Vuln module")?.effect).toBe("Overlaps");
  });

  it("leaves out add-ons you already have", () => {
    const rows = addonOpportunities([agent], ["agent::AI helper"], new Set(["edr"]));
    expect(rows.map((row) => row.addon.name)).toEqual(["Vuln module"]);
  });
});
