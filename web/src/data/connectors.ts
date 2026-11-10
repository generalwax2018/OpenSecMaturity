export type Connector = {
  id: string;
  name: string;
  method: string;
  authorizeUrl: string;
  scopes: string[];
  finds: string;
  sample: string;
};

export const CONNECTORS: Connector[] = [
  {
    id: "entra",
    name: "Microsoft Entra ID",
    method: "OAuth 2.0 authorization code with PKCE",
    authorizeUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
    scopes: ["Application.Read.All", "Directory.Read.All", "SecurityEvents.Read.All"],
    finds: "Enterprise apps, Defender registrations, and security product service principals.",
    sample: "Microsoft Defender\nMicrosoft Sentinel\nDefender for Office 365\nMicrosoft Entra ID",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    method: "OAuth 2.0 authorization code",
    authorizeUrl: "https://{account}.snowflakecomputing.com/oauth/authorize",
    scopes: ["session:role:SECURITY_READ"],
    finds: "Table and view names in security schemas. Metadata only, not row contents.",
    sample: "CrowdStrike Falcon\nWiz\nTenable",
  },
  {
    id: "databricks",
    name: "Databricks",
    method: "OAuth 2.0 with PKCE",
    authorizeUrl: "https://accounts.cloud.databricks.com/oidc/accounts/{account}/v1/authorize",
    scopes: ["sql", "unity-catalog"],
    finds: "Unity Catalog table names that match security products.",
    sample: "Okta\nVeeam\nSentinelOne",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    method: "OAuth 2.0 authorization code",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/bigquery.readonly"],
    finds: "Dataset and table names in the security project.",
    sample: "Wiz\nKnowBe4",
  },
];
