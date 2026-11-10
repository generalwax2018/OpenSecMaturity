import categoriesData from "@catalog/categories.json";
import productsData from "@catalog/products.json";
import suitesData from "@catalog/suites.json";

export type Domain = "Red Team" | "Blue Team" | "Governance";
export type PriceTier = "Low" | "Medium" | "High";
export type CompanySize = "SMB" | "Mid-market" | "Enterprise";
export type Budget = "Lean" | "Balanced" | "Open";
export type FrameworkId = "cis" | "nist" | "iso" | "soc2" | "pci" | "hipaa";

export type Framework = {
  id: FrameworkId;
  name: string;
  summary: string;
};

export type Category = {
  id: string;
  name: string;
  domain: Domain;
  essential: boolean;
  summary: string;
  nist: string;
  controls: {
    cis: string;
    nist: string;
    iso: string;
    soc2: string;
  };
  requirements: Record<FrameworkId, Requirement>;
};

export type RequirementLevel = "required" | "addressable" | "recommended" | "none";

export type Requirement = { level: RequirementLevel; ref: string };

export type ToolExtension = {
  name: string;
  detail: string;
  covers?: string;
};

export type Deployment = "SaaS" | "Self-hosted";

export type Source = {
  title: string;
  url: string;
};

export type CompeteNote = {
  wins: string;
  loses: string;
};

/** One entry in catalog/products.json. Edit the JSON, not this file. */
export type ProductRecord = {
  id: string;
  name: string;
  vendor: string;
  aliases?: string[];
  categoryId: string;
  priceTier: PriceTier;
  bestFor: CompanySize[];
  openSource: boolean;
  deployment: Deployment[];
  fedramp?: { level: "High" | "Moderate" | "Low" | "Authorized"; source: Source };
  euResidency?: { source: Source };
  description: string;
  extensions?: ToolExtension[];
  compete?: CompeteNote;
  /** ISO date the entry was last checked against its sources, or null if it never was. */
  lastReviewed: string | null;
  sources: Source[];
};

export type Tool = ProductRecord & {
  domain: Domain;
  nist: string;
};

export const DOMAINS: Domain[] = ["Blue Team", "Red Team", "Governance"];

export const COMPANY_SIZES: CompanySize[] = ["SMB", "Mid-market", "Enterprise"];

export const BUDGETS: Budget[] = ["Lean", "Balanced", "Open"];

export const BUDGET_TIER: Record<Budget, PriceTier> = {
  Lean: "Low",
  Balanced: "Medium",
  Open: "High",
};

const TIER_RANK: Record<PriceTier, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

export const FRAMEWORKS: Framework[] = [
  {
    id: "cis",
    name: "CIS Controls",
    summary: "Prioritized safeguards. Implementation Group 1 is the practical baseline.",
  },
  {
    id: "nist",
    name: "NIST CSF",
    summary: "Outcome-based functions from Govern through Recover, using CSF 2.0 categories.",
  },
  {
    id: "iso",
    name: "ISO 27001",
    summary: "Annex A control themes for an information security management system.",
  },
  {
    id: "soc2",
    name: "SOC 2",
    summary: "Trust services criteria commonly requested in customer assurance reviews.",
  },
  {
    id: "pci",
    name: "PCI DSS",
    summary: "Cardholder-data controls. Use this on the payments area, not the whole company.",
  },
  {
    id: "hipaa",
    name: "HIPAA",
    summary: "Safeguards for protected health information. Use this on the clinical area.",
  },
];

export const CATEGORIES: Category[] = categoriesData as Category[];

export const TOOLS: Tool[] = (productsData as ProductRecord[]).map((record) => {
  const category = CATEGORIES.find((item) => item.id === record.categoryId);
  if (!category) throw new Error("Catalog product " + record.id + " names an unknown category: " + record.categoryId);
  return { ...record, domain: category.domain, nist: category.nist };
});

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

