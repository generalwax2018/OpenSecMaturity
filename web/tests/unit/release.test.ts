import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG_FILES, catalogDigest, parseRelease, rawUrl } from "@/lib/release";

const catalogDir = fileURLToPath(new URL("../../../catalog/", import.meta.url));

function hasSha256sum(): boolean {
  try {
    execFileSync("sha256sum", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("parseRelease", () => {
  it("reads the tag and the catalog digest from the notes", () => {
    const digest = "a".repeat(64);
    const release = parseRelease({
      tag_name: "v2026.11.14",
      html_url: "https://github.com/generalwax2018/OpenSecMaturity/releases/tag/v2026.11.14",
      body: "Notes\n\ncatalog-sha256: " + digest + "\n",
    });
    expect(release).toEqual({
      tag: "v2026.11.14",
      version: "2026.11.14",
      url: "https://github.com/generalwax2018/OpenSecMaturity/releases/tag/v2026.11.14",
      catalogSha256: digest,
    });
  });

  it("refuses odd tags and ignores links to other sites", () => {
    expect(() => parseRelease({ tag_name: "main" })).toThrow();
    expect(() => parseRelease({ tag_name: "v2026.11.14/../../x" })).toThrow();
    const release = parseRelease({ tag_name: "v2026.11.14", html_url: "https://evil.example/x" });
    expect(release.url).toBe("https://github.com/generalwax2018/OpenSecMaturity/releases/latest");
    expect(release.catalogSha256).toBeNull();
  });

  it("builds raw URLs at the tag, not main", () => {
    expect(rawUrl("v2026.11.14", "catalog/products.json")).toBe(
      "https://raw.githubusercontent.com/generalwax2018/OpenSecMaturity/v2026.11.14/catalog/products.json",
    );
  });
});

describe("catalogDigest", () => {
  it.runIf(hasSha256sum())("matches the release workflow's sha256sum pipeline", async () => {
    const files = CATALOG_FILES.map((name) => ({ name, bytes: new Uint8Array(readFileSync(catalogDir + name)) }));
    const manifest = execFileSync("sha256sum", [...CATALOG_FILES], { cwd: catalogDir });
    const expected = execFileSync("sha256sum", { input: manifest }).toString().split(" ")[0];
    expect(await catalogDigest(files)).toBe(expected);
  });

  it("changes when any file changes", async () => {
    const base = CATALOG_FILES.map((name) => ({ name, bytes: new TextEncoder().encode(name) }));
    const changed = base.map((file, index) => (index === 2 ? { ...file, bytes: new TextEncoder().encode("other") } : file));
    expect(await catalogDigest(base)).not.toBe(await catalogDigest(changed));
  });
});
