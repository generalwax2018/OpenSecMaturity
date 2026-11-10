import { useEffect, useMemo, useState } from "react";
import { Scale, Search, Shield, Swords } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BUDGET_TIER,
  BUDGETS,
  CATEGORIES,
  COMPANY_SIZES,
  COMPETE,
  DOMAINS,
  FRAMEWORKS,
  TOOLS,
  AREA_PRESETS,
  adviceForGap,
  categoryById,
  competeCall,
  controlLine,
  defaultSeverity,
  diffInventory,
  domainStats,
  lookupTool,
  maturityScore,
  ownedToolIds,
  recommendTools,
  SAMPLE_INVENTORY,
  scanInventory,
  reviewCounts,
  reviewState,
  vendorOf,
  gapFit,
  addonKey,
  addonOpportunities,
  activeCatalogVersion,
  BUNDLED_CATALOG_VERSION,
  compareVersions,
  PRICING_LABEL,
  type AddonOpportunity,
  type ToolExtension,
  gapPriority,
  licensedProducts,
  requiredBy,
  requirementLabel,
  SUITES,
  FIT_ORDER,
  type FitKind,
  type Tool,
  windowForSeverity,
  OPERATING_STATUSES,
  PLAN_WINDOWS,
  SEVERITIES,
  type Budget,
  type BusinessArea,
  type CompanySize,
  type Domain,
  type FrameworkId,
  type OperatingStatus,
  type PlanWindow,
  type ScanDiff,
  type ScanRow,
  type Severity,
} from "@/data/catalog";
import { BUNDLED_STANDARDS, type StandardsFeed } from "@/data/standards";
import { downloadInventoryTemplate, parseInventoryFile } from "@/lib/inventory-import";
import { downloadPdfReport, downloadTextReport, downloadWorkbook } from "@/lib/report-files";
import { checkGitHub, type GitHubCheck } from "@/lib/github-check";
import { fetchRemoteCatalog, installCatalog, resetCatalog, type CatalogCheck } from "@/lib/catalog-update";
import { GITHUB_REPO } from "@/data/app-meta";
import { exportWorkspace, importWorkspace, loadWorkspaceData, resetWorkspace, usePersistedState, useTheme, type Theme } from "@/lib/persist";

const DOMAIN_ICON: Record<Domain, typeof Shield> = {
  "Blue Team": Shield,
  "Red Team": Swords,
  Governance: Scale,
};

const STARTING_COVERED: string[] = [];

/** A fictional mid-market healthcare company, used by "Try an example company". */
const EXAMPLE_WORKSPACE: Record<string, unknown> = {
  size: "Mid-market",
  budget: "Balanced",
  areas: [
    { id: "company", name: "Company-wide", frameworks: ["cis", "soc2"] },
    { id: "clinical", name: "Clinical", frameworks: ["hipaa"] },
  ],
  suites: ["m365-e3"],
  picked: ["microsoft-defender", "okta", "veeam", "knowbe4", "microsoft-sentinel"],
  categoryStatus: { endpoint: "Deployed", identity: "Deployed", backup: "Partial", awareness: "Deployed", siem: "Partial" },
  board: "compete",
  competeFilter: "gaps",
  competeId: "email",
};

type CategoryState = "Covered" | "Not proven" | "Licensed" | "Gap";

type BoardId = "overview" | "stack" | "risk" | "plan" | "compete" | "controls";

const BOARDS: { id: BoardId; label: string }[] = [
  { id: "stack", label: "1. Setup" },
  { id: "compete", label: "2. Compare" },
  { id: "overview", label: "Overview" },
  { id: "risk", label: "Risk" },
  { id: "plan", label: "Plan" },
  { id: "controls", label: "Controls" },
];

type ConfirmedTool = {
  key: string;
  name: string;
  vendor: string;
  purpose: string;
  evidence: string;
  status: OperatingStatus;
};

type Proposal = ScanRow & { vendor?: string; purpose?: string; evidence?: string };

type RiskAcceptance = {
  owner: string;
  expires: string;
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function StatusPicker({
  value,
  onChange,
}: {
  value: OperatingStatus;
  onChange: (status: OperatingStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {OPERATING_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={value === status}
          onClick={() => onChange(status)}
          className={
            "min-h-11 md:min-h-9 rounded-lg px-3 text-xs font-medium " +
            (value === status ? "bg-brand text-on-brand" : "bg-surface text-ink-muted")
          }
        >
          {status}
        </button>
      ))}
    </div>
  );
}