export function ownedToolIds(tools: Tool[], ownedText: string): Set<string> {
  const owned = normalize(ownedText);
  const ids = new Set<string>();
  if (!owned) return ids;

  const pairs = tools.flatMap((tool) =>
    [tool.name, ...(tool.aliases ?? [])].map((alias) => ({
      toolId: tool.id,
      alias: normalize(alias),
    })),
  );

  const present = pairs.filter((pair) => pair.alias && containsPhrase(owned, pair.alias));
  for (const pair of present) {
    const shadowed = present.some(
      (other) => other.alias !== pair.alias && other.alias.length > pair.alias.length && containsPhrase(other.alias, pair.alias),
    );
    if (!shadowed) ids.add(pair.toolId);
  }
  return ids;
}

export function coveredCategoryIds(
  tools: Tool[],
  checked: readonly string[],
  ownedText: string,
): Set<string> {
  const covered = new Set(checked);
  const owned = ownedToolIds(tools, ownedText);
  for (const tool of tools) {
    if (owned.has(tool.id)) covered.add(tool.categoryId);
  }
  return covered;
}

export function maturityScore(categories: Category[], covered: Set<string>): number {
  const essential = categories.filter((category) => category.essential);
  if (essential.length === 0) return 0;
  const hit = essential.filter((category) => covered.has(category.id)).length;
  return Math.round((hit / essential.length) * 100);
}

export type DomainStat = {
  domain: Domain;
  covered: number;
  total: number;
  percent: number;
};

export function domainStats(categories: Category[], covered: Set<string>): DomainStat[] {
  return DOMAINS.map((domain) => {
    const rows = categories.filter((category) => category.domain === domain);
    const hit = rows.filter((category) => covered.has(category.id)).length;
    return {
      domain,
      covered: hit,
      total: rows.length,
      percent: rows.length === 0 ? 0 : Math.round((hit / rows.length) * 100),
    };
  });
}

export function withinBudget(tier: PriceTier, budget: Budget): boolean {
  return TIER_RANK[tier] <= TIER_RANK[BUDGET_TIER[budget]];
}

export function recommendTools(
  tools: Tool[],
  size: CompanySize,
  budget: Budget,
  covered: Set<string>,
  ownedText: string,
): Tool[] {
  const owned = ownedToolIds(tools, ownedText);
  return tools
    .filter((tool) => tool.bestFor.includes(size))
    .filter((tool) => withinBudget(tool.priceTier, budget))
    .filter((tool) => !covered.has(tool.categoryId))
    .filter((tool) => !owned.has(tool.id))
    .sort((a, b) => {
      const categoryA = CATEGORIES.find((category) => category.id === a.categoryId);
      const categoryB = CATEGORIES.find((category) => category.id === b.categoryId);
      const essentialDelta = Number(Boolean(categoryB?.essential)) - Number(Boolean(categoryA?.essential));
      if (essentialDelta !== 0) return essentialDelta;
      const indexA = CATEGORIES.findIndex((category) => category.id === a.categoryId);
      const indexB = CATEGORIES.findIndex((category) => category.id === b.categoryId);
      if (indexA !== indexB) return indexA - indexB;
      return TIER_RANK[a.priceTier] - TIER_RANK[b.priceTier] || a.name.localeCompare(b.name);
    });
}

export function gapHint(
  categoryId: string,
  tools: Tool[],
  size: CompanySize,
  budget: Budget,
): string | null {
  const fitting = tools.filter((tool) => tool.categoryId === categoryId && tool.bestFor.includes(size));
  if (fitting.length === 0) return "No catalog tool is tagged for this company size.";
  const affordable = fitting.filter((tool) => withinBudget(tool.priceTier, budget));
  if (affordable.length > 0) return null;
  const cheapest = [...fitting].sort((a, b) => TIER_RANK[a.priceTier] - TIER_RANK[b.priceTier])[0];
  if (!cheapest) return null;
  return `Closest fit is ${cheapest.name} (${cheapest.priceTier}), above this budget.`;
}

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

