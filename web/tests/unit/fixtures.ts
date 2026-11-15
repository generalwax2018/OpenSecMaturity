import type { Category, Tool } from "@/data/catalog";

const requirement = { level: "none" as const, ref: "n/a" };

export function category(id: string, essential = true, practiceIds = ["a", "b", "c"]): Category {
  return {
    id,
    name: id.toUpperCase(),
    domain: "Blue Team",
    essential,
    summary: "Summary of " + id + ".",
    nist: "DE.CM",
    controls: { cis: "x", nist: "x", iso: "x", soc2: "x" },
    requirements: { cis: requirement, nist: requirement, iso: requirement, soc2: requirement, pci: requirement, hipaa: requirement },
    practices: practiceIds.map((practiceId) => ({ id: practiceId, text: "Practice " + practiceId })),
    vendorQuestions: { claims: [{ claim: "c", ask: "a" }], proof: ["p"], redFlags: ["r"] },
  };
}

export function tool(id: string, categoryId: string, overrides: Partial<Tool> = {}): Tool {
  return {
    id,
    name: id,
    vendor: id,
    categoryId,
    priceTier: "Medium",
    bestFor: ["SMB", "Mid-market", "Enterprise"],
    openSource: false,
    deployment: ["SaaS"],
    description: id + " does things.",
    lastReviewed: "2026-11-01",
    sources: [{ title: "s", url: "https://example.com" }],
    domain: "Blue Team",
    nist: "DE.CM",
    ...overrides,
  };
}

export const EMPTY_INPUT = {
  checked: [],
  ownedText: "",
  picked: [],
  suites: [],
  addons: [],
  categoryStatus: {},
  stack: [],
  practices: {},
};
