// The latest published release is the only source of updates. Catalog files are
// read at that release's tag, not from main, and must match the catalog digest
// that the release workflow writes into the release notes. So nothing reaches
// users until a maintainer tags a release, and files changed after tagging are
// refused.
import { GITHUB_API, GITHUB_REPO } from "@/data/app-meta";

export const CATALOG_FILES = ["version.json", "categories.json", "products.json", "suites.json"] as const;

export type LatestRelease = {
  tag: string;
  /** The tag without its leading "v". */
  version: string;
  url: string;
  /** SHA-256 of the catalog manifest, from the release notes, or null if the release has none. */
  catalogSha256: string | null;
};

const TAG = /^v\d{4}\.\d{2}\.\d{2}(\.\d+)?$/;
const DIGEST = /^catalog-sha256:\s*([0-9a-f]{64})\s*$/im;

let pending: Promise<LatestRelease> | null = null;

/** Reads the latest release once per page load. */
export function latestRelease(): Promise<LatestRelease> {
  if (!pending) {
    pending = fetchLatestRelease().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/** For tests. */
export function forgetLatestRelease(): void {
  pending = null;
}

async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(GITHUB_API + "/releases/latest", { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!response.ok) throw new Error("GitHub could not be reached (" + response.status + ").");
  return parseRelease(await response.json());
}

export function parseRelease(value: unknown): LatestRelease {
  const row = value as { tag_name?: unknown; html_url?: unknown; body?: unknown } | null;
  const tag = typeof row?.tag_name === "string" ? row.tag_name : "";
  if (!TAG.test(tag)) throw new Error("The latest release has an unexpected tag.");
  const url =
    typeof row?.html_url === "string" && row.html_url.startsWith("https://github.com/" + GITHUB_REPO + "/")
      ? row.html_url
      : "https://github.com/" + GITHUB_REPO + "/releases/latest";
  const body = typeof row?.body === "string" ? row.body.slice(0, 20_000) : "";
  const match = DIGEST.exec(body);
  return { tag, version: tag.slice(1), url, catalogSha256: match ? match[1].toLowerCase() : null };
}

export function rawUrl(tag: string, path: string): string {
  return "https://raw.githubusercontent.com/" + GITHUB_REPO + "/" + encodeURIComponent(tag) + "/" + path;
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The digest the release workflow computes with
 *   cd catalog && sha256sum version.json categories.json products.json suites.json | sha256sum
 * that is, SHA-256 over sha256sum's own output lines.
 */
export async function catalogDigest(files: { name: string; bytes: ArrayBuffer | Uint8Array }[]): Promise<string> {
  const lines: string[] = [];
  for (const file of files) lines.push((await sha256Hex(file.bytes)) + "  " + file.name + "\n");
  return sha256Hex(new TextEncoder().encode(lines.join("")));
}
