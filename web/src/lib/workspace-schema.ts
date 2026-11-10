// Shape checks for everything the app saves in the browser or reads from an
// assessment file. A value that fails its check is ignored (the default is
// used instead), so a damaged or hand-edited file cannot break the app.

type Guard = (value: unknown) => boolean;

const MAX_TEXT = 2_000;
const MAX_ITEMS = 2_000;

const isString: Guard = (value) => typeof value === "string" && value.length <= MAX_TEXT;
const isBoolean: Guard = (value) => typeof value === "boolean";
const oneOf =
  (...options: string[]): Guard =>
  (value) =>
    typeof value === "string" && options.includes(value);
const arrayOf =
  (item: Guard): Guard =>
  (value) =>
    Array.isArray(value) && value.length <= MAX_ITEMS && value.every(item);
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const recordOf =
  (item: Guard): Guard =>
  (value) =>
    isPlainObject(value) && Object.keys(value).length <= MAX_ITEMS && Object.values(value).every(item);
const shape =
  (fields: Record<string, Guard>, optional: Record<string, Guard> = {}): Guard =>
  (value) =>
    isPlainObject(value) &&
    Object.entries(fields).every(([key, check]) => check(value[key])) &&
    Object.entries(optional).every(([key, check]) => value[key] === undefined || check(value[key]));
const nullable =
  (inner: Guard): Guard =>
  (value) =>
    value === null || inner(value);

const status = oneOf("Deployed", "Partial", "Untested");
const severity = oneOf("High", "Medium", "Low");
const planWindow = oneOf("Days 1–30", "Days 31–60", "Days 61–90");

export const WORKSPACE_SCHEMA: Record<string, Guard> = {
  size: oneOf("SMB", "Mid-market", "Enterprise"),
  budget: oneOf("Lean", "Balanced", "Open"),
  areas: arrayOf(shape({ id: isString, name: isString, frameworks: arrayOf(isString) })),
  categoryStatus: recordOf(status),
  owners: recordOf(isString),
  severities: recordOf(severity),
  likelihoods: recordOf(severity),
  windows: recordOf(planWindow),
  accepted: recordOf(shape({ owner: isString, expires: isString })),
  lastScan: nullable(arrayOf(isString)),
  checked: arrayOf(isString),
  owned: isString,
  stack: arrayOf(
    shape({ key: isString, name: isString, vendor: isString, purpose: isString, evidence: isString, status }),
  ),
  picked: arrayOf(isString),
  suites: arrayOf(isString),
  addons: arrayOf(isString),
  shortlist: recordOf(arrayOf(isString)),
  filters: shape({ deployment: oneOf("any", "SaaS", "Self-hosted"), fedramp: isBoolean, eu: isBoolean }),
  competeFilter: oneOf("gaps", "all"),
  board: oneOf("stack", "compete", "overview", "risk", "plan", "controls"),
  competeId: isString,
  extraFrameworks: arrayOf(shape({ id: isString, name: isString, summary: isString }, { version: isString })),
  versions: recordOf(isString),
  addedControls: arrayOf(
    shape({ id: isString, frameworkId: isString, name: isString, text: isString, operating: isBoolean }),
  ),
};

/** True when the key is known and the value has the expected shape. */
export function isValidEntry(key: string, value: unknown): boolean {
  const check = Object.prototype.hasOwnProperty.call(WORKSPACE_SCHEMA, key) ? WORKSPACE_SCHEMA[key] : undefined;
  return Boolean(check && check(value));
}
