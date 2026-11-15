// Pure assessment logic: what is covered, what is operating, how mature each
// category is, and how each catalog product would change a category. The
// React component only renders what this module works out, so every rule here
// can be unit-tested without a browser.
import {
  CATEGORIES,
  FIT_ORDER,
  TOOLS,
  addonKey,
  competeCall,
  gapFit,
  licensedProducts,
  lookupTool,
  ownedToolIds,
  type Budget,
  type Category,
  type CompanySize,
  type GapFit,
  type OperatingStatus,
  type Suite,
  type Tool,
} from "@/data/catalog";

export type CategoryState = "Covered" | "Not proven" | "Licensed" | "Gap";

export type StackItem = { name: string; status: OperatingStatus };

export type AssessmentInput = {
  /** Categories marked as covered by a product that is not in the catalog. */
  checked: readonly string[];
  /** Free text naming products the company runs (comma or newline separated). */
  ownedText: string;
  /** Catalog product ids picked on the Setup tab. */
  picked: readonly string[];
  /** Licence suite ids. */
  suites: readonly string[];
  /** Owned add-ons, as addonKey(productId, name). */
  addons: readonly string[];
  categoryStatus: Readonly<Record<string, OperatingStatus>>;
  stack: readonly StackItem[];
  /** Category id -> practice ids the company confirms it does. */
  practices: Readonly<Record<string, readonly string[]>>;
};

export const MAX_LEVEL = 4;

export const LEVEL_NAMES = ["Not operating", "Deployed", "Practised", "Managed", "Proven"] as const;

export type CategoryLevel = {
  category: Category;
  level: number;
  /** Practice ids that count toward the level (only when the category is operating). */
  confirmed: string[];
};

export type Assessment = {
  ownedIds: Set<string>;
  ownedTools: Tool[];
  /** Categories of the catalog products picked on the Setup tab. */
  pickedCategories: Set<string>;
  licensed: Map<string, { suite: Suite; as: string }>;
  /** Category id -> "Add-on on Product" for add-ons that cover another category. */
  addonCovers: Map<string, string>;
  /** Categories where something is in place, operating or not. */
  present: Set<string>;
  /** Categories where something is marked Deployed. */
  operating: Set<string>;
  levels: Map<string, CategoryLevel>;
  /** Share of essential categories operating, 0-100. */
  coverage: number;
  /** Average maturity level of essential categories, as 0-100. */
  maturity: number;
  essentialOperating: number;
  essentialTotal: number;
  state: (categoryId: string) => CategoryState;
};

export function assess(input: AssessmentInput, tools: Tool[] = TOOLS, categories: Category[] = CATEGORIES): Assessment {
  const ownedIds = ownedToolIds(tools, input.ownedText);
  for (const id of input.picked) ownedIds.add(id);
  const ownedTools = tools.filter((tool) => ownedIds.has(tool.id));
  const licensed = licensedProducts(input.suites);
  const pickedCategories = new Set(tools.filter((tool) => input.picked.includes(tool.id)).map((tool) => tool.categoryId));

  // Add-ons you have on products you run can cover another category (for example Falcon Spotlight for vulnerabilities).
  const addonCovers = new Map<string, string>();
  for (const tool of ownedTools) {
    for (const extension of tool.extensions ?? []) {
      if (extension.covers && input.addons.includes(addonKey(tool.id, extension.name))) {
        addonCovers.set(extension.covers, extension.name + " on " + tool.name);
      }
    }
  }

  const present = new Set(input.checked);
  for (const tool of ownedTools) present.add(tool.categoryId);
  for (const id of addonCovers.keys()) present.add(id);

  const operating = new Set<string>();
  for (const id of [...input.checked, ...pickedCategories, ...addonCovers.keys()]) {
    if ((input.categoryStatus[id] ?? "Untested") === "Deployed") operating.add(id);
  }
  for (const item of input.stack) {
    if (item.status !== "Deployed") continue;
    const match = lookupTool(tools, item.name);
    if (match) operating.add(match.tool.categoryId);
  }

  const levels = new Map<string, CategoryLevel>();
  for (const category of categories) levels.set(category.id, categoryLevel(category, operating.has(category.id), input.practices[category.id] ?? []));

  const essential = categories.filter((category) => category.essential);
  const essentialOperating = essential.filter((category) => operating.has(category.id)).length;
  const levelSum = essential.reduce((sum, category) => sum + (levels.get(category.id)?.level ?? 0), 0);

  const state = (id: string): CategoryState => {
    if (operating.has(id)) return "Covered";
    if (present.has(id)) return "Not proven";
    if (tools.some((tool) => tool.categoryId === id && licensed.has(tool.id))) return "Licensed";
    return "Gap";
  };

  return {
    ownedIds,
    ownedTools,
    pickedCategories,
    licensed,
    addonCovers,
    present,
    operating,
    levels,
    coverage: essential.length === 0 ? 0 : Math.round((essentialOperating / essential.length) * 100),
    maturity: essential.length === 0 ? 0 : Math.round((levelSum / (essential.length * MAX_LEVEL)) * 100),
    essentialOperating,
    essentialTotal: essential.length,
    state,
  };
}

