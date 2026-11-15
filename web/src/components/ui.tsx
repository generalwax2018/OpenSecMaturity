// Small presentational pieces shared by the tabs.
import {
  OPERATING_STATUSES,
  PRICING_LABEL,
  type AddonOpportunity,
  type FitKind,
  type OperatingStatus,
  type Tool,
  type ToolExtension,
} from "@/data/catalog";
import { safeHref } from "@/lib/links";
import type { CategoryState } from "@/lib/assessment";

export function StatusPicker({
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


export function StateText({ state }: { state: CategoryState }) {
  const tone = state === "Covered" ? "text-brand" : state === "Gap" ? "text-risk-high" : "text-risk-mid";
  return <span className={tone}>{state}</span>;
}

export function StateBadge({ state, large = false }: { state: CategoryState; large?: boolean }) {
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

export function AddonLine({ extension }: { extension: ToolExtension }) {
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

export function AddonList({ rows, showProduct = false }: { rows: AddonOpportunity[]; showProduct?: boolean }) {
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

export function LevelBadge({ level, label }: { level: "required" | "addressable" | "recommended" | "none"; label: string }) {
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

export function StarButton({ on, disabled, name, onClick }: { on: boolean; disabled: boolean; name: string; onClick: () => void }) {
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

export function FedrampText({ tool }: { tool: Tool }) {
  if (tool.fedramp) return <span>{tool.fedramp.level}</span>;
  if (tool.deployment.includes("Self-hosted") && !tool.deployment.includes("SaaS")) return <span className="text-ink-muted">n/a</span>;
  return <span className="text-ink-muted">Not checked</span>;
}

export function EuText({ tool }: { tool: Tool }) {
  if (tool.euResidency) return <span>Yes</span>;
  if (tool.deployment.includes("Self-hosted")) return <span className="text-ink-muted">You host</span>;
  return <span className="text-ink-muted">Not checked</span>;
}

export function FitBadge({ kind }: { kind: FitKind }) {
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

export function PlanSelect<T extends string>({
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

export function ChoiceRow<T extends string>({
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