export type OperatingStatus = "Deployed" | "Partial" | "Untested";
export type Severity = "High" | "Medium" | "Low";
export type PlanWindow = "Days 1–30" | "Days 31–60" | "Days 61–90";

export const OPERATING_STATUSES: OperatingStatus[] = ["Deployed", "Partial", "Untested"];
export const SEVERITIES: Severity[] = ["High", "Medium", "Low"];
export const PLAN_WINDOWS: PlanWindow[] = ["Days 1–30", "Days 31–60", "Days 61–90"];

export type BusinessArea = {
  id: string;
  name: string;
  frameworks: string[];
};

export const AREA_PRESETS: BusinessArea[] = [
  { id: "payments", name: "Payments", frameworks: ["pci"] },
  { id: "clinical", name: "Clinical", frameworks: ["hipaa"] },
  { id: "customers", name: "Customer assurance", frameworks: ["soc2"] },
];


export function controlLine(category: Category, id: FrameworkId): string {
  return category.requirements[id]?.ref ?? category.controls[id as "cis"] ?? "No specific requirement";
}

/** How a framework treats a category, in that framework's own terms. */
export function requirementLabel(level: RequirementLevel, id: FrameworkId): string {
  if (level === "none") return "Not addressed";
  if (level === "recommended") return "Supports";
  if (level === "addressable") return "Addressable";
  if (id === "nist") return "Core outcome";
  if (id === "iso") return "Annex A or clause (unless excluded)";
  return "Required";
}

const LEVEL_WEIGHT: Record<RequirementLevel, number> = { required: 3, addressable: 2, recommended: 1, none: 0 };

/** Higher means more of the selected frameworks call for this category. */
export function gapPriority(category: Category, frameworks: FrameworkId[]): number {
  const fromFrameworks = frameworks.reduce((sum, id) => sum + LEVEL_WEIGHT[category.requirements[id]?.level ?? "none"], 0);
  return fromFrameworks + (category.essential ? 1 : 0);
}

export function requiredBy(category: Category, frameworks: FrameworkId[]): FrameworkId[] {
  return frameworks.filter((id) => {
    const level = category.requirements[id]?.level;
    return level === "required" || level === "addressable";
  });
}

export function defaultSeverity(categoryId: string): Severity {
  if (["endpoint", "identity", "backup", "email", "vuln"].includes(categoryId)) return "High";
  if (["siem", "awareness", "compliance"].includes(categoryId)) return "Medium";
  return "Low";
}

export function windowForSeverity(severity: Severity): PlanWindow {
  if (severity === "High") return "Days 1–30";
  if (severity === "Medium") return "Days 31–60";
  return "Days 61–90";
}

export function fillForCategory(
  categoryId: string,
  tools: Tool[],
  size: CompanySize,
  budget: Budget,
): Tool | null {
  const fitting = tools.filter((tool) => tool.categoryId === categoryId && tool.bestFor.includes(size));
  const affordable = fitting.filter((tool) => withinBudget(tool.priceTier, budget));
  const pool = affordable.length > 0 ? affordable : [];
  return [...pool].sort((a, b) => TIER_RANK[a.priceTier] - TIER_RANK[b.priceTier] || a.name.localeCompare(b.name))[0] ?? null;
}

export type GapAdvice = {
  action: "Prove" | "Extend" | "Buy";
  headline: string;
  why: string;
};

