// End-to-end checks against the built single file (run `npm run build` first).
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageUrl = pathToFileURL(join(root, "dist", "index.html")).href;
const catalogDir = join(root, "..", "catalog");
const work = mkdtempSync(join(tmpdir(), "osm-test-"));
let browser;
let context;
let page;
const problems = [];

async function freshPage() {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  // Keep tests offline: answer GitHub requests locally.
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await context.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  page = await context.newPage();
  page.on("pageerror", (error) => problems.push("page error: " + error.message));
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) problems.push("CSP: " + message.text());
  });
  await page.goto(pageUrl);
  await page.waitForSelector("h1");
}

const setupTab = () => page.getByRole("tab", { name: "1. Setup" });
const compareTab = () => page.getByRole("tab", { name: "2. Compare" });
const categoryButton = (name) => page.locator("nav[aria-label=Categories]").getByRole("button", { name });

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  assert.deepEqual(problems, [], "page errors or CSP violations");
});

test("opens on Setup with a Content-Security-Policy", async () => {
  await freshPage();
  assert.equal(await page.locator("[role=tab][aria-selected=true]").textContent(), "1. Setup");
  const html = readFileSync(join(root, "dist", "index.html"), "utf8");
  assert.match(html, /http-equiv="Content-Security-Policy"/);
});

test("setup, licence suites, and framework requirements drive Compare", async () => {
  await freshPage();
  for (const name of ["SOC 2", "PCI DSS"]) await page.getByRole("button", { name, exact: true }).click();
  await page.getByLabel("Microsoft 365 E3").check();
  for (const name of ["CrowdStrike", "Okta"]) await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Compare products for your gaps" }).click();
  await categoryButton(/Email security/).click();
  assert.match(await page.getByText(/^Required by/).textContent(), /PCI DSS/);
  assert.match(await page.getByText(/^Verdict:/).textContent(), /Use what you license/);
  const effects = await page.locator("#panel-compete tbody tr td:nth-child(3)").allTextContents();
  assert.equal(effects[0], "Already licensed");
});

test("an owned add-on covers another category", async () => {
  await freshPage();
  await page.getByRole("button", { name: "CrowdStrike", exact: true }).click();
  await page.getByRole("button", { name: "Falcon Spotlight" }).click();
  await compareTab().click();
  await categoryButton(/Vulnerability management/).click();
  assert.match(await page.locator("dd").first().textContent(), /Falcon Spotlight on CrowdStrike/);
  const effects = await page.locator("#panel-compete tbody tr td:nth-child(3)").allTextContents();
  assert.ok(effects.every((effect) => effect === "Overlaps"));
});

test("shortlist exports a PDF", async () => {
  await freshPage();
  await compareTab().click();
  await categoryButton(/Email security/).click();
  await page.getByRole("button", { name: "Shortlist Abnormal AI" }).first().click();
  await page.getByRole("button", { name: "Shortlist Mimecast Email Security" }).first().click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download shortlist PDF" }).click()]);
  const path = join(work, download.suggestedFilename());
  await download.saveAs(path);
  assert.ok(readFileSync(path, "latin1").startsWith("%PDF"));
});

test("CSV and Excel inventory import, and all report formats", async () => {
  await freshPage();
  await setupTab().click();
  await page.getByText("Import an inventory or add a product not in the list").click();
  const csv = join(work, "inventory.csv");
  writeFileSync(csv, 'Tool,Vendor,Purpose,Source\n"Checkmarx One","Checkmarx","SAST, in CI",ci\nVericode,,,\n__proto__,x,y,z\n');
  await page.locator('input[type=file][accept*=".csv"]').setInputFiles(csv);
  await page.getByText(/rows from inventory.csv/).waitFor();
  const [template] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download template" }).click()]);
  const xlsx = join(work, "template.xlsx");
  await template.saveAs(xlsx);
  await page.locator('input[type=file][accept*=".csv"]').setInputFiles(xlsx);
  await page.getByText(/2 rows from template.xlsx/).waitFor();
  for (const name of ["PDF", "Excel", "Text"]) {
    const [report] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name, exact: true }).click()]);
    const path = join(work, report.suggestedFilename());
    await report.saveAs(path);
    assert.ok(statSync(path).size > 1000, name + " report is not empty");
  }
});

test("a hostile assessment file and corrupted storage cannot break the app", async () => {
  await freshPage();
  const bad = join(work, "bad.json");
  writeFileSync(bad, '{"app":"OpenSecMaturity","format":1,"data":{"picked":"nope","size":"Huge","__proto__":{"polluted":true},"board":"compete"}}');
  await page.locator('input[type=file][accept*="json"]').setInputFiles(bad);
  await page.waitForTimeout(800);
  await page.waitForSelector("h1");
  assert.equal(await page.evaluate(() => ({}).polluted), undefined);
  await page.evaluate(() => {
    localStorage.setItem("opensecmaturity:v1:stack", JSON.stringify([{ name: 5 }]));
    localStorage.setItem("opensecmaturity:v1:picked", "{not json");
  });
  await page.reload();
  await page.waitForSelector("h1");
  assert.equal(await page.locator("h1").first().textContent(), "OpenSecMaturity");
});

test("the example company loads", async () => {
  await freshPage();
  await page.getByRole("button", { name: "Try an example company" }).click();
  await page.waitForLoadState();
  await page.waitForSelector("h1");
  assert.equal(await page.locator("[role=tab][aria-selected=true]").textContent(), "2. Compare");
  assert.match(await page.getByText(/^Verdict:/).textContent(), /Use what you license/);
});

test("catalog updates are checked, installed, and can be undone", async () => {
  await freshPage();
  const read = (name) => JSON.parse(readFileSync(join(catalogDir, name), "utf8"));
  const products = read("products.json");
  products.push({ ...products[0], id: "test-new-edr", name: "Test New EDR", aliases: [], extensions: [] });
  const remote = {
    "version.json": { format: 2, version: "2099.01.01" },
    "categories.json": read("categories.json"),
    "products.json": products,
    "suites.json": read("suites.json"),
    "app.json": { version: "2099.01.01.1" },
  };
  await context.unroute("https://raw.githubusercontent.com/**");
  await context.route("https://raw.githubusercontent.com/**", (route) => {
    const body = remote[route.request().url().split("/").pop()];
    return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await page.getByRole("link", { name: "Download the new version" }).waitFor();
  await page.getByRole("button", { name: "Update catalog" }).click();
  await page.waitForLoadState();
  await page.waitForSelector("h1");
  assert.equal(await page.getByRole("button", { name: "Test New EDR", exact: true }).count(), 1);
  remote["version.json"] = { format: 2, version: "2099.02.01" };
  remote["products.json"] = [{ id: "x", name: "x", vendor: "x", categoryId: "nope", description: "x" }];
  await page.getByRole("button", { name: "Check for updates" }).click();
  await page.getByText(/did not pass the checks/).waitFor();
  await page.getByRole("button", { name: "Go back to the built-in catalog" }).click();
  await page.waitForLoadState();
  await page.waitForSelector("h1");
  assert.equal(await page.getByRole("button", { name: "Test New EDR", exact: true }).count(), 0);
});
