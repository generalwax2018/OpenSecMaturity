import { APP_VERSION, GITHUB_API, GITHUB_REPO } from "@/data/app-meta";

export type GitCommit = {
  sha: string;
  title: string;
  date: string;
  url: string;
};

export type GitHubCheck = {
  localVersion: string;
  remoteVersion: string | null;
  matches: boolean;
  features: GitCommit[];
  vendors: GitCommit[];
};

type ApiCommit = {
  sha?: string;
  html_url?: string;
  commit?: { message?: string; committer?: { date?: string } };
};

const RAW = "https://raw.githubusercontent.com/" + GITHUB_REPO + "/main/";
const CATALOG_PATHS = ["catalog", "web/public/standards.json"];

async function getJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function asCommits(value: unknown): GitCommit[] {
  if (!Array.isArray(value)) return [];
  return (value as ApiCommit[]).map((row) => ({
    sha: String(row.sha ?? "").slice(0, 7),
    title: row.commit?.message?.split("\n")[0]?.trim() || "Update",
    date: row.commit?.committer?.date?.slice(0, 10) ?? "",
    url: typeof row.html_url === "string" && row.html_url.startsWith("https://github.com/") ? row.html_url : "https://github.com/" + GITHUB_REPO,
  }));
}

/**
 * Optional, and only runs when the user clicks the button. It reads public
 * GitHub data from the browser and sends nothing about the assessment.
 */
export async function checkGitHub(): Promise<GitHubCheck> {
  const mainRaw = await getJson(GITHUB_API + "/commits?per_page=12");
  if (!mainRaw) throw new Error("GitHub could not be reached");
  const main = asCommits(mainRaw);
  const perPath = await Promise.all(
    CATALOG_PATHS.map((path) => getJson(GITHUB_API + "/commits?per_page=5&path=" + encodeURIComponent(path))),
  );
  const vendors = perPath
    .flatMap(asCommits)
    .filter((item, index, all) => all.findIndex((row) => row.sha === item.sha) === index)
    .slice(0, 5);
  const vendorShas = new Set(vendors.map((item) => item.sha));
  const versionFile = (await getJson(RAW + "web/public/app.json")) as { version?: string } | null;
  const remoteVersion = versionFile?.version ?? null;
  return {
    localVersion: APP_VERSION,
    remoteVersion,
    matches: remoteVersion !== null && remoteVersion === APP_VERSION,
    features: main.filter((item) => !vendorShas.has(item.sha)).slice(0, 6),
    vendors,
  };
}
