import { readSheet } from "read-excel-file/universal";
import writeExcelFile from "write-excel-file/universal";

export type InventoryRow = {
  name: string;
  vendor: string;
  purpose: string;
  evidence: string;
};

const MAX_INVENTORY_BYTES = 10 * 1024 * 1024;
const MAX_INVENTORY_ROWS = 5_000;

const NAME_KEYS = ["tool", "name", "product", "application", "app"];
const VENDOR_KEYS = ["vendor", "publisher", "manufacturer"];
const PURPOSE_KEYS = ["purpose", "description", "use"];
const EVIDENCE_KEYS = ["source", "evidence", "table", "location"];

function cell(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.some((candidate) => normalized === candidate || normalized.includes(candidate))) {
      const value = cell(row[key]);
      if (value) return value;
    }
  }
  return "";
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

/** First row is the header. Columns are matched by name, in any order. */
export function rowsFromGrid(grid: unknown[][]): InventoryRow[] {
  const [header, ...rest] = grid;
  const body = rest.slice(0, MAX_INVENTORY_ROWS);
  if (!header) return [];
  const keys = header.map((value, index) => cell(value) || "Column " + (index + 1));
  return body
    .map((cells) => {
      // Header names come from the file, so use a map with no prototype.
      const row: Record<string, unknown> = Object.create(null);
      keys.forEach((key, index) => {
        row[key] = cells[index] ?? "";
      });
      const values = cells.map(cell).filter(Boolean);
      return {
        name: pick(row, NAME_KEYS) || values[0] || "",
        vendor: pick(row, VENDOR_KEYS),
        purpose: pick(row, PURPOSE_KEYS),
        evidence: pick(row, EVIDENCE_KEYS),
      };
    })
    .filter((row) => row.name);
}

export async function parseInventoryFile(file: File): Promise<InventoryRow[]> {
  if (file.size > MAX_INVENTORY_BYTES) throw new Error("Inventory files are limited to 10 MB.");
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (isCsv) return rowsFromGrid(parseCsv(await file.text()));
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("Use an .xlsx or .csv file. Older .xls files need to be saved as .xlsx first.");
  }
  return rowsFromGrid((await readSheet(file)) as unknown[][]);
}

export async function downloadInventoryTemplate(): Promise<void> {
  const rows = [
    ["Tool", "Vendor", "Purpose", "Source"],
    ["CrowdStrike", "CrowdStrike", "Endpoint detection on laptops", "snowflake.security.edr_agents"],
    ["Wiz", "Wiz", "Cloud posture", "bigquery.security.wiz_findings"],
  ];
  const blob = await writeExcelFile(
    rows.map((cells) => cells.map((value) => ({ value }))),
    { sheet: "Inventory" },
  ).toBlob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "opensecmaturity-inventory.xlsx";
  link.click();
  URL.revokeObjectURL(link.href);
}
