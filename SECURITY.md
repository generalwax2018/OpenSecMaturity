# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

Include what you found, how to reproduce it, and the app version (shown under "Check for updates"). You should get an acknowledgement within five working days.

## Scope

OpenSecMaturity is a single HTML file that runs in the browser. It has no server and no accounts, and it stores assessments only in the viewer's browser. Reports that matter most:

- anything that lets a crafted assessment file, inventory spreadsheet, or catalog update run code or read data it should not
- ways around the Content-Security-Policy in the built file
- catalog entries whose links point somewhere harmful

## How releases are protected

Each release is built by GitHub Actions from a tagged commit, passes the catalog checks and browser tests, and ships with a SHA-256 checksum. The app checks downloaded catalog data before using it and never replaces its own code in the background.