export function adviceForGap(
  category: Category,
  tools: Tool[],
  size: CompanySize,
  budget: Budget,
  owned: Tool[],
  present: boolean,
): GapAdvice {
  const ownedHere = owned.filter((tool) => tool.categoryId === category.id);
  if (present && ownedHere.length > 0) {
    const names = ownedHere.map((tool) => tool.name).join(" and ");
    return {
      action: "Prove",
      headline: `Do not buy a second ${category.name.toLowerCase()} product`,
      why: `You already have ${names}. The problem is still open because that tool is not shown to be operating. Prove detections or evidence before anyone sells you another one.`,
    };
  }
  for (const tool of owned) {
    for (const extension of tool.extensions ?? []) {
      if (extension.covers !== category.id) continue;
      return {
        action: "Extend",
        headline: `${extension.name} on ${tool.name}`,
        why: `${category.summary} ${tool.name} already includes ${extension.name}: ${extension.detail} Turn that on before buying from a new vendor.`,
      };
    }
  }
  const fill = fillForCategory(category.id, tools, size, budget);
  if (!fill) {
    return {
      action: "Buy",
      headline: "Nothing in this budget closes it",
      why: gapHint(category.id, tools, size, budget) ?? `No catalog tool fits a ${size} company on a ${budget} budget.`,
    };
  }
  return {
    action: "Buy",
    headline: fill.name,
    why: `${category.summary} ${fill.name} is the ${fill.priceTier.toLowerCase()}-cost option that fits a ${size} company on a ${budget} budget. ${fill.description} A more expensive product would not change the outcome.`,
  };
}

export const COMPETE: Record<string, CompeteNote> = Object.fromEntries(
  TOOLS.filter((tool) => tool.compete).map((tool) => [tool.id, tool.compete as CompeteNote]),
);

export type CompeteVerdict = "Stay" | "Switch" | "Shop" | "Drop one";

export function competeCall(
  owned: Tool[],
  tools: Tool[],
  categoryId: string,
  size: CompanySize,
  budget: Budget,
): { verdict: CompeteVerdict; why: string; field: Tool[] } {
  const field = tools
    .filter((tool) => tool.categoryId === categoryId)
    .sort((a, b) => TIER_RANK[a.priceTier] - TIER_RANK[b.priceTier] || a.name.localeCompare(b.name));
  const fits = (tool: Tool) => tool.bestFor.includes(size) && withinBudget(tool.priceTier, budget);
  const fitting = field.filter(fits);
  if (owned.length === 0) {
    const pick = fitting[0] ?? null;
    return {
      verdict: "Shop",
      why: pick
        ? `Nothing is in place here yet. ${pick.name} is the lowest-cost fit for a ${size} company on a ${budget} budget. ${pick.description}`
        : `Nothing in the catalog fits a ${size} company on a ${budget} budget.`,
      field,
    };
  }
  if (owned.length > 1) {
    const keeper = owned.find(fits) ?? owned[0];
    const rest = owned.filter((tool) => tool.id !== keeper.id).map((tool) => tool.name).join(" and ");
    return {
      verdict: "Drop one",
      why: `You are paying for ${owned.map((tool) => tool.name).join(" and ")}. One product covers this category. Keep ${keeper.name}. ${rest} does not raise maturity.`,
      field,
    };
  }
  const current = owned[0];
  const note = COMPETE[current.id];
  if (!current.bestFor.includes(size)) {
    const pick = fitting.find((tool) => tool.id !== current.id) ?? fitting[0] ?? null;
    return {
      verdict: "Switch",
      why: pick
        ? `${current.name} is not built for a ${size} company. ${pick.name} is. ${pick.description}`
        : `${current.name} is not aimed at a ${size} company, and nothing else in this budget is either.`,
      field,
    };
  }
  if (!withinBudget(current.priceTier, budget)) {
    const pick = fitting.find((tool) => tool.id !== current.id) ?? null;
    return {
      verdict: "Switch",
      why: pick
        ? `${current.name} is ${current.priceTier} cost, above a ${budget} budget. ${pick.name} covers the same category at ${pick.priceTier} cost. ${COMPETE[pick.id]?.wins ?? pick.description}`
        : `${current.name} is above this budget, and no cheaper tool in the catalog fits a ${size} company.`,
      field,
    };
  }
  const pricier = field.find((tool) => tool.id !== current.id && TIER_RANK[tool.priceTier] > TIER_RANK[current.priceTier]);
  return {
    verdict: "Stay",
    why: `${current.name} measures up for a ${size} company on a ${budget} budget. ${note?.wins ?? current.description}${pricier ? ` Moving to ${pricier.name} does not change the control.` : ""}`,
    field,
  };
}

