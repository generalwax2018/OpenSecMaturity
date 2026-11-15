import { describe, expect, it } from "vitest";
import { parseCsv, rowsFromGrid } from "@/lib/inventory-import";

describe("inventory import", () => {
  it("reads a plain tool inventory", () => {
    const rows = rowsFromGrid(parseCsv('Tool,Vendor,Purpose,Source\n"Checkmarx One","Checkmarx","SAST, in CI",ci\n'));
    expect(rows).toEqual([{ name: "Checkmarx One", vendor: "Checkmarx", purpose: "SAST, in CI", evidence: "ci" }]);
  });

  it("reads an identity-provider app export where the id columns come first", () => {
    const csv = "id,appId,displayName,homepageUrl,applicationType\n1f0c,9b2e,CrowdStrike Falcon,https://x,Enterprise\n2a1d,77aa,Okta,https://y,Enterprise\n";
    expect(rowsFromGrid(parseCsv(csv)).map((row) => row.name)).toEqual(["CrowdStrike Falcon", "Okta"]);
  });

  it("reads an Okta-style export that names apps in a label column", () => {
    const csv = "id,label,status,signOnMode\n0oa1,Wiz,ACTIVE,SAML_2_0\n";
    expect(rowsFromGrid(parseCsv(csv)).map((row) => row.name)).toEqual(["Wiz"]);
  });

  it("does not take an application id as the name", () => {
    const csv = "Application ID,Application Name\n1234-abcd,KnowBe4\n";
    expect(rowsFromGrid(parseCsv(csv))[0].name).toBe("KnowBe4");
  });
});
