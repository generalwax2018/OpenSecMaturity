import { GITHUB_REPO } from "@/data/app-meta";
import type { Tool } from "@/data/catalog";

export function correctionUrl(tool: Tool): string {
  const params = new URLSearchParams({ template: "correction.yml", title: "Correction: " + tool.name, product: tool.id });
  return "https://github.com/" + GITHUB_REPO + "/issues/new?" + params.toString();
}

/** Only https links leave the app; anything else is neutralised. */
export function safeHref(url: string): string {
  return /^https:\/\//i.test(url) ? url : "#";
}