export function topOptions(field: Tool[], owned: Tool[], size: CompanySize, budget: Budget, limit = 3): Tool[] {
  const fits = (tool: Tool) => tool.bestFor.includes(size) && withinBudget(tool.priceTier, budget);
  const ranked = [...field].sort((a, b) => {
    const fitGap = Number(fits(b)) - Number(fits(a));
    if (fitGap !== 0) return fitGap;
    return TIER_RANK[a.priceTier] - TIER_RANK[b.priceTier];
  });
  const picked: Tool[] = [];
  for (const tool of [...owned, ...ranked]) {
    if (picked.length >= limit) break;
    if (!picked.some((item) => item.id === tool.id)) picked.push(tool);
  }
  return picked;
}

export type ScanDiff = {
  appeared: string[];
  disappeared: string[];
  unproven: string[];
  baseline: boolean;
};

function inventoryKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function diffInventory(
  previous: readonly string[] | null,
  next: readonly string[],
  proven: ReadonlySet<string>,
): ScanDiff {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of next) {
    const line = raw.trim();
    const key = inventoryKey(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  if (!previous) {
    return {
      appeared: [],
      disappeared: [],
      unproven: unique.filter((line) => !proven.has(inventoryKey(line))),
      baseline: true,
    };
  }
  const previousKeys = new Set(previous.map(inventoryKey));
  const nextKeys = new Set(unique.map(inventoryKey));
  return {
    appeared: unique.filter((line) => !previousKeys.has(inventoryKey(line))),
    disappeared: previous.filter((line) => inventoryKey(line) && !nextKeys.has(inventoryKey(line))),
    unproven: unique.filter((line) => previousKeys.has(inventoryKey(line)) && !proven.has(inventoryKey(line))),
    baseline: false,
  };
}


export function vendorOf(tool: Tool): string {
  return tool.vendor;
}

export type ReviewState = { reviewed: boolean; label: string };

export function reviewState(tool: Tool): ReviewState {
  if (tool.lastReviewed && tool.sources.length > 0) {
    return {
      reviewed: true,
      label:
        "Facts checked " +
        tool.lastReviewed +
        " against " +
        tool.sources.length +
        (tool.sources.length === 1 ? " source" : " sources") +
        ". Price tier and wins/loses are editorial.",
    };
  }
  return { reviewed: false, label: "Not yet reviewed against sources. Treat this entry as a maintainer opinion." };
}

export function reviewCounts(tools: Tool[]): { reviewed: number; total: number } {
  return { reviewed: tools.filter((tool) => reviewState(tool).reviewed).length, total: tools.length };
}

export type LookupConfidence = "Exact" | "Alias" | "Partial";

export type LookupResult = {
  tool: Tool;
  matchedOn: string;
  confidence: LookupConfidence;
};

export function lookupTool(tools: Tool[], query: string): LookupResult | null {
  const needle = normalize(query);
  if (!needle) return null;

  for (const tool of tools) {
    if (normalize(tool.name) === needle) {
      return { tool, matchedOn: tool.name, confidence: "Exact" };
    }
  }

  for (const tool of tools) {
    for (const alias of tool.aliases ?? []) {
      if (normalize(alias) === needle) {
        return { tool, matchedOn: alias, confidence: "Alias" };
      }
    }
  }

  let best: LookupResult | null = null;
  for (const tool of tools) {
    for (const name of [tool.name, ...(tool.aliases ?? [])]) {
      const normalized = normalize(name);
      if (normalized.length < 4) continue;
      if (!containsPhrase(needle, normalized) && !containsPhrase(normalized, needle)) continue;
      if (!best || normalized.length > normalize(best.matchedOn).length) {
        best = { tool, matchedOn: name, confidence: "Partial" };
      }
    }
  }
  return best;
}

export type ScanRow = {
  line: string;
  match: LookupResult | null;
};

export function scanInventory(tools: Tool[], text: string): ScanRow[] {
  const seen = new Set<string>();
  const rows: ScanRow[] = [];
  for (const raw of text.split(/\n|,/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = normalize(line);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ line, match: lookupTool(tools, line) });
  }
  return rows;
}

