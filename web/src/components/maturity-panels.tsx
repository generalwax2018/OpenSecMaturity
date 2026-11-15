// Maturity levels and vendor questions for one category.
import type { Category } from "@/data/catalog";
import { LEVEL_NAMES, MAX_LEVEL, nextPractice, type CategoryLevel } from "@/lib/assessment";

export function LevelMeter({ level, large = false }: { level: number; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={"Level " + level + " of " + MAX_LEVEL + ": " + LEVEL_NAMES[level]}>
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: MAX_LEVEL }, (_, index) => (
          <span
            key={index}
            className={(large ? "h-2.5 w-6 " : "h-2 w-4 ") + "rounded-full " + (index < level ? "bg-brand" : "bg-subtle")}
          />
        ))}
      </span>
      <span className={large ? "text-sm text-ink" : "text-xs text-ink-muted"}>
        Level {level} · {LEVEL_NAMES[level]}
      </span>
    </span>
  );
}

/** Yes/no practices for one category. They only count once the category is operating. */
export function PracticeChecklist({
  level,
  operating,
  onToggle,
  compact = false,
}: {
  level: CategoryLevel;
  operating: boolean;
  onToggle: (practiceId: string, on: boolean) => void;
  compact?: boolean;
}) {
  const practices = level.category.practices ?? [];
  if (practices.length === 0) return null;
  return (
    <fieldset className={compact ? "" : "mt-5"}>
      <legend className="flex w-full flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">How well it runs</span>
        <LevelMeter level={level.level} />
      </legend>
      {!operating ? (
        <p className="mt-2 text-sm text-ink-muted">
          These count once something here is marked Deployed. A process around a tool that is not running is not a control.
        </p>
      ) : null}
      <ul className="mt-2 flex flex-col gap-1">
        {practices.map((practice) => {
          const on = level.confirmed.includes(practice.id);
          return (
            <li key={practice.id}>
              <label className={"flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 text-sm md:min-h-0 " + (operating ? "text-ink hover:bg-subtle" : "text-ink-muted")}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0"
                  checked={on}
                  disabled={!operating}
                  onChange={(event) => onToggle(practice.id, event.target.checked)}
                />
                <span>{practice.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Every category with its level, weakest essentials first. */
export function MaturityTable({ levels, onOpen }: { levels: CategoryLevel[]; onOpen: (categoryId: string) => void }) {
  const rows = [...levels].sort(
    (a, b) => Number(b.category.essential) - Number(a.category.essential) || a.level - b.level || a.category.name.localeCompare(b.category.name),
  );
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs text-ink-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Category</th>
            <th className="py-2 pr-3 font-medium">Level</th>
            <th className="py-2 font-medium">Next step</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const next = nextPractice(row);
            return (
              <tr key={row.category.id} className="border-b border-line align-top last:border-0">
                <td className="py-2 pr-3">
                  <button type="button" onClick={() => onOpen(row.category.id)} className="text-left font-medium text-ink hover:text-brand">
                    {row.category.name}
                    {row.category.essential ? <span className="text-ink-muted"> *</span> : null}
                  </button>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <LevelMeter level={row.level} />
                </td>
                <td className="py-2 text-ink-muted">
                  {row.level === 0 ? "Get something deployed and mark it on Setup." : next ? next.text : "All practices confirmed."}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Questions to put to vendors in this category, so the sales call runs on your terms. */
export function VendorQuestionsCard({ category }: { category: Category }) {
  const questions = category.vendorQuestions;
  if (!questions) return null;
  return (
    <article className="rounded-card bg-surface p-5 text-ink shadow-card md:p-6" aria-labelledby={"vq-" + category.id}>
      <h3 id={"vq-" + category.id} className="font-display text-lg font-semibold">
        Questions to ask vendors
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Common claims in {category.name.toLowerCase()} and how to test them, the proof to ask for before you buy, and answers that should make you push back.
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <section>
          <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Claims to challenge</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {questions.claims.map((row) => (
              <li key={row.claim} className="text-sm">
                <p className="font-medium text-ink">“{row.claim}”</p>
                <p className="mt-0.5 text-ink-muted">{row.ask}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="text-xs font-semibold tracking-wide text-brand uppercase">Proof to request</h4>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-4 text-sm text-ink">
            {questions.proof.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="text-xs font-semibold tracking-wide text-risk-high uppercase">Red flags</h4>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-4 text-sm text-ink">
            {questions.redFlags.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
