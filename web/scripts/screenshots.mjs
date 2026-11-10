// Regenerates the README screenshots from the built app using the example company.
//   npm run build && npm run screenshots
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "..", "docs", "screenshots");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "light" });
await context.route("https://**", (route) => route.fulfill({ status: 404, body: "" }));
const page = await context.newPage();
await page.goto(pathToFileURL(join(root, "dist", "index.html")).href);
await page.getByRole("button", { name: "Try an example company" }).click();
await page.waitForLoadState();
await page.waitForSelector("h1");
await page.waitForTimeout(600);
await page.screenshot({ path: join(out, "compare.png") });
await page.getByRole("tab", { name: "1. Setup" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "setup.png") });
await page.getByRole("tab", { name: "Overview" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: join(out, "overview.png") });
await browser.close();
console.log("screenshots written to docs/screenshots");
