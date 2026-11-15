import { describe, expect, it } from "vitest";
import { addonKey } from "@/data/catalog";
import { MAX_LEVEL, assess, categoryLevel, nextPractice, productField } from "@/lib/assessment";
import { EMPTY_INPUT, category, tool } from "./fixtures";

const edr = category("edr");
const mail = category("mail");
const vuln = category("vuln");
const extra = category("extra", false);
const categories = [edr, mail, vuln, extra];

const agent = tool("agent", "edr", {
  aliases: ["the agent"],
  extensions: [{ name: "Agent Vulnerability Module", detail: "Finds missing patches.", covers: "vuln" }],
});
const filter = tool("filter", "mail");
const scanner = tool("scanner", "vuln", { priceTier: "Low" });
const tools = [agent, filter, scanner];

describe("assess", () => {
  it("scores zero with nothing in place", () => {
    const result = assess(EMPTY_INPUT, tools, categories);
    expect(result.maturity).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.state("edr")).toBe("Gap");
  });

  it("counts a picked product only once it is marked Deployed", () => {
    const untested = assess({ ...EMPTY_INPUT, picked: ["agent"] }, tools, categories);
    expect(untested.present.has("edr")).toBe(true);
    expect(untested.operating.has("edr")).toBe(false);
    expect(untested.state("edr")).toBe("Not proven");

    const deployed = assess({ ...EMPTY_INPUT, picked: ["agent"], categoryStatus: { edr: "Deployed" } }, tools, categories);
    expect(deployed.state("edr")).toBe("Covered");
    expect(deployed.essentialOperating).toBe(1);
    expect(deployed.coverage).toBe(33);
  });

  it("does not count Partial", () => {
    const result = assess({ ...EMPTY_INPUT, picked: ["agent"], categoryStatus: { edr: "Partial" } }, tools, categories);
    expect(result.operating.has("edr")).toBe(false);
  });

  it("matches products typed as free text by alias", () => {
    const result = assess({ ...EMPTY_INPUT, ownedText: "The Agent, something else" }, tools, categories);
    expect(result.ownedIds.has("agent")).toBe(true);
  });

  it("counts a deployed inventory item by catalog lookup", () => {
    const result = assess({ ...EMPTY_INPUT, stack: [{ name: "filter", status: "Deployed" }] }, tools, categories);
    expect(result.operating.has("mail")).toBe(true);
  });

  it("lets an owned add-on cover another category", () => {
    const input = {
      ...EMPTY_INPUT,
      picked: ["agent"],
      addons: [addonKey("agent", "Agent Vulnerability Module")],
      categoryStatus: { edr: "Deployed" as const, vuln: "Deployed" as const },
    };
    const result = assess(input, tools, categories);
    expect(result.addonCovers.get("vuln")).toBe("Agent Vulnerability Module on agent");
    expect(result.operating.has("vuln")).toBe(true);
  });

  it("computes maturity from levels, essentials only", () => {
    const input = {
      ...EMPTY_INPUT,
      picked: ["agent", "filter"],
      categoryStatus: { edr: "Deployed" as const, mail: "Deployed" as const },
      practices: { edr: ["a", "b", "c"], mail: ["a"] },
    };
    const result = assess(input, tools, categories);
    // edr 4 + mail 2 + vuln 0 = 6 of a possible 12.
    expect(result.levels.get("edr")?.level).toBe(4);
    expect(result.levels.get("mail")?.level).toBe(2);
    expect(result.maturity).toBe(50);
    expect(result.coverage).toBe(67);
  });

  it("is never above coverage", () => {
    const input = { ...EMPTY_INPUT, picked: ["agent"], categoryStatus: { edr: "Deployed" as const } };
    const result = assess(input, tools, categories);
    expect(result.maturity).toBeLessThanOrEqual(result.coverage);
  });
});

describe("categoryLevel", () => {
  it("ignores practices while the category is not operating", () => {
    expect(categoryLevel(edr, false, ["a", "b"]).level).toBe(0);
  });

  it("adds one per confirmed practice and ignores unknown or repeated ids", () => {
    const level = categoryLevel(edr, true, ["a", "a", "zzz"]);
    expect(level.level).toBe(2);
    expect(level.confirmed).toEqual(["a"]);
  });

  it("caps at the maximum level", () => {
    const wide = category("wide", true, ["a", "b", "c", "d", "e"]);
    expect(categoryLevel(wide, true, ["a", "b", "c", "d", "e"]).level).toBe(MAX_LEVEL);
  });

  it("names the next practice to work on", () => {
    expect(nextPractice(categoryLevel(edr, true, ["a"]))?.id).toBe("b");
    expect(nextPractice(categoryLevel(edr, true, ["a", "b", "c"]))).toBeNull();
    expect(nextPractice(categoryLevel(edr, false, []))).toBeNull();
  });
});

describe("productField", () => {
  it("marks other products as overlapping when an owned add-on already covers the category", () => {
    const input = { ...EMPTY_INPUT, picked: ["agent"], addons: [addonKey("agent", "Agent Vulnerability Module")] };
    const result = assess(input, tools, categories);
    const rows = productField(result, "vuln", "Mid-market", "Balanced", tools);
    expect(rows.map((row) => row.fit.kind)).toEqual(["Overlaps"]);
  });

  it("puts the product you run first", () => {
    const result = assess({ ...EMPTY_INPUT, picked: ["filter"] }, tools, categories);
    const rows = productField(result, "mail", "Mid-market", "Balanced", tools);
    expect(rows[0].fit.kind).toBe("Yours");
  });
});