export const SAMPLE_INVENTORY = [
  "CrowdStrike Falcon",
  "snowflake: security.edr_agents",
  "Microsoft Sentinel",
  "Okta Workforce",
  "Wiz",
  "unknown-branch-firewall",
].join("\n");


export type FitKind = "Yours" | "Already licensed" | "Fills the gap" | "Fills it, with a catch" | "Overlaps";

export type GapFit = { kind: FitKind; detail: string };

/** How one product would change this category for this company. */
export function gapFit(
  tool: Tool,
  owned: Tool[],
  size: CompanySize,
  budget: Budget,
  licensed: Map<string, { suite: Suite; as: string }> = new Map(),
): GapFit {
  if (owned.some((item) => item.id === tool.id)) {
    return { kind: "Yours", detail: "You already run this." };
  }
  const license = licensed.get(tool.id);
  const heldElsewhere = owned.filter((item) => item.categoryId === tool.categoryId);
  if (license && heldElsewhere.length > 0) {
    return {
      kind: "Overlaps",
      detail: `You license ${license.as} through ${license.suite.name} but run ${heldElsewhere.map((item) => item.name).join(" and ")} here. You may be paying twice for this category; decide which one to keep.`,
    };
  }
  if (license) {
    return {
      kind: "Already licensed",
      detail: `You already pay for ${license.as} through ${license.suite.name}. Turn it on and prove it before buying another product here.`,
    };
  }
  const heldHere = owned.filter((item) => item.categoryId === tool.categoryId);
  if (heldHere.length > 0) {
    const names = heldHere.map((item) => item.name).join(" and ");
    return {
      kind: "Overlaps",
      detail: `You already run ${names} here. ${tool.name} would be a second product for the same job and would not raise the score.`,
    };
  }
  const catches: string[] = [];
  if (!tool.bestFor.includes(size)) catches.push(`it is not aimed at a ${size} company`);
  if (!withinBudget(tool.priceTier, budget)) catches.push(`its ${tool.priceTier.toLowerCase()} price tier is above a ${budget} budget`);
  for (const item of owned) {
    const extension = item.extensions?.find((row) => row.covers === tool.categoryId);
    if (extension) catches.push(`check ${extension.name} on ${item.name} first, which may already cover this`);
  }
  for (const [productId, row] of licensed) {
    if (owned.some((item) => item.id === productId)) continue;
    const product = TOOLS.find((item) => item.id === productId);
    const extension = product?.extensions?.find((item) => item.covers === tool.categoryId);
    if (product && extension) catches.push(`${row.suite.name} may already cover this through ${extension.name} on ${product.name}`);
  }
  if (catches.length > 0) {
    return { kind: "Fills it, with a catch", detail: `Closes the gap, but ${catches.join("; ")}.` };
  }
  return { kind: "Fills the gap", detail: `Closes the gap and fits a ${size} company on a ${budget} budget.` };
}

export const FIT_ORDER: Record<FitKind, number> = {
  Yours: 0,
  "Already licensed": 1,
  "Fills the gap": 1.5,
  "Fills it, with a catch": 2,
  Overlaps: 3,
};

export type SuiteInclude = { product: string; as: string };

export type Suite = {
  id: string;
  name: string;
  vendor: string;
  includes: SuiteInclude[];
  notes?: string;
  sources: Source[];
};

export const SUITES: Suite[] = suitesData as Suite[];

/** Product id -> the licensed edition and the suite that carries it. */
export function licensedProducts(suiteIds: readonly string[]): Map<string, { suite: Suite; as: string }> {
  const map = new Map<string, { suite: Suite; as: string }>();
  for (const suite of SUITES) {
    if (!suiteIds.includes(suite.id)) continue;
    for (const item of suite.includes) map.set(item.product, { suite, as: item.as });
  }
  return map;
}