/**
 * Level 0 when nothing is operating. Level 1 once it is deployed, plus one
 * for each practice the company confirms, up to MAX_LEVEL. Practices do not
 * count while the category is not operating: a process around a tool that
 * is not running is not a control.
 */
export function categoryLevel(category: Category, isOperating: boolean, confirmedIds: readonly string[]): CategoryLevel {
  if (!isOperating) return { category, level: 0, confirmed: [] };
  const known = new Set((category.practices ?? []).map((practice) => practice.id));
  const confirmed = [...new Set(confirmedIds)].filter((id) => known.has(id));
  return { category, level: Math.min(MAX_LEVEL, 1 + confirmed.length), confirmed };
}

export type FieldRow = { tool: Tool; fit: GapFit };

/** Every catalog product in a category, with how it would change the category for this company, best fit first. */
export function productField(assessment: Assessment, categoryId: string, size: CompanySize, budget: Budget, tools: Tool[] = TOOLS): FieldRow[] {
  const held = assessment.ownedTools.filter((tool) => tool.categoryId === categoryId);
  const call = competeCall(held, tools, categoryId, size, budget);
  const viaAddon = held.length === 0 ? assessment.addonCovers.get(categoryId) : undefined;
  return call.field
    .map((tool) => {
      const fit = gapFit(tool, assessment.ownedTools, size, budget, assessment.licensed);
      if (viaAddon && (fit.kind === "Fills the gap" || fit.kind === "Fills it, with a catch")) {
        return {
          tool,
          fit: {
            kind: "Overlaps" as const,
            detail: `You already run ${viaAddon} here. ${tool.name} would be a second product for the same job.`,
          },
        };
      }
      return { tool, fit };
    })
    .sort((x, y) => FIT_ORDER[x.fit.kind] - FIT_ORDER[y.fit.kind]);
}

/** The next practice to work on in a category, or null when it is at the top level or not operating. */
export function nextPractice(level: CategoryLevel): { id: string; text: string } | null {
  if (level.level === 0 || level.level >= MAX_LEVEL) return null;
  return (level.category.practices ?? []).find((practice) => !level.confirmed.includes(practice.id)) ?? null;
}

/** Plain-text lines for reports and the shortlist PDF. */
export function vendorQuestionLines(category: Category): string[] {
  const questions = category.vendorQuestions;
  if (!questions) return [];
  return [
    "Questions to ask vendors",
    ...questions.claims.map((row) => `Claim: "${row.claim}" Ask: ${row.ask}`),
    ...questions.proof.map((line) => "Proof to request: " + line),
    ...questions.redFlags.map((line) => "Red flag: " + line),
  ];
}