export function MaturityApp() {
  const [size, setSize] = usePersistedState<CompanySize>("size", "Mid-market");
  const [budget, setBudget] = usePersistedState<Budget>("budget", "Balanced");
  const [areas, setAreas] = usePersistedState<BusinessArea[]>("areas", [
    { id: "company", name: "Company-wide", frameworks: ["cis"] },
  ]);
  const [categoryStatus, setCategoryStatus] = usePersistedState<Record<string, OperatingStatus>>("categoryStatus", {});
  const [owners, setOwners] = usePersistedState<Record<string, string>>("owners", {});
  const [severities, setSeverities] = usePersistedState<Record<string, Severity>>("severities", {});
  const [likelihoods, setLikelihoods] = usePersistedState<Record<string, Severity>>("likelihoods", {});
  const [windows, setWindows] = usePersistedState<Record<string, PlanWindow>>("windows", {});
  const [accepted, setAccepted] = usePersistedState<Record<string, RiskAcceptance>>("accepted", {});
  const [expiryDraft, setExpiryDraft] = useState<Record<string, string>>({});
  const [lastScan, setLastScan] = usePersistedState<string[] | null>("lastScan", null);
  const [scanDiff, setScanDiff] = useState<ScanDiff | null>(null);
  const [checked, setChecked] = usePersistedState<string[]>("checked", STARTING_COVERED);
  const [owned, setOwned] = usePersistedState("owned", "");
  const [draftName, setDraftName] = useState("");
  const [draftVendor, setDraftVendor] = useState("");
  const [draftPurpose, setDraftPurpose] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [inventory, setInventory] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [workspaceNote, setWorkspaceNote] = useState("");
  const [theme, setTheme] = useTheme();
  const [importNote, setImportNote] = useState("");
  const [stack, setStack] = usePersistedState<ConfirmedTool[]>("stack", []);
  const [picked, setPicked] = usePersistedState<string[]>("picked", []);
  const [suites, setSuites] = usePersistedState<string[]>("suites", []);
  const [addons, setAddons] = usePersistedState<string[]>("addons", []);
  const [catalogCheck, setCatalogCheck] = useState<CatalogCheck | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [shortlist, setShortlist] = usePersistedState<Record<string, string[]>>("shortlist", {});
  const [filters, setFilters] = usePersistedState<{ deployment: "any" | "SaaS" | "Self-hosted"; fedramp: boolean; eu: boolean }>(
    "filters",
    { deployment: "any", fedramp: false, eu: false },
  );
  const [pickerQuery, setPickerQuery] = useState("");
  const [competeFilter, setCompeteFilter] = usePersistedState<"gaps" | "all">("competeFilter", "all");
  const [lookup, setLookup] = useState("");
  const [board, setBoard] = usePersistedState<BoardId>("board", "stack");
  const [competeId, setCompeteId] = usePersistedState("competeId", "endpoint");
  const [controlsPanel, setControlsPanel] = useState<"mapped" | "compliance">("mapped");
  const [extraFrameworks, setExtraFrameworks] = usePersistedState<{ id: string; name: string; summary: string; version?: string }[]>("extraFrameworks", []);
  const [versions, setVersions] = usePersistedState<Record<string, string>>("versions", {});
  const [updateNote, setUpdateNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [gitChecking, setGitChecking] = useState(false);
  const [gitCheck, setGitCheck] = useState<GitHubCheck | null>(null);
  const [gitError, setGitError] = useState("");
  const [addedControls, setAddedControls] = usePersistedState<
    { id: string; frameworkId: string; name: string; text: string; operating: boolean }[]
  >("addedControls", []);
  const [draftFramework, setDraftFramework] = useState("");
  const [draftControlName, setDraftControlName] = useState("");
  const [draftControlText, setDraftControlText] = useState("");
  const [draftControlFramework, setDraftControlFramework] = useState("cis");
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const stackNames = stack.map((item) => item.name).join(", ");
  const ownedCombined = [owned, stackNames].filter(Boolean).join(", ");
  const ownedIds = useMemo(() => {
    const ids = ownedToolIds(TOOLS, ownedCombined);
    for (const id of picked) ids.add(id);
    return ids;
  }, [ownedCombined, picked]);
  const licensed = useMemo(() => licensedProducts(suites), [suites]);
  const pickedCategories = useMemo(
    () => new Set(TOOLS.filter((tool) => picked.includes(tool.id)).map((tool) => tool.categoryId)),
    [picked],
  );
  // Add-ons you have on products you run can cover another category (for example Falcon Spotlight for vulnerabilities).
  const addonCovers = useMemo(() => {
    const map = new Map<string, string>();
    for (const tool of TOOLS) {
      if (!ownedIds.has(tool.id)) continue;
      for (const extension of tool.extensions ?? []) {
        if (extension.covers && addons.includes(addonKey(tool.id, extension.name))) {
          map.set(extension.covers, extension.name + " on " + tool.name);
        }
      }
    }
    return map;
  }, [ownedIds, addons]);
  const present = useMemo(() => {
    const ids = new Set(checked);
    for (const tool of TOOLS) {
      if (ownedIds.has(tool.id)) ids.add(tool.categoryId);
    }
    for (const id of addonCovers.keys()) ids.add(id);
    return ids;
  }, [checked, ownedIds, addonCovers]);
  const operating = useMemo(() => {
    const ids = new Set<string>();
    for (const id of [...checked, ...pickedCategories, ...addonCovers.keys()]) {
      if ((categoryStatus[id] ?? "Untested") === "Deployed") ids.add(id);
    }
    for (const item of stack) {
      if (item.status !== "Deployed") continue;
      const match = lookupTool(TOOLS, item.name);
      if (match) ids.add(match.tool.categoryId);
    }
    return ids;
  }, [checked, pickedCategories, addonCovers, categoryStatus, stack]);
  const score = useMemo(() => maturityScore(CATEGORIES, operating), [operating]);
  const domains = useMemo(() => domainStats(CATEGORIES, operating), [operating]);
  const recommendations = useMemo(
    () => recommendTools(TOOLS, size, budget, present, ownedCombined).filter((tool) => !ownedIds.has(tool.id)),
    [size, budget, present, ownedCombined, ownedIds],
  );
  const essential = CATEGORIES.filter((category) => category.essential);
  const essentialCovered = essential.filter((category) => operating.has(category.id)).length;
  const gaps = essential.filter((category) => !operating.has(category.id));
  const frameworkIds = [...new Set(areas.flatMap((area) => area.frameworks))];
  const allFrameworks = [...FRAMEWORKS, ...extraFrameworks];
  const selectedFrameworks = allFrameworks.filter((framework) => frameworkIds.includes(framework.id));
  const overlaps = useMemo(() => {
    const names = new Map<string, Set<string>>();
    const add = (categoryId: string, name: string) => {
      const current = names.get(categoryId) ?? new Set<string>();
      current.add(name);
      names.set(categoryId, current);
    };
    for (const tool of TOOLS) {
      if (ownedIds.has(tool.id)) add(tool.categoryId, tool.name);
    }
    return [...names.entries()]
      .filter(([, set]) => set.size > 1)
      .map(([categoryId, set]) => ({ category: categoryById(categoryId), names: [...set] }))
      .filter((row): row is { category: NonNullable<typeof row.category>; names: string[] } => Boolean(row.category));
  }, [ownedIds]);

  const chartData = domains.map((row) => ({
    domain: row.domain === "Governance" ? "Governance" : row.domain.replace(" Team", ""),
    coverage: row.percent,
  }));
  const lookupNeedle = lookup.trim().toLowerCase();
  const ownedTools = TOOLS.filter((tool) => ownedIds.has(tool.id));

  function provenKeys(): Set<string> {
    const keys = new Set<string>();
    for (const item of stack) {
      if (item.status === "Deployed") keys.add(nameKey(item.name));
    }
    for (const tool of TOOLS) {
      if (!operating.has(tool.categoryId)) continue;
      keys.add(nameKey(tool.name));
      for (const alias of tool.aliases ?? []) keys.add(nameKey(alias));
    }
    return keys;
  }

  function recordScan(names: string[]) {
    setScanDiff(diffInventory(lastScan, names, provenKeys()));
    setLastScan(names.map((line) => line.trim()).filter(Boolean));
  }

  function acceptanceFor(id: string): (RiskAcceptance & { expired: boolean }) | null {
    const row = accepted[id];
    if (!row?.expires) return null;
    return { ...row, expired: row.expires < todayStamp() };
  }

  const openGaps = gaps.filter((category) => {
    const row = acceptanceFor(category.id);
    return !row || row.expired;
  });
  const acceptedGaps = gaps.filter((category) => {
    const row = acceptanceFor(category.id);
    return Boolean(row && !row.expired);
  });

  function impactFor(id: string): Severity {
    return severities[id] ?? defaultSeverity(id);
  }

  function likelihoodFor(id: string): Severity {
    const row = acceptanceFor(id);
    if (row && !row.expired) return "Low";
    return likelihoods[id] ?? (present.has(id) ? "Medium" : "High");
  }

  const matrixImpacts: Severity[] = ["High", "Medium", "Low"];
  const matrixLikelihoods: Severity[] = ["Low", "Medium", "High"];

  function matrixCell(impact: Severity, likelihood: Severity) {
    return gaps.filter((category) => impactFor(category.id) === impact && likelihoodFor(category.id) === likelihood);
  }

  function matrixHeat(impact: Severity, likelihood: Severity): string {
    const rank = { Low: 1, Medium: 2, High: 3 };
    const score = rank[impact] + rank[likelihood];
    if (score >= 6) return "bg-risk-high-soft text-risk-high";
    if (score >= 5) return "bg-risk-mid-soft text-risk-mid";
    if (score >= 4) return "bg-subtle text-ink";
    return "bg-surface text-ink-muted";
  }

  const register = gaps
    .map((category) => {
      const advice = adviceForGap(category, TOOLS, size, budget, ownedTools, present.has(category.id));
      const plan = planFor(category.id);
      const acceptance = acceptanceFor(category.id);
      const impact = impactFor(category.id);
      const likelihood = likelihoodFor(category.id);
      const rank = { Low: 1, Medium: 2, High: 3 };
      const active = Boolean(acceptance && !acceptance.expired);
      return {
        category,
        impact,
        likelihood,
        score: rank[impact] * rank[likelihood],
        treatment: active ? "Accept" : advice.action,
        owner: active ? acceptance?.owner || "Unassigned" : plan.owner || "Unassigned",
        due: active ? acceptance?.expires || "" : plan.window,
        status: active ? "Accepted" : acceptance?.expired ? "Expired" : "Open",
      };
    })
    .sort((a, b) => b.score - a.score || a.category.name.localeCompare(b.category.name));

  function planFor(categoryId: string) {
    const severity = severities[categoryId] ?? defaultSeverity(categoryId);
    return {
      severity,
      window: windows[categoryId] ?? windowForSeverity(severity),
      owner: owners[categoryId] ?? "",
    };
  }

  function downloadReport(format: "pdf" | "xlsx" | "txt") {
    const competeRows = CATEGORIES.flatMap((category) =>
      fieldFor(category.id).map(({ tool, fit }) => ({
        Category: category.name,
        State: categoryState(category.id),
        "Required by": requiredBy(category, builtInFrameworkIds)
          .map((id) => FRAMEWORKS.find((item) => item.id === id)?.name ?? id)
          .join(", "),
        Product: tool.name,
        Vendor: tool.vendor,
        Effect: fit.kind,
        Why: fit.detail,
        Price: tool.priceTier,
        "Built for": tool.bestFor.join(", "),
        Deployment: tool.deployment.join(", "),
        FedRAMP: tool.fedramp?.level ?? "",
        "EU residency": tool.euResidency ? "Yes" : "",
        Strengths: tool.compete?.wins ?? "",
        Weaknesses: tool.compete?.loses ?? "",
        Shortlisted: (shortlist[category.id] ?? []).includes(tool.id) ? "Yes" : "",
      })),
    );
    const shortlistRows = competeRows.filter((row) => row.Shortlisted === "Yes");
    const registerRows = register.map((row) => ({
      Score: row.score,
      Status: row.status,
      Risk: row.category.name,
      Domain: row.category.domain,
      Impact: row.impact,
      Likelihood: row.likelihood,
      Treatment: row.treatment,
      Owner: row.owner,
      Due: row.due,
    }));
    const planRows = openGaps.map((category) => {
      const advice = adviceForGap(category, TOOLS, size, budget, ownedTools, present.has(category.id));
      const plan = planFor(category.id);
      return {
        Window: plan.window,
        Severity: plan.severity,
        Gap: category.name,
        Action: advice.action,
        Recommendation: advice.headline,
        Owner: plan.owner || "Unassigned",
        Why: advice.why,
      };
    });
    const lines = [
      "OpenSecMaturity report",
      `Score: ${score} / 100 (deployed essentials only)`,
      `Company: ${size} | Budget: ${budget} | up to ${BUDGET_TIER[budget]}`,
      "",
      "Domains",
      ...domains.map((row) => `${row.domain}: ${row.percent}% (${row.covered} of ${row.total})`),
      "",
      "Areas",
      ...areas.map((area) => `${area.name}: ${area.frameworks.join(", ") || "none"}`),
      "",
      "Risk matrix",
      ...matrixImpacts.flatMap((impact) =>
        matrixLikelihoods.map((likelihood) => {
          const names = matrixCell(impact, likelihood).map((category) => category.name);
          return `${impact} impact / ${likelihood} likelihood: ${names.join(", ") || "none"}`;
        }),
      ),
      "",
      "Risk register",
      ...(registerRows.length === 0
        ? ["None. Every essential is operating."]
        : registerRows.map(
            (row) =>
              `${row.Score} | ${row.Status} | ${row.Risk} | ${row.Impact} impact | ${row.Likelihood} likelihood | ${row.Treatment} | ${row.Owner} | ${row.Due}`,
          )),
      "",
      "What to do",
      ...(planRows.length === 0
        ? ["No open gaps."]
        : planRows.map(
            (row) =>
              `${row.Window} | ${row.Severity} | ${row.Gap} | ${row.Action}: ${row.Recommendation} | Owner: ${row.Owner} | ${row.Why}`,
          )),
      "",
      "Accepted risk",
      ...(acceptedGaps.length === 0
        ? ["None."]
        : acceptedGaps.map((category) => {
            const row = acceptanceFor(category.id);
            return `${category.name} | ${row?.owner || "unassigned"} | until ${row?.expires}`;
          })),
      "",
      "Last rescan",
      ...(scanDiff
        ? [
            scanDiff.baseline ? "Baseline saved." : "Compared with the previous pull.",
            `Appeared: ${scanDiff.appeared.join(", ") || "none"}`,
            `Disappeared: ${scanDiff.disappeared.join(", ") || "none"}`,
            `Still unproven: ${scanDiff.unproven.join(", ") || "none"}`,
          ]
        : ["No scan yet."]),
      "",
      "Overlap",
      ...(overlaps.length === 0
        ? ["None. No category has two products."]
        : overlaps.map((row) => `${row.category.name}: ${row.names.join(", ")}. One operating tool is enough.`)),
      "",
      "Controls in use",
      ...(selectedFrameworks.length === 0
        ? ["None."]
        : selectedFrameworks.map((framework) => `${framework.name}${versions[framework.id] ? " | " + versions[framework.id] : ""}`)),
      "",
      "Add-ons for the products you run",
      ...(addonRows.length === 0
        ? ["None listed for the products you picked."]
        : addonRows.map(
            (row) =>
              `${row.product.name}: ${row.addon.name}${row.addon.ai ? " (AI)" : ""} | ${row.addon.pricing ? PRICING_LABEL[row.addon.pricing] : "pricing not checked"} | ${row.effect}. ${row.why}`,
          )),
      "",
      "Licence suites",
      ...(suites.length === 0 ? ["None selected."] : SUITES.filter((suite) => suites.includes(suite.id)).map((suite) => suite.name)),
      "",
      "Shortlist",
      ...(shortlistRows.length === 0
        ? ["Nothing shortlisted."]
        : shortlistRows.map((row) => `${row.Category} | ${row.Product} (${row.Vendor}) | ${row.Effect} | ${row.Price}`)),
      "",
      "Gap comparison",
      ...CATEGORIES.filter((category) => categoryState(category.id) !== "Covered").flatMap((category) => {
        const reqs = requiredBy(category, builtInFrameworkIds).map((id) => FRAMEWORKS.find((item) => item.id === id)?.name ?? id);
        return [
          `${category.name} | ${categoryState(category.id)}${reqs.length ? " | required by " + reqs.join(", ") : ""}`,
          ...competeRows
            .filter((row) => row.Category === category.name)
            .map((row) => `  ${row.Product}: ${row.Effect} | ${row.Price} | ${row.Deployment}${row.FedRAMP ? " | FedRAMP " + row.FedRAMP : ""}`),
          "",
        ];
      }),
      "Price tiers and strengths and weaknesses are editorial. Confirm current terms with each vendor.",
    ];
    if (format === "pdf") {
      downloadPdfReport(lines);
      return;
    }
    if (format === "xlsx") {
      void downloadWorkbook({
        Summary: [
          { Item: "Score", Value: score },
          { Item: "Company size", Value: size },
          { Item: "Budget", Value: budget },
          { Item: "Price ceiling", Value: BUDGET_TIER[budget] },
        ],
        Domains: domains.map((row) => ({
          Domain: row.domain,
          Percent: row.percent,
          Covered: row.covered,
          Total: row.total,
        })),
        Register: registerRows,
        Plan: planRows,
        Controls: selectedFrameworks.map((framework) => ({
          Framework: framework.name,
          Version: versions[framework.id] ?? "",
        })),
        "Gap comparison": competeRows,
        Shortlist: shortlistRows,
        "Add-ons": addonRows.map((row) => ({
          Product: row.product.name,
          "Add-on": row.addon.name,
          AI: row.addon.ai ? "Yes" : "",
          Pricing: row.addon.pricing ? PRICING_LABEL[row.addon.pricing] : "Not checked",
          "Pricing note": row.addon.pricingNote ?? "",
          Effect: row.effect,
          Why: row.why,
        })),
      });
      return;
    }
    downloadTextReport(lines);
  }

  function confirmTool(name: string, vendor: string, purpose: string, evidence: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStack((current) => {
      const key = trimmed.toLowerCase();
      const next = current.filter((item) => item.key !== key);
      next.push({
        key,
        name: trimmed,
        vendor: vendor.trim(),
        purpose: purpose.trim(),
        evidence,
        status: "Untested",
      });
      return next;
    });
  }

  function lookupDraft() {
    const found = lookupTool(TOOLS, draftName);
    if (!found) {
      setDraftNote("No catalog match. Enter the vendor and purpose, then add it.");
      return;
    }
    setDraftName(found.tool.name);
    setDraftVendor(vendorOf(found.tool));
    setDraftPurpose(found.tool.description);
    setDraftNote(`${found.confidence} match on “${found.matchedOn}”. Edit the purpose if this estate uses it differently.`);
  }

  function addDraft() {
    confirmTool(draftName, draftVendor, draftPurpose, "Added manually");
    setDraftName("");
    setDraftVendor("");
    setDraftPurpose("");
    setDraftNote("");
  }

  function togglePick(tool: (typeof TOOLS)[number]) {
    setPicked((current) => (current.includes(tool.id) ? current.filter((id) => id !== tool.id) : [...current, tool.id]));
    setCategoryStatus((current) => (current[tool.categoryId] ? current : { ...current, [tool.categoryId]: "Deployed" }));
  }

  function categoryState(id: string): CategoryState {
    if (operating.has(id)) return "Covered";
    if (present.has(id)) return "Not proven";
    if (TOOLS.some((tool) => tool.categoryId === id && licensed.has(tool.id))) return "Licensed";
    return "Gap";
  }

  const builtInFrameworkIds = frameworkIds.filter((id): id is FrameworkId =>
    (["cis", "nist", "iso", "soc2", "pci", "hipaa"] as string[]).includes(id),
  );

  function passesFilters(tool: Tool): boolean {
    if (filters.deployment !== "any" && !tool.deployment.includes(filters.deployment)) return false;
    const selfHosted = tool.deployment.includes("Self-hosted");
    if (filters.fedramp && !tool.fedramp && !selfHosted) return false;
    if (filters.eu && !tool.euResidency && !selfHosted) return false;
    return true;
  }

  function fieldFor(categoryId: string) {
    const held = ownedTools.filter((tool) => tool.categoryId === categoryId);
    const call = competeCall(held, TOOLS, categoryId, size, budget);
    const viaAddon = held.length === 0 ? addonCovers.get(categoryId) : undefined;
    return call.field
      .map((tool) => {
        const fit = gapFit(tool, ownedTools, size, budget, licensed);
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

  const addonRows = addonOpportunities(ownedTools, addons, present);

  function toggleAddon(tool: Tool, extension: ToolExtension) {
    const key = addonKey(tool.id, extension.name);
    setAddons((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
    if (extension.covers) {
      const covers = extension.covers;
      setCategoryStatus((current) => (current[covers] ? current : { ...current, [covers]: "Deployed" }));
    }
  }

  function toggleShortlist(categoryId: string, toolId: string) {
    setShortlist((current) => {
      const list = current[categoryId] ?? [];
      if (list.includes(toolId)) return { ...current, [categoryId]: list.filter((id) => id !== toolId) };
      if (list.length >= 3) return current;
      return { ...current, [categoryId]: [...list, toolId] };
    });
  }

  function downloadShortlist(categoryId: string) {
    const category = categoryById(categoryId);
    if (!category) return;
    const rows = fieldFor(categoryId).filter((row) => (shortlist[categoryId] ?? []).includes(row.tool.id));
    const lines = [
      "OpenSecMaturity shortlist: " + category.name,
      `${size} company | ${budget} budget | ${todayStamp()}`,
      "",
      "What your frameworks ask for",
      ...(builtInFrameworkIds.length === 0
        ? ["No frameworks selected."]
        : builtInFrameworkIds.map((id) => {
            const row = category.requirements[id];
            const name = FRAMEWORKS.find((item) => item.id === id)?.name ?? id;
            return `${name}: ${requirementLabel(row.level, id)} | ${row.ref}`;
          })),
      "",
      ...rows.flatMap(({ tool, fit }) => [
        `${tool.name} (${tool.vendor})`,
        `Effect on the gap: ${fit.kind}. ${fit.detail}`,
        `Price: ${tool.priceTier} | Built for: ${tool.bestFor.join(", ")} | Deployment: ${tool.deployment.join(", ")}`,
        `FedRAMP: ${tool.fedramp ? tool.fedramp.level : tool.deployment.includes("Self-hosted") ? "n/a if self-hosted" : "not checked"} | EU residency: ${tool.euResidency ? "yes" : tool.deployment.includes("Self-hosted") ? "where you host it" : "not checked"}`,
        `Strengths: ${tool.compete?.wins ?? "-"}`,
        `Weaknesses: ${tool.compete?.loses ?? "-"}`,
        `Sources: ${tool.sources.map((source) => source.url).join(" ")}`,
        "",
      ]),
      "Price tiers and strengths and weaknesses are editorial. Confirm current terms with each vendor.",
    ];
    downloadPdfReport(lines, "opensecmaturity-shortlist-" + category.id + ".pdf");
  }

  function toggleCategory(id: string) {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function setFrameworkOn(id: string, on: boolean) {
    setAreas((current) =>
      current.map((area) => {
        const has = area.frameworks.includes(id);
        if (on && area.id === "company" && !has) return { ...area, frameworks: [...area.frameworks, id] };
        if (!on && has) return { ...area, frameworks: area.frameworks.filter((item) => item !== id) };
        return area;
      }),
    );
  }

  function addFramework() {
    const name = draftFramework.trim();
    if (!name) return;
    const existing = allFrameworks.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const id =
      existing?.id ??
      "custom-" +
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
    if (!existing) {
      setExtraFrameworks((current) => [...current, { id, name, summary: "Added for this company." }]);
    }
    setAreas((current) =>
      current.map((area) =>
        area.id === "company" && !area.frameworks.includes(id)
          ? { ...area, frameworks: [...area.frameworks, id] }
          : area,
      ),
    );
    setDraftControlFramework(id);
    setDraftFramework("");
  }

  function addControl() {
    const name = draftControlName.trim();
    if (!name) return;
    setAddedControls((current) => [
      ...current,
      {
        id: "control-" + current.length + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        frameworkId: draftControlFramework,
        name,
        text: draftControlText.trim() || name,
        operating: false,
      },
    ]);
    setDraftControlName("");
    setDraftControlText("");
  }

  async function updateControls() {
    setUpdating(true);
    let feed: StandardsFeed = BUNDLED_STANDARDS;
    let source = "the copy shipped with this app";
    try {
      const response = await fetch("./standards.json?t=" + Date.now());
      if (!response.ok) throw new Error("standards file unavailable");
      feed = (await response.json()) as StandardsFeed;
      if (!feed || !Array.isArray(feed.standards)) throw new Error("standards file unreadable");
      source = "the standards file published " + feed.published;
    } catch {
      source = "the copy shipped with this app. The standards file could not be reached";
    }
    const imported: string[] = [];
    const revised: string[] = [];
    const unchanged: string[] = [];
    const known = new Set<string>([...FRAMEWORKS.map((item) => item.id), ...extraFrameworks.map((item) => item.id)]);
    const nextExtras = extraFrameworks.map((item) => {
      const fresh = feed.standards.find((standard) => standard.id === item.id);
      if (!fresh) return item;
      if (versions[item.id] && versions[item.id] !== fresh.version) {
        revised.push(item.name + " " + versions[item.id] + " → " + fresh.version);
        return { ...item, name: fresh.name, summary: fresh.summary, version: fresh.version };
      }
      return { ...item, version: fresh.version };
    });
    for (const standard of feed.standards) {
      if (known.has(standard.id)) {
        const previous = versions[standard.id];
        if (previous && previous !== standard.version && !revised.some((line) => line.startsWith(standard.name))) {
          revised.push(standard.name + " " + previous + " → " + standard.version);
        } else {
          unchanged.push(standard.name);
        }
        continue;
      }
      nextExtras.push({
        id: standard.id,
        name: standard.name,
        summary: standard.summary,
        version: standard.version,
      });
      imported.push(standard.name);
    }
    setExtraFrameworks(nextExtras);
    setVersions((current) => {
      const next = { ...current };
      for (const standard of feed.standards) next[standard.id] = standard.version;
      return next;
    });
    const parts = ["Checked " + source + "."];
    parts.push(imported.length ? "Imported " + imported.join(", ") + ". They are available and not turned on." : "No new standards.");
    if (revised.length) parts.push("Updated " + revised.join(", ") + ".");
    parts.push(unchanged.length + " already current.");
    setUpdateNote(parts.join(" "));
    setUpdating(false);
  }

  async function checkRepo() {
    setGitChecking(true);
    setGitError("");
    setCatalogError("");
    const [app, catalog] = await Promise.allSettled([checkGitHub(), fetchRemoteCatalog()]);
    if (app.status === "fulfilled") setGitCheck(app.value);
    else {
      setGitCheck(null);
      setGitError("GitHub could not be reached. The check is optional and the app works without it.");
    }
    if (catalog.status === "fulfilled") setCatalogCheck(catalog.value);
    else {
      setCatalogCheck(null);
      setCatalogError("The catalog on GitHub could not be downloaded.");
    }
    setGitChecking(false);
  }

  return (
    <main className="min-h-screen bg-page text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 pb-24 md:px-8 md:py-10">
        <header className="flex flex-col gap-4 pt-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">OpenSecMaturity</h1>
            <p className="mt-1 text-sm text-ink-muted">Vendor-neutral security maturity and product comparison</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Export</span>
            <div className="inline-flex divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {(["pdf", "xlsx", "txt"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => downloadReport(format)}
                  className="min-h-11 px-4 text-sm font-medium text-ink hover:bg-subtle md:min-h-9"
                >
                  {format === "pdf" ? "PDF" : format === "xlsx" ? "Excel" : "Text"}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line pb-3 text-sm text-ink-muted">
          <p className="mr-auto">Saved in this browser only. Nothing you enter leaves this computer.</p>
          <button type="button" onClick={exportWorkspace} className="min-h-11 text-brand hover:underline md:min-h-8">
            Save to file
          </button>
          <label className="flex min-h-11 items-center text-brand hover:underline md:min-h-8">
            Open file
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                importWorkspace(file).catch(() => setWorkspaceNote("That file is not an OpenSecMaturity assessment."));
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear this assessment and start over? This cannot be undone.")) resetWorkspace();
            }}
            className="min-h-11 text-brand hover:underline md:min-h-8"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={() => void checkRepo()}
            disabled={gitChecking}
            className="min-h-11 text-brand hover:underline disabled:opacity-60 md:min-h-8"
          >
            {gitChecking ? "Checking…" : "Check for updates"}
          </button>
          <label className="flex min-h-11 items-center gap-2 md:min-h-8">
            <span className="sr-only">Theme</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              className="rounded-md bg-surface px-2 py-1 text-sm text-ink"
            >
              <option value="system">System theme</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {workspaceNote ? <p role="alert" className="w-full">{workspaceNote}</p> : null}
        </div>
          {gitError ? <p className="mt-3 text-sm text-ink-muted">{gitError}</p> : null}
          {gitCheck || catalogCheck || catalogError ? (
            <div className="rounded-card bg-surface p-4 text-sm text-ink">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-semibold">Product catalog</p>
                  <p className="mt-1 text-ink-muted">
                    This copy uses catalog {activeCatalogVersion}
                    {activeCatalogVersion !== BUNDLED_CATALOG_VERSION ? " (downloaded; built-in " + BUNDLED_CATALOG_VERSION + ")" : ""}.
                  </p>
                  {catalogError ? <p className="mt-1 text-ink-muted">{catalogError}</p> : null}
                  {catalogCheck ? (
                    catalogCheck.problems.length > 0 ? (
                      <p className="mt-2 text-risk-high">
                        GitHub has catalog {catalogCheck.remoteVersion}, but it did not pass the checks, so it was not used: {catalogCheck.problems[0]}
                      </p>
                    ) : compareVersions(catalogCheck.remoteVersion, activeCatalogVersion) > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span>
                          Catalog {catalogCheck.remoteVersion} is available with {catalogCheck.data.products.length} products.
                        </span>
                        <button
                          type="button"
                          onClick={() => installCatalog(catalogCheck.data)}
                          className="min-h-11 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand md:min-h-8"
                        >
                          Update catalog
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2">The catalog is up to date.</p>
                    )
                  ) : null}
                  {activeCatalogVersion !== BUNDLED_CATALOG_VERSION ? (
                    <button type="button" onClick={resetCatalog} className="mt-2 text-brand hover:underline">
                      Go back to the built-in catalog
                    </button>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-muted">
                    Catalog updates are data only: products, sources, and review dates. They are checked before use.
                  </p>
                </div>
                <div>
                  <p className="font-semibold">App version</p>
                  {gitCheck ? (
                    <>
                      <p className="mt-1">
                        {gitCheck.matches
                          ? "You have the latest version (" + gitCheck.localVersion + ")."
                          : gitCheck.remoteVersion
                            ? "Version " + gitCheck.remoteVersion + " is available. You have " + gitCheck.localVersion + "."
                            : "This copy is " + gitCheck.localVersion + "."}
                      </p>
                      {!gitCheck.matches && gitCheck.remoteVersion ? (
                        <a
                          href={"https://github.com/" + GITHUB_REPO + "/releases/latest"}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-brand px-3 text-sm font-medium text-on-brand md:min-h-8"
                        >
                          Download the new version
                        </a>
                      ) : null}
                      {gitCheck.features.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-1">
                          {gitCheck.features.slice(0, 4).map((item) => (
                            <li key={item.sha}>
                              <a href={safeHref(item.url)} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                                {item.title}
                              </a>
                              <span className="text-ink-muted"> · {item.date}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-ink-muted">Could not check.</p>
                  )}
                  <p className="mt-2 text-xs text-ink-muted">
                    New features come as a download you choose to install. The app never replaces its own code in the background.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

        <div className="sticky top-0 z-10 -mx-4 border-b border-subtle bg-page px-4 md:-mx-8 md:px-8">
          <div role="tablist" aria-label="Dashboard" className="flex gap-1 overflow-x-auto">
            {BOARDS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={"tab-" + item.id}
                aria-selected={board === item.id}
                aria-controls={"panel-" + item.id}
                onClick={() => setBoard(item.id)}
                className={
                  "min-h-11 md:min-h-9 shrink-0 border-b-2 px-4 text-sm font-medium " +
                  (board === item.id ? "border-brand text-ink" : "border-transparent text-ink-muted")
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {board === "overview" ? (
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="flex flex-col gap-5">
        <section className="grid gap-5 lg:grid-cols-5">
          <article className="flex flex-col justify-between rounded-card bg-surface p-5 text-ink shadow-card md:p-6 lg:col-span-2">
            <div>
              <p className="text-sm font-medium text-ink-muted">Maturity score</p>
              <p className="mt-2 text-6xl font-light leading-none tracking-tight text-ink md:text-7xl" aria-live="polite">
                {score}
              </p>
              <p className="mt-3 text-sm text-ink-muted">out of 100 · deployed essentials only</p>
            </div>
            <div className="mt-8">
              <div className="h-2 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
              </div>
              <p className="mt-3 text-sm text-ink">
                {essentialCovered} of {essential.length} essentials operating
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Partial and untested tools do not move the score. A license is not the same as a control that works.
              </p>
            </div>
          </article>

          <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6 lg:col-span-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Coverage</h2>
              <p className="text-sm text-ink-muted">Share of categories covered</p>
            </div>
            <div className="mt-4 h-52" role="img" aria-label="Bar chart of coverage by domain">
              {chartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="28%">
                    <XAxis
                      dataKey="domain"
                      tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      cursor={{ fill: "var(--color-subtle)" }}
                      contentStyle={{
                        background: "var(--color-subtle)",
                        border: "none",
                        borderRadius: 16,
                        color: "var(--color-ink)",
                      }}
                      formatter={(value) => [`${value}%`, "Coverage"]}
                    />
                    <Bar dataKey="coverage" fill="var(--color-brand)" radius={[12, 12, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </article>
        </section>

        {addonRows.length > 0 ? (
          <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold">Add-ons for the products you run</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Paid add-ons, AI features, and higher plans from vendors you already use, and whether each would raise your maturity score or only strengthen a category you already cover.
            </p>
            <AddonList rows={addonRows} showProduct />
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3" aria-label="Domain coverage">
          {domains.map((row) => {
            const Icon = DOMAIN_ICON[row.domain];
            return (
              <article key={row.domain} className="rounded-card bg-surface p-5 text-ink shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold">{row.domain}</h2>
                  <Icon className="size-5 text-ink-muted" aria-hidden="true" />
                </div>
                <p className="mt-4 text-4xl font-light tracking-tight text-ink">{row.percent}%</p>
                <p className="mt-2 text-sm text-ink-muted">
                  {row.covered} of {row.total} categories
                </p>
              </article>
            );
          })}
        </section>
          </div>
        ) : null}

        {board === "stack" ? (
          <div role="tabpanel" id="panel-stack" aria-labelledby="tab-stack" className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-card bg-brand-soft p-5 text-ink md:flex-row md:items-center md:justify-between md:p-6">
          <ol className="grid gap-2 text-sm md:grid-cols-3 md:gap-6">
            <li>
              <span className="font-semibold">1. Describe your company.</span> Size, budget, frameworks, and the licences you already pay for.
            </li>
            <li>
              <span className="font-semibold">2. Pick what you run.</span> Mark each category Deployed, Partial, or Untested.
            </li>
            <li>
              <span className="font-semibold">3. Compare.</span> See which products would close each gap, and their strengths and weaknesses.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => {
              const hasData = picked.length > 0 || checked.length > 0 || owned.trim().length > 0;
              if (hasData && !window.confirm("Replace your current assessment with the example company? Save it to a file first if you want to keep it.")) return;
              loadWorkspaceData(EXAMPLE_WORKSPACE);
            }}
            className="min-h-11 shrink-0 rounded-lg border border-brand bg-surface px-4 text-sm font-medium text-brand hover:bg-subtle md:min-h-9"
          >
            Try an example company
          </button>
        </section>

        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold">Your company</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Comparisons stay inside this size and budget, and show what your frameworks ask for in each category.
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <ChoiceRow label="Company size" value={size} options={COMPANY_SIZES} onChange={setSize} />
              <div>
                <p className="mb-2 text-sm font-medium">Budget</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGETS.map((option) => {
                    const active = option === budget;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBudget(option)}
                        className={
                          "min-h-11 md:min-h-9 rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors duration-200 " +
                          (active ? "bg-brand text-on-brand" : "bg-subtle text-ink")
                        }
                      >
                        <span className="block">{option}</span>
                        <span className={"block text-xs font-medium " + (active ? "text-on-brand" : "text-ink-muted")}>
                          Max {BUDGET_TIER[option]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-ink-muted">Lean is Low only. Balanced adds Medium. Open includes High.</p>
              </div>

            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Frameworks you follow</p>
              <div className="flex flex-wrap gap-2">
                {FRAMEWORKS.map((framework) => {
                  const active = areas.find((area) => area.id === "company")?.frameworks.includes(framework.id) ?? false;
                  return (
                    <button
                      key={framework.id}
                      type="button"
                      aria-pressed={active}
                      title={framework.summary}
                      onClick={() => setFrameworkOn(framework.id, !active)}
                      className={
                        "min-h-11 md:min-h-9 rounded-lg px-3 text-sm font-medium " +
                        (active ? "bg-brand text-on-brand" : "bg-surface text-ink")
                      }
                    >
                      {framework.name}
                    </button>
                  );
                })}
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-brand">Apply a framework to one business area only</summary>
                <div className="mt-3">
              <div>
                <p className="mb-2 text-sm text-ink-muted">Use this when PCI DSS or HIPAA applies to one part of the company, not all of it.</p>
                <div className="flex flex-col gap-3">
                  {areas.map((area) => (
                    <div key={area.id} className="rounded-lg bg-subtle p-3">
                      <p className="text-sm font-medium text-ink">{area.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {FRAMEWORKS.map((framework) => {
                          const active = area.frameworks.includes(framework.id);
                          return (
                            <button
                              key={framework.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setAreas((current) =>
                                  current.map((item) => {
                                    if (item.id !== area.id) return item;
                                    const frameworks = item.frameworks.includes(framework.id)
                                      ? item.frameworks.filter((id) => id !== framework.id)
                                      : [...item.frameworks, framework.id];
                                    return { ...item, frameworks };
                                  }),
                                )
                              }
                              className={
                                "min-h-11 md:min-h-9 rounded-lg px-3 text-sm font-medium " +
                                (active ? "bg-brand text-on-brand" : "bg-surface text-ink")
                              }
                            >
                              {framework.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AREA_PRESETS.filter((preset) => !areas.some((area) => area.id === preset.id)).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAreas((current) => [...current, preset])}
                      className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm font-medium text-ink"
                    >
                      Add {preset.name}
                    </button>
                  ))}
                </div>
              </div>

                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold">Suites you already license</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Many companies pay for security tools inside a bigger licence and never turn them on. Pick yours, and Compare will flag what you already own before suggesting anything new.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {SUITES.map((suite) => {
              const on = suites.includes(suite.id);
              return (
                <div key={suite.id} className={"rounded-lg border p-3 " + (on ? "border-brand bg-brand-soft" : "border-line")}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 md:min-h-8">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSuites((current) =>
                          current.includes(suite.id) ? current.filter((id) => id !== suite.id) : [...current, suite.id],
                        )
                      }
                    />
                    <span className="text-sm font-medium text-ink">{suite.name}</span>
                  </label>
                  <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-muted">
                    {suite.includes.map((item) => (
                      <li key={item.product}>{item.as}</li>
                    ))}
                  </ul>
                  {suite.notes ? <p className="mt-2 text-xs text-ink-muted">{suite.notes}</p> : null}
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
                    {suite.sources.map((source) => (
                      <a key={source.url} href={safeHref(source.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {source.title}
                      </a>
                    ))}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Only suites whose products are in the catalog are listed. Others can be added in catalog/suites.json.
          </p>
        </section>

        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">What you already run</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Pick the products in your environment. Then set whether each category is Deployed (running and watched), Partial, or Untested. Only Deployed counts toward the score.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="min-h-11 w-56 rounded-lg bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted md:min-h-9"
              />
              <button
                type="button"
                onClick={() => {
                  setPicked([]);
                  setChecked([]);
                  setOwned("");
                }}
                className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-subtle md:min-h-9"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-6">
            {DOMAINS.map((domain) => {
              const needle = pickerQuery.trim().toLowerCase();
              const rows = CATEGORIES.filter((category) => category.domain === domain)
                .map((category) => ({
                  category,
                  products: TOOLS.filter(
                    (tool) =>
                      tool.categoryId === category.id &&
                      (!needle ||
                        [tool.name, tool.vendor, ...(tool.aliases ?? [])].some((name) => name.toLowerCase().includes(needle))),
                  ),
                }))
                .filter((row) => !needle || row.products.length > 0);
              if (rows.length === 0) return null;
              return (
                <div key={domain}>
                  <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">{domain}</p>
                  <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
                    {rows.map(({ category, products }) => {
                      const state = categoryState(category.id);
                      const inUse = pickedCategories.has(category.id) || checked.includes(category.id);
                      return (
                        <div key={category.id} className="flex flex-col gap-3 p-3 lg:flex-row lg:items-start">
                          <div className="lg:w-56 lg:shrink-0">
                            <p className="text-sm font-medium text-ink">{category.name}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {category.essential ? "Essential" : "Advanced"} · <StateText state={state} />
                            </p>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {products.map((tool) => {
                                const on = picked.includes(tool.id);
                                return (
                                  <button
                                    key={tool.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => togglePick(tool)}
                                    className={
                                      "min-h-11 rounded-md px-2.5 text-sm md:min-h-8 " +
                                      (on ? "bg-brand font-medium text-on-brand" : "bg-surface text-ink")
                                    }
                                  >
                                    {tool.name}
                                    {licensed.has(tool.id) && !on ? <span className="ml-1 text-xs text-brand">· licensed</span> : null}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                aria-pressed={checked.includes(category.id)}
                                onClick={() => toggleCategory(category.id)}
                                className={
                                  "min-h-11 rounded-md px-2.5 text-sm md:min-h-8 " +
                                  (checked.includes(category.id) ? "bg-brand font-medium text-on-brand" : "bg-surface text-ink")
                                }
                              >
                                Something else
                              </button>
                            </div>
                            {products
                              .filter((tool) => picked.includes(tool.id) && (tool.extensions?.length ?? 0) > 0)
                              .map((tool) => (
                                <div key={tool.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="text-ink-muted">Add-ons you have on {tool.name}:</span>
                                  {(tool.extensions ?? []).map((extension) => {
                                    const on = addons.includes(addonKey(tool.id, extension.name));
                                    return (
                                      <button
                                        key={extension.name}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleAddon(tool, extension)}
                                        title={extension.detail}
                                        className={
                                          "min-h-11 rounded-md px-2 text-xs md:min-h-7 " +
                                          (on ? "bg-brand font-medium text-on-brand" : "bg-surface text-ink")
                                        }
                                      >
                                        {extension.name}
                                        {extension.ai ? " · AI" : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            {addonCovers.has(category.id) && !pickedCategories.has(category.id) ? (
                              <p className="text-xs text-ink-muted">Covered by {addonCovers.get(category.id)}.</p>
                            ) : null}
                            {inUse || addonCovers.has(category.id) ? (
                              <StatusPicker
                                value={categoryStatus[category.id] ?? "Untested"}
                                onChange={(status) => setCategoryStatus((current) => ({ ...current, [category.id]: status }))}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft p-3 text-sm text-ink">
            <p>
              {picked.length} {picked.length === 1 ? "product" : "products"} picked · {operating.size} of {CATEGORIES.length} categories covered ·{" "}
              {essential.length - essentialCovered} essential {essential.length - essentialCovered === 1 ? "gap" : "gaps"}
            </p>
            <button
              type="button"
              onClick={() => setBoard("compete")}
              className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand md:min-h-9"
            >
              Compare products for your gaps
            </button>
          </div>
        </section>

        <details className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <summary className="cursor-pointer font-display text-lg font-semibold">Import an inventory or add a product not in the list</summary>
          <section className="mt-2">
          <h2 className="sr-only">Environment</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Import an Excel or CSV inventory, or add a tool by hand. A lookup confirms the vendor and purpose. Nothing counts until you confirm it.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="min-h-11 md:min-h-9 cursor-pointer rounded-lg bg-brand px-4 py-3 text-sm font-medium text-on-brand">
              Import Excel or CSV
              <input
                type="file"
                accept=".xlsx,.csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void parseInventoryFile(file)
                    .then((rows) => {
                      setImportNote(rows.length + " rows from " + file.name);
                      setProposals(
                        rows.map((row) => ({
                          line: row.name,
                          match: lookupTool(TOOLS, row.name),
                          vendor: row.vendor,
                          purpose: row.purpose,
                          evidence: row.evidence || file.name,
                        })),
                      );
                      recordScan(rows.map((row) => row.name));
                    })
                    .catch(() => {
                      setImportNote("Could not read that file. Use an .xlsx or .csv file with the template columns: Tool, Vendor, Purpose, Source.");
                    });
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadInventoryTemplate()}
              className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm font-medium text-ink"
            >
              Download template
            </button>
            {importNote ? <p className="text-sm text-ink-muted">{importNote}</p> : null}
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Add a tool</p>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Tool name"
                className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={lookupDraft} className="min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand">
                  Look up vendor
                </button>
                <button type="button" onClick={addDraft} className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm font-medium text-ink">
                  Add to stack
                </button>
              </div>
              <input
                value={draftVendor}
                onChange={(event) => setDraftVendor(event.target.value)}
                placeholder="Vendor"
                className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <textarea
                value={draftPurpose}
                onChange={(event) => setDraftPurpose(event.target.value)}
                placeholder="Purpose in this environment"
                rows={3}
                className="rounded-lg bg-subtle px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {draftNote ? <p className="text-sm text-ink-muted">{draftNote}</p> : null}
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Data lake inventory</p>
              <textarea
                value={inventory}
                onChange={(event) => setInventory(event.target.value)}
                placeholder="One source or product name per line"
                rows={5}
                className="rounded-lg bg-subtle px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInventory(SAMPLE_INVENTORY)}
                  className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm font-medium text-ink"
                >
                  Load sample
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rows = scanInventory(TOOLS, inventory);
                    setProposals(rows);
                    recordScan(rows.map((row) => row.line));
                  }}
                  className="min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand"
                >
                  Scan names
                </button>
              </div>
              {scanDiff ? (
                <div className="rounded-lg bg-subtle p-4 text-sm">
                  <p className="font-medium text-ink">{scanDiff.baseline ? "Baseline saved" : "Since the last pull"}</p>
                  {scanDiff.baseline ? (
                    <p className="mt-2 text-ink-muted">Scan again to see what appeared, disappeared, or is still unproven.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
                      <li>Appeared: {scanDiff.appeared.join(", ") || "none"}</li>
                      <li>Disappeared: {scanDiff.disappeared.join(", ") || "none"}</li>
                      <li>Still unproven: {scanDiff.unproven.join(", ") || "none"}</li>
                    </ul>
                  )}
                </div>
              ) : null}
              {proposals.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {proposals.map((row) => (
                    <li key={row.line} className="rounded-lg bg-subtle p-3">
                      <p className="text-sm font-medium text-ink">{row.line}</p>
                      {row.match ? (
                        <>
                          <p className="mt-1 text-xs text-ink-muted">
                            {row.match.confidence} · {vendorOf(row.match.tool)} · {row.match.tool.name}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              confirmTool(
                                row.match?.tool.name ?? row.line,
                                row.vendor || (row.match ? vendorOf(row.match.tool) : ""),
                                row.purpose || row.match?.tool.description || "",
                                row.evidence || row.line,
                              )
                            }
                            className="mt-2 min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand"
                          >
                            Confirm
                          </button>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-ink-muted">No catalog match. Add it manually.</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {stack.length > 0 ? (
            <ul className="mt-6 flex flex-col gap-3">
              {stack.map((item) => (
                <li key={item.key} className="rounded-lg bg-subtle p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">
                        {item.vendor || "Vendor not set"} · {item.evidence}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStack((current) => current.filter((row) => row.key !== item.key))}
                      className="min-h-11 md:min-h-9 rounded-lg px-3 text-sm text-ink-muted"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3">
                    <StatusPicker
                      value={item.status}
                      onChange={(status) =>
                        setStack((current) => current.map((row) => (row.key === item.key ? { ...row, status } : row)))
                      }
                    />
                  </div>
                  <textarea
                    value={item.purpose}
                    onChange={(event) =>
                      setStack((current) =>
                        current.map((row) => (row.key === item.key ? { ...row, purpose: event.target.value } : row)),
                      )
                    }
                    rows={2}
                    className="mt-3 w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink outline-none"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        </details>
          </div>
        ) : null}

        {board === "overview" ? (
        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold">Overlap</h2>
          <p className="mt-1 text-sm text-ink-muted">Two products in one category do not raise the score.</p>
          {overlaps.length === 0 ? (
            <p className="mt-4 text-sm text-ink">No category has two products.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {overlaps.map((row) => (
                <li key={row.category.id} className="rounded-lg bg-subtle p-4 text-sm">
                  <span className="font-medium text-ink">{row.category.name}</span>
                  <span className="text-ink-muted"> · {row.names.join(", ")}. Keep one operating tool.</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}

        {board === "risk" ? (
          <div role="tabpanel" id="panel-risk" aria-labelledby="tab-risk" className="flex flex-col gap-5">
        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold">Risk matrix</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Impact is the severity on the plan. Likelihood starts high when nothing is in place, and medium when a tool is present but not operating. Accepted risks sit at low likelihood and do not change the score.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            <div />
            {matrixLikelihoods.map((likelihood) => (
              <p key={likelihood} className="text-center text-xs font-medium text-ink-muted">
                {likelihood}
              </p>
            ))}
            {matrixImpacts.map((impact) => (
              <div key={impact} className="contents">
                <p className="self-center text-xs font-medium text-ink-muted">{impact}</p>
                {matrixLikelihoods.map((likelihood) => {
                  const cell = matrixCell(impact, likelihood);
                  return (
                    <div key={impact + likelihood} className={"min-h-24 rounded-lg p-3 " + matrixHeat(impact, likelihood)}>
                      {cell.length === 0 ? (
                        <p className="text-xs opacity-70">None</p>
                      ) : (
                        cell.map((category) => (
                          <p key={category.id} className="text-sm font-medium leading-snug">
                            {category.name}
                          </p>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">Likelihood across. Impact down from high to low.</p>
        </section>

        <section className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold">Risk register</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Every essential that is not operating, highest score first. Score is impact times likelihood.
          </p>
          {register.length === 0 ? (
            <p className="mt-6 rounded-lg bg-subtle p-4 text-sm text-ink">Every essential category is operating.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium text-ink-muted">
                    <th className="py-2 pr-3 font-medium">Risk</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 pr-3 font-medium">Impact</th>
                    <th className="py-2 pr-3 font-medium">Likelihood</th>
                    <th className="py-2 pr-3 font-medium">Treatment</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {register.map((row) => (
                    <tr key={row.category.id} className="border-t border-subtle">
                      <td className="py-3 pr-3">
                        <span className="block font-medium text-ink">{row.category.name}</span>
                        <span className="text-xs text-ink-muted">{row.category.domain}</span>
                      </td>
                      <td className="py-3 pr-3 text-ink">{row.score}</td>
                      <td className="py-3 pr-3 text-ink">{row.impact}</td>
                      <td className="py-3 pr-3 text-ink">{row.likelihood}</td>
                      <td className="py-3 pr-3 text-ink">{row.treatment}</td>
                      <td className="py-3 pr-3 text-ink">{row.owner}</td>
                      <td className="py-3 pr-3 text-ink">{row.due}</td>
                      <td className="py-3 text-ink">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </div>
        ) : null}

        {board === "plan" ? (
        <section role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold">90-day plan</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Each open essential says what to do and why. Buy only when nothing you already run can close it.
            </p>
            {openGaps.length === 0 ? (
              <p className="mt-6 rounded-lg bg-subtle p-4 text-sm text-ink">
                {acceptedGaps.length > 0
                  ? "Every remaining essential is an accepted risk, not an open gap."
                  : "Every essential category is operating."}
              </p>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {openGaps.map((category) => {
                  const advice = adviceForGap(category, TOOLS, size, budget, ownedTools, present.has(category.id));
                  const plan = planFor(category.id);
                  const expired = acceptanceFor(category.id);
                  return (
                    <li key={category.id} className="rounded-lg bg-subtle p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold">{category.name}</h3>
                        <span className="shrink-0 text-xs font-medium text-brand">{advice.action}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">{advice.headline}</p>
                      <p className="mt-2 text-sm text-ink-muted">{advice.why}</p>
                      {expired?.expired ? (
                        <p className="mt-2 text-sm text-ink">Acceptance expired {expired.expires}. It is an open gap again.</p>
                      ) : null}
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <PlanSelect
                          label="Impact"
                          value={plan.severity}
                          options={SEVERITIES}
                          onChange={(severity) => setSeverities((current) => ({ ...current, [category.id]: severity }))}
                        />
                        <PlanSelect
                          label="Likelihood"
                          value={likelihoodFor(category.id)}
                          options={SEVERITIES}
                          onChange={(level) => setLikelihoods((current) => ({ ...current, [category.id]: level }))}
                        />
                        <PlanSelect
                          label="Window"
                          value={plan.window}
                          options={PLAN_WINDOWS}
                          onChange={(window) => setWindows((current) => ({ ...current, [category.id]: window }))}
                        />
                        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-muted sm:col-span-3">
                          Owner
                          <input
                            value={plan.owner}
                            onChange={(event) => setOwners((current) => ({ ...current, [category.id]: event.target.value }))}
                            placeholder="Name or team"
                            className="min-h-11 w-full rounded-lg bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted md:min-h-9"
                          />
                        </label>
                      </div>
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-brand">Accept this risk instead</summary>
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-1 text-xs text-ink-muted">
                            Accept until
                            <input
                              type="date"
                              value={expiryDraft[category.id] ?? ""}
                              onChange={(event) =>
                                setExpiryDraft((current) => ({ ...current, [category.id]: event.target.value }))
                              }
                              className="min-h-11 rounded-lg bg-surface px-3 text-sm text-ink outline-none md:min-h-9"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const expires = expiryDraft[category.id];
                              if (!expires) return;
                              setAccepted((current) => ({
                                ...current,
                                [category.id]: { owner: plan.owner || "Unassigned", expires },
                              }));
                            }}
                            className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand md:min-h-9"
                          >
                            Accept risk
                          </button>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
            {acceptedGaps.length > 0 ? (
              <div className="mt-6">
                <h3 className="font-display text-lg font-semibold">Accepted risk</h3>
                <p className="mt-1 text-sm text-ink-muted">These stay off the open plan until the date. They do not raise the score.</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {acceptedGaps.map((category) => {
                    const row = acceptanceFor(category.id);
                    return (
                      <li key={category.id} className="rounded-lg bg-subtle p-4">
                        <p className="text-sm font-medium text-ink">{category.name}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {row?.owner} · until {row?.expires}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setAccepted((current) => {
                              const next = { ...current };
                              delete next[category.id];
                              return next;
                            })
                          }
                          className="mt-2 min-h-11 md:min-h-9 rounded-lg px-3 text-sm text-ink-muted"
                        >
                          Reopen
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </article>

          <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Recommended tools</h2>
              <p className="text-sm text-ink-muted">{recommendations.length}</p>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {size} · {budget} · up to {BUDGET_TIER[budget]}. Hidden when you already have something in that category.
            </p>
            {recommendations.length === 0 ? (
              <p className="mt-6 rounded-lg bg-subtle p-4 text-sm text-ink">
                Nothing new in this budget. Covered categories are hidden, and tighter tiers drop higher-priced tools.
              </p>
            ) : (
              <div className="mt-5 flex flex-col gap-5">
                {CATEGORIES.filter((category) => recommendations.some((tool) => tool.categoryId === category.id)).map((category) => {
                  const inCategory = recommendations.filter((tool) => tool.categoryId === category.id);
                  return (
                    <div key={category.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-semibold text-ink">{category.name}</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setCompeteId(category.id);
                            setBoard("compete");
                          }}
                          className="text-xs text-brand hover:underline"
                        >
                          Compare all {inCategory.length}
                        </button>
                      </div>
                      <ul className="mt-2 flex flex-col divide-y divide-line rounded-lg border border-line">
                        {inCategory.slice(0, 2).map((tool) => (
                          <li key={tool.id} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-ink">
                                {tool.name}
                                <span className="font-normal text-ink-muted"> · {tool.vendor}</span>
                              </p>
                              <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
                                {tool.priceTier}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-ink-muted">{tool.description}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
        ) : null}

        {board === "compete" ? (
        <section role="tabpanel" id="panel-compete" aria-labelledby="tab-compete" className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label="Categories" className="flex flex-col gap-3 lg:sticky lg:top-16 lg:self-start">
            <div className="inline-flex overflow-hidden rounded-lg border border-line bg-surface text-sm">
              {(["all", "gaps"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={competeFilter === option}
                  onClick={() => setCompeteFilter(option)}
                  className={
                    "min-h-11 flex-1 px-3 font-medium md:min-h-9 " +
                    (competeFilter === option ? "bg-brand text-on-brand" : "bg-surface text-ink")
                  }
                >
                  {option === "all" ? "All categories" : "Gaps only"}
                </button>
              ))}
            </div>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {CATEGORIES.filter((category) => competeFilter === "all" || categoryState(category.id) !== "Covered")
                .slice()
                .sort((x, y) =>
                  competeFilter === "gaps" ? gapPriority(y, builtInFrameworkIds) - gapPriority(x, builtInFrameworkIds) : 0,
                )
                .map((category) => {
                const active = competeId === category.id;
                const state = categoryState(category.id);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => setCompeteId(category.id)}
                      aria-current={active ? "true" : undefined}
                      className={
                        "flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm " +
                        (active ? "bg-brand-soft font-medium text-ink" : "text-ink hover:bg-subtle")
                      }
                    >
                      <span>
                        {category.name}
                        {category.essential ? <span className="text-ink-muted"> *</span> : null}
                      </span>
                      <StateBadge state={state} />
                    </button>
                  </li>
                );
                })}
            </ul>
            {competeFilter === "gaps" ? (
              <p className="text-xs text-ink-muted">Sorted by how strongly your selected frameworks call for each category.</p>
            ) : null}
            <p className="text-xs text-ink-muted">* Essential category. {reviewCounts(TOOLS).reviewed} of {reviewCounts(TOOLS).total} entries are fact-checked against sources; price tiers and strengths and weaknesses are editorial. No vendor pays to be listed.</p>
          </nav>

          {(() => {
            const category = categoryById(competeId);
            if (!category) return null;
            const held = ownedTools.filter((tool) => tool.categoryId === category.id);
            const state = categoryState(category.id);
            const fieldCall = competeCall(held, TOOLS, category.id, size, budget);
            const marked = checked.includes(category.id);
            const call =
              held.length === 0 && marked
                ? {
                    verdict: "Stay" as const,
                    why: `You marked this category as covered by a product that is not in the list. Pick it on the Setup tab, or compare the field below.`,
                    field: fieldCall.field,
                  }
                : fieldCall;
            const allRows = fieldFor(category.id);
            const rows = allRows.filter(
              ({ tool, fit }) => fit.kind === "Yours" || fit.kind === "Already licensed" || passesFilters(tool),
            );
            const hidden = allRows.length - rows.length;
            const builtIn = selectedFrameworks.filter((framework) =>
              (builtInFrameworkIds as string[]).includes(framework.id),
            );
            const starred = shortlist[category.id] ?? [];
            const starredRows = allRows.filter((row) => starred.includes(row.tool.id));
            const required = requiredBy(category, builtInFrameworkIds);
            const fills = rows.filter((row) => row.fit.kind === "Fills the gap").length;
            return (
              <div className="flex min-w-0 flex-col gap-5">
                <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-ink-muted">
                        {category.domain} · {category.essential ? "Essential" : "Advanced"}
                      </p>
                      <h2 className="font-display text-xl font-semibold">{category.name}</h2>
                      <p className="mt-1 text-sm text-ink-muted">{category.summary}</p>
                      {required.length > 0 ? (
                        <p className="mt-1 text-sm font-medium text-risk-high">
                          Required by {required.map((id) => FRAMEWORKS.find((item) => item.id === id)?.name ?? id).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <StateBadge state={state} large />
                  </div>

                  <dl className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">You run</dt>
                      <dd className="mt-1 text-sm text-ink">
                        {held.length > 0
                          ? held.map((tool) => tool.name).join(", ") + " · " + (categoryStatus[category.id] ?? "Untested")
                          : addonCovers.has(category.id)
                            ? addonCovers.get(category.id) + " · " + (categoryStatus[category.id] ?? "Untested")
                            : marked
                            ? "A product not in the list · " + (categoryStatus[category.id] ?? "Untested")
                            : allRows.some((row) => row.fit.kind === "Already licensed")
                              ? "Nothing deployed, but you license " +
                                allRows
                                  .filter((row) => row.fit.kind === "Already licensed")
                                  .map((row) => licensed.get(row.tool.id)?.as ?? row.tool.name)
                                  .join(", ")
                              : "Nothing yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">Your frameworks ask for</dt>
                      <dd className="mt-1 text-sm text-ink">
                        {builtIn.length === 0 ? (
                          <span className="text-ink-muted">Pick your frameworks on the Setup tab.</span>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {builtIn.map((framework) => {
                              const row = category.requirements[framework.id as FrameworkId];
                              return (
                                <li key={framework.id} className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="font-medium">{framework.name}</span>
                                  <LevelBadge level={row.level} label={requirementLabel(row.level, framework.id as FrameworkId)} />
                                  <span className="text-ink-muted">{row.ref}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-lg bg-subtle p-4">
                    {held.length === 0 && !marked && allRows.some((row) => row.fit.kind === "Already licensed") ? (
                      <>
                        <p className="text-sm font-semibold text-ink">Verdict: Use what you license</p>
                        <p className="mt-1 text-sm text-ink">
                          {allRows.find((row) => row.fit.kind === "Already licensed")?.fit.detail} Mark it on the Setup tab once it is deployed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-ink">Verdict: {call.verdict}</p>
                        <p className="mt-1 text-sm text-ink">{call.why}</p>
                      </>
                    )}
                  </div>
                </article>

                {addonRows.some((row) => row.categoryId === category.id) ? (
                  <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
                    <h3 className="font-display text-lg font-semibold">Add-ons for what you already run</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      Before buying a new product, check what the vendors you already pay offer here, and what it costs.
                    </p>
                    <AddonList rows={addonRows.filter((row) => row.categoryId === category.id)} />
                  </article>
                ) : null}

                {starredRows.length > 0 ? (
                  <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-semibold">Your shortlist</h3>
                        <p className="text-sm text-ink-muted">Up to three products, side by side.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadShortlist(category.id)}
                        className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand md:min-h-9"
                      >
                        Download shortlist PDF
                      </button>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[36rem] table-fixed text-left text-sm">
                        <thead>
                          <tr className="border-b border-line">
                            <th className="w-32 py-2 pr-3 text-xs font-medium text-ink-muted"></th>
                            {starredRows.map(({ tool }) => (
                              <th key={tool.id} className="py-2 pr-3 align-bottom">
                                <span className="font-semibold text-ink">{tool.name}</span>
                                <span className="block text-xs font-normal text-ink-muted">{tool.vendor}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="align-top">
                          {(
                            [
                              ["Effect", (row: (typeof starredRows)[number]) => <FitBadge kind={row.fit.kind} />],
                              ["Why", (row: (typeof starredRows)[number]) => row.fit.detail],
                              ["Price", (row: (typeof starredRows)[number]) => row.tool.priceTier],
                              ["Built for", (row: (typeof starredRows)[number]) => row.tool.bestFor.join(", ")],
                              ["Deployment", (row: (typeof starredRows)[number]) => row.tool.deployment.join(", ")],
                              ["FedRAMP", (row: (typeof starredRows)[number]) => <FedrampText tool={row.tool} />],
                              ["EU residency", (row: (typeof starredRows)[number]) => <EuText tool={row.tool} />],
                              ["Strengths", (row: (typeof starredRows)[number]) => row.tool.compete?.wins ?? "–"],
                              ["Weaknesses", (row: (typeof starredRows)[number]) => row.tool.compete?.loses ?? "–"],
                            ] as const
                          ).map(([label, cell]) => (
                            <tr key={label} className="border-b border-line last:border-0">
                              <th className="py-2 pr-3 text-xs font-medium text-ink-muted">{label}</th>
                              {starredRows.map((row) => (
                                <td key={row.tool.id} className="py-2 pr-3 text-ink">
                                  {cell(row)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ) : null}

                <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold">How each product would change this</h3>
                    <p className="text-sm text-ink-muted">
                      {size} · {budget} budget · {fills} {fills === 1 ? "clean fit" : "clean fits"}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-subtle p-3 text-sm">
                    <span className="font-medium text-ink">Filter</span>
                    <label className="flex items-center gap-2 text-ink">
                      Deployment
                      <select
                        value={filters.deployment}
                        onChange={(event) =>
                          setFilters((current) => ({ ...current, deployment: event.target.value as typeof current.deployment }))
                        }
                        className="min-h-11 rounded-md bg-surface px-2 text-sm text-ink md:min-h-8"
                      >
                        <option value="any">Any</option>
                        <option value="SaaS">SaaS</option>
                        <option value="Self-hosted">Self-hosted</option>
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-ink md:min-h-8">
                      <input
                        type="checkbox"
                        checked={filters.fedramp}
                        onChange={(event) => setFilters((current) => ({ ...current, fedramp: event.target.checked }))}
                      />
                      FedRAMP authorized
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-ink md:min-h-8">
                      <input
                        type="checkbox"
                        checked={filters.eu}
                        onChange={(event) => setFilters((current) => ({ ...current, eu: event.target.checked }))}
                      />
                      EU data residency
                    </label>
                    <span className="text-xs text-ink-muted">
                      Self-hosted products pass the FedRAMP and EU filters, since you control where they run.
                      {hidden > 0 ? ` ${hidden} hidden by filters.` : ""}
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                      <thead className="text-xs text-ink-muted">
                        <tr className="border-b border-line">
                          <th className="w-8 py-2 pr-2 font-medium">
                            <span className="sr-only">Shortlist</span>
                          </th>
                          <th className="py-2 pr-3 font-medium">Product</th>
                          <th className="py-2 pr-3 font-medium">Effect on the gap</th>
                          <th className="py-2 pr-3 font-medium">Price</th>
                          <th className="py-2 pr-3 font-medium">Built for</th>
                          <th className="py-2 pr-3 font-medium">Deployment</th>
                          <th className="py-2 pr-3 font-medium">FedRAMP</th>
                          <th className="py-2 font-medium">EU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ tool, fit }) => (
                          <tr key={tool.id} className="border-b border-line last:border-0">
                            <td className="py-2 pr-2">
                              <StarButton
                                on={starred.includes(tool.id)}
                                disabled={!starred.includes(tool.id) && starred.length >= 3}
                                name={tool.name}
                                onClick={() => toggleShortlist(category.id, tool.id)}
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <a href={"#product-" + tool.id} className="font-medium text-ink hover:text-brand">
                                {tool.name}
                              </a>
                              <span className="block text-xs text-ink-muted">{tool.vendor}</span>
                            </td>
                            <td className="py-2 pr-3">
                              <FitBadge kind={fit.kind} />
                            </td>
                            <td className="py-2 pr-3 text-ink">{tool.priceTier}</td>
                            <td className="py-2 pr-3 text-ink">{tool.bestFor.join(", ")}</td>
                            <td className="py-2 pr-3 text-ink">
                              {tool.deployment.join(", ")}
                              {tool.openSource ? <span className="block text-xs text-ink-muted">Open source</span> : null}
                            </td>
                            <td className="py-2 pr-3 text-ink">
                              <FedrampText tool={tool} />
                            </td>
                            <td className="py-2 text-ink">
                              <EuText tool={tool} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <div className="grid gap-4 xl:grid-cols-2">
                  {rows.map(({ tool, fit }) => {
                    const note = COMPETE[tool.id];
                    return (
                      <article
                        key={tool.id}
                        id={"product-" + tool.id}
                        className="flex scroll-mt-20 flex-col rounded-card bg-surface p-5 text-ink shadow-card"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-semibold">{tool.name}</h3>
                            <p className="text-xs text-ink-muted">
                              {tool.vendor} · {tool.priceTier} price · {tool.bestFor.join(", ")}
                              {tool.openSource ? " · open source" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <FitBadge kind={fit.kind} />
                            <StarButton
                              on={starred.includes(tool.id)}
                              disabled={!starred.includes(tool.id) && starred.length >= 3}
                              name={tool.name}
                              onClick={() => toggleShortlist(category.id, tool.id)}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-ink">{tool.description}</p>
                        <p className="mt-2 text-xs text-ink-muted">
                          {tool.deployment.join(" or ")}
                          {tool.fedramp ? (
                            <>
                              {" · FedRAMP " + tool.fedramp.level + " ("}
                              <a href={safeHref(tool.fedramp.source.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                                source
                              </a>
                              {")"}
                            </>
                          ) : null}
                          {tool.euResidency ? (
                            <>
                              {" · EU data residency ("}
                              <a href={safeHref(tool.euResidency.source.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                                source
                              </a>
                              {")"}
                            </>
                          ) : null}
                        </p>
                        <p className="mt-3 rounded-lg bg-subtle p-3 text-sm text-ink">{fit.detail}</p>
                        {note ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold tracking-wide text-brand uppercase">Strengths</p>
                              <p className="mt-1 text-sm text-ink">{note.wins}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold tracking-wide text-risk-high uppercase">Weaknesses</p>
                              <p className="mt-1 text-sm text-ink">{note.loses}</p>
                            </div>
                          </div>
                        ) : null}
                        {tool.extensions && tool.extensions.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Add-ons</p>
                            <ul className="mt-1 flex flex-col gap-2">
                              {tool.extensions.map((extension) => (
                                <li key={extension.name} className="text-sm text-ink-muted">
                                  <AddonLine extension={extension} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="mt-auto pt-4 text-xs text-ink-muted">
                          <p>
                            {reviewState(tool).label}{" "}
                            <a href={correctionUrl(tool)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                              Suggest a correction
                            </a>
                          </p>
                          {tool.sources.length > 0 ? (
                            <p className="mt-1 flex flex-wrap gap-x-3">
                              {tool.sources.map((source) => (
                                <a key={source.url} href={safeHref(source.url)} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                                  {source.title}
                                </a>
                              ))}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>
        ) : null}

        {board === "controls" ? (
        <section role="tabpanel" id="panel-controls" aria-labelledby="tab-controls" className="flex flex-col gap-5">
          <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold">Controls in use</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Turn on every control set this company has to meet. More than one can stay on.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void updateControls()}
                disabled={updating}
                className="min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand disabled:opacity-60"
              >
                {updating ? "Checking…" : "Update controls"}
              </button>
              {updateNote ? <p className="max-w-2xl text-sm text-ink-muted">{updateNote}</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {allFrameworks.map((framework) => {
                const active = frameworkIds.includes(framework.id);
                return (
                  <button
                    key={framework.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFrameworkOn(framework.id, !active)}
                    className={
                      "min-h-11 md:min-h-9 rounded-lg px-4 text-sm font-medium " +
                      (active ? "bg-brand text-on-brand" : "bg-subtle text-ink")
                    }
                  >
                    {framework.name}
                    {versions[framework.id] ? " · " + versions[framework.id] : ""}
                  </button>
                );
              })}
            </div>
            <form
              className="mt-4 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addFramework();
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">Add a control set</span>
                <input
                  value={draftFramework}
                  onChange={(event) => setDraftFramework(event.target.value)}
                  placeholder="Add a control set, such as CMMC or NIST 800-53"
                  className="min-h-11 md:min-h-9 w-full rounded-lg bg-subtle px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </label>
              <button type="submit" className="min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand">
                Add set
              </button>
            </form>
          </article>

          <div className="flex gap-1 overflow-x-auto border-b border-subtle">
            {(
              [
                ["mapped", "Mapped controls"],
                ["compliance", "Compliance"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={controlsPanel === id}
                onClick={() => setControlsPanel(id)}
                className={
                  "min-h-11 md:min-h-9 shrink-0 border-b-2 px-4 text-sm font-medium " +
                  (controlsPanel === id ? "border-brand text-ink" : "border-transparent text-ink-muted")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {controlsPanel === "compliance" ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {selectedFrameworks.length === 0 ? (
                <p className="rounded-card bg-surface p-6 text-sm text-ink shadow-card">Turn on at least one control set.</p>
              ) : (
                selectedFrameworks.map((framework) => {
                  const builtin = FRAMEWORKS.some((item) => item.id === framework.id);
                  const rows = builtin ? CATEGORIES : [];
                  const custom = addedControls.filter((control) => control.frameworkId === framework.id);
                  const hit =
                    rows.filter((category) => operating.has(category.id)).length +
                    custom.filter((control) => control.operating).length;
                  const total = rows.length + custom.length;
                  const percent = total === 0 ? 0 : Math.round((hit / total) * 100);
                  const gapsHere = rows.filter((category) => !operating.has(category.id));
                  return (
                    <article key={framework.id} className="rounded-card bg-surface p-6 text-ink shadow-card">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold">{framework.name}</h3>
                        <p className="text-sm text-ink-muted">{percent}%</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {hit} of {total} controls operating
                      </p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-subtle">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                      </div>
                      {gapsHere.length > 0 ? (
                        <ul className="mt-4 flex flex-col gap-2">
                          {gapsHere.map((category) => (
                            <li key={category.id} className="text-sm text-ink">
                              {controlLine(category, framework.id as FrameworkId)}
                              <span className="text-ink-muted"> · {category.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : builtin ? (
                        <p className="mt-4 text-sm text-ink">Every mapped category is operating.</p>
                      ) : null}
                      {custom.length > 0 ? (
                        <ul className="mt-4 flex flex-col gap-2">
                          {custom.map((control) => (
                            <li key={control.id} className="text-sm text-ink">
                              {control.name}
                              <span className="text-ink-muted"> · {control.operating ? "Operating" : "Open"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          ) : (
            <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Mapped controls</h2>
                  <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                    References for the sets you turned on. Add a control when the catalog does not list it.
                  </p>
                </div>
                <label className="relative block w-full md:max-w-xs">
                  <span className="sr-only">Look up a control or category</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input
                    value={lookup}
                    onChange={(event) => setLookup(event.target.value)}
                    placeholder="Look up a control"
                    className="min-h-11 md:min-h-9 w-full rounded-lg bg-subtle pr-4 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted"
                  />
                </label>
              </div>
              <form
                className="mt-5 grid gap-2 md:grid-cols-[180px_1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  addControl();
                }}
              >
                <select
                  value={draftControlFramework}
                  onChange={(event) => setDraftControlFramework(event.target.value)}
                  className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-3 text-sm text-ink outline-none"
                >
                  {allFrameworks.map((framework) => (
                    <option key={framework.id} value={framework.id}>
                      {framework.name}
                    </option>
                  ))}
                </select>
                <input
                  value={draftControlName}
                  onChange={(event) => setDraftControlName(event.target.value)}
                  placeholder="Control name"
                  className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <input
                  value={draftControlText}
                  onChange={(event) => setDraftControlText(event.target.value)}
                  placeholder="What it requires"
                  className="min-h-11 md:min-h-9 rounded-lg bg-subtle px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <button type="submit" className="min-h-11 md:min-h-9 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand">
                  Add control
                </button>
              </form>
              {selectedFrameworks.length === 0 ? (
                <p className="mt-6 rounded-lg bg-subtle p-4 text-sm text-ink">Turn on a control set to see its mapping.</p>
              ) : (
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {selectedFrameworks.map((framework) => {
                    const builtin = FRAMEWORKS.some((item) => item.id === framework.id);
                    const rows = builtin
                      ? CATEGORIES.filter((category) => {
                          if (!lookupNeedle) return true;
                          return [category.name, category.summary, category.domain, category.nist, controlLine(category, framework.id as FrameworkId)]
                            .join(" ")
                            .toLowerCase()
                            .includes(lookupNeedle);
                        })
                      : [];
                    const custom = addedControls.filter((control) => {
                      if (control.frameworkId !== framework.id) return false;
                      if (!lookupNeedle) return true;
                      return (control.name + " " + control.text).toLowerCase().includes(lookupNeedle);
                    });
                    return (
                      <article key={framework.id} className="rounded-lg bg-subtle p-4">
                        <h3 className="font-display text-lg font-semibold">{framework.name}</h3>
                        <p className="mt-1 text-sm text-ink-muted">{framework.summary}</p>
                        {rows.length === 0 && custom.length === 0 ? (
                          <p className="mt-4 text-sm text-ink">No controls match that lookup.</p>
                        ) : (
                          <ul className="mt-4 flex flex-col gap-3">
                            {rows.map((category) => {
                              const operatingNow = operating.has(category.id);
                              const named = present.has(category.id);
                              return (
                                <li key={category.id} className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-ink">{controlLine(category, framework.id as FrameworkId)}</p>
                                    <p className="text-xs text-ink-muted">
                                      {category.name} · {category.domain}
                                    </p>
                                  </div>
                                  <span
                                    className={
                                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
                                      (operatingNow ? "bg-brand text-on-brand" : "bg-surface text-ink-muted")
                                    }
                                  >
                                    {operatingNow ? "Operating" : named ? "Not proven" : "Gap"}
                                  </span>
                                </li>
                              );
                            })}
                            {custom.map((control) => (
                              <li key={control.id} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink">{control.name}</p>
                                  <p className="text-xs text-ink-muted">{control.text}</p>
                                </div>
                                <button
                                  type="button"
                                  aria-pressed={control.operating}
                                  onClick={() =>
                                    setAddedControls((current) =>
                                      current.map((item) =>
                                        item.id === control.id ? { ...item, operating: !item.operating } : item,
                                      ),
                                    )
                                  }
                                  className={
                                    "min-h-11 md:min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium " +
                                    (control.operating ? "bg-brand text-on-brand" : "bg-surface text-ink-muted")
                                  }
                                >
                                  {control.operating ? "Operating" : "Open"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          )}
        </section>
        ) : null}
      </div>
    </main>
  );
}

/** Opens a pre-filled GitHub issue. Nothing is sent until the person submits it on GitHub. */
function correctionUrl(tool: Tool): string {
  const params = new URLSearchParams({ template: "correction.yml", title: "Correction: " + tool.name, product: tool.id });
  return "https://github.com/" + GITHUB_REPO + "/issues/new?" + params.toString();
}

/** Only https links leave the app; anything else is neutralised. */
function safeHref(url: string): string {
  return /^https:\/\//i.test(url) ? url : "#";
}

function StateText({ state }: { state: CategoryState }) {
  const tone = state === "Covered" ? "text-brand" : state === "Gap" ? "text-risk-high" : "text-risk-mid";
  return <span className={tone}>{state}</span>;
}

function StateBadge({ state, large = false }: { state: CategoryState; large?: boolean }) {
  const tone =
    state === "Covered"
      ? "bg-brand-soft text-brand"
      : state === "Gap"
        ? "bg-risk-high-soft text-risk-high"
        : "bg-risk-mid-soft text-risk-mid";
  return (
    <span className={"shrink-0 rounded-full font-medium " + tone + (large ? " px-3 py-1 text-sm" : " px-2 py-0.5 text-xs")}>
      {state}
    </span>
  );
}

function AddonLine({ extension }: { extension: ToolExtension }) {
  return (
    <span className="block">
      <span className="font-medium text-ink">{extension.name}</span>
      {extension.ai ? <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">AI</span> : null}
      <span
        className={
          "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium " +
          (extension.pricing ? "bg-subtle text-ink" : "bg-subtle text-ink-muted")
        }
      >
        {extension.pricing ? PRICING_LABEL[extension.pricing] : "Pricing not checked"}
      </span>
      <span className="block">{extension.detail}</span>
      {extension.pricingNote || extension.pricingSource ? (
        <span className="block text-xs">
          {extension.pricingNote}
          {extension.pricingSource ? (
            <>
              {" "}
              <a href={safeHref(extension.pricingSource.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                Source
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function AddonList({ rows, showProduct = false }: { rows: AddonOpportunity[]; showProduct?: boolean }) {
  const tone = (effect: AddonOpportunity["effect"]) =>
    effect === "Closes a gap" ? "bg-brand-soft text-brand" : effect === "Overlaps" ? "bg-subtle text-ink-muted" : "bg-risk-mid-soft text-risk-mid";
  return (
    <ul className="mt-4 flex flex-col divide-y divide-line rounded-lg border border-line">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-2 p-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 text-sm text-ink-muted">
            {showProduct ? <p className="text-xs font-medium text-ink-muted">{row.product.name}</p> : null}
            <AddonLine extension={row.addon} />
          </div>
          <div className="md:w-64 md:shrink-0">
            <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium " + tone(row.effect)}>
              {row.effect === "Strengthens" ? "Strengthens, no score change" : row.effect}
            </span>
            <p className="mt-1 text-xs text-ink-muted">{row.why}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LevelBadge({ level, label }: { level: "required" | "addressable" | "recommended" | "none"; label: string }) {
  const tone =
    level === "required"
      ? "bg-risk-high-soft text-risk-high"
      : level === "addressable"
        ? "bg-risk-mid-soft text-risk-mid"
        : level === "recommended"
          ? "bg-subtle text-ink"
          : "bg-subtle text-ink-muted";
  return <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + tone}>{label}</span>;
}

function StarButton({ on, disabled, name, onClick }: { on: boolean; disabled: boolean; name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={(on ? "Remove " : "Shortlist ") + name}
      title={disabled ? "Shortlist holds three products" : on ? "Remove from shortlist" : "Add to shortlist"}
      className={
        "flex h-11 w-11 items-center justify-center rounded-md text-lg leading-none md:h-8 md:w-8 " +
        (on ? "text-brand" : "text-ink-muted hover:text-brand") +
        " disabled:opacity-40"
      }
    >
      {on ? "★" : "☆"}
    </button>
  );
}

function FedrampText({ tool }: { tool: Tool }) {
  if (tool.fedramp) return <span>{tool.fedramp.level}</span>;
  if (tool.deployment.includes("Self-hosted") && !tool.deployment.includes("SaaS")) return <span className="text-ink-muted">n/a</span>;
  return <span className="text-ink-muted">Not checked</span>;
}

function EuText({ tool }: { tool: Tool }) {
  if (tool.euResidency) return <span>Yes</span>;
  if (tool.deployment.includes("Self-hosted")) return <span className="text-ink-muted">You host</span>;
  return <span className="text-ink-muted">Not checked</span>;
}

function FitBadge({ kind }: { kind: FitKind }) {
  const tone =
    kind === "Fills the gap" || kind === "Already licensed"
      ? "bg-brand-soft text-brand"
      : kind === "Fills it, with a catch"
        ? "bg-risk-mid-soft text-risk-mid"
        : kind === "Yours"
          ? "bg-brand text-on-brand"
          : "bg-subtle text-ink-muted";
  return <span className={"inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap " + tone}>{kind}</span>;
}

function PlanSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 rounded-lg bg-surface px-2 text-sm text-ink md:min-h-9"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={
                "min-h-11 md:min-h-9 rounded-lg px-4 text-sm font-medium transition-colors duration-200 " +
                (active ? "bg-brand text-on-brand" : "bg-subtle text-ink")
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
