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

- Each release is built by GitHub Actions from a tagged commit, passes the catalog checks, unit tests, and browser tests, and ships with a SHA-256 checksum and a signed build provenance attestation. Verify a download with `gh attestation verify <file> --repo generalwax2018/OpenSecMaturity`.
- The hosted copy on GitHub Pages is deployed by the same release run from the same build.
- Catalog updates are read from the latest release tag, never from a branch, and must match the `catalog-sha256` digest in that release's notes before the app checks their shape and uses them.
- Every GitHub Action is pinned to a commit SHA, and the secret scanner's download is checked against its published SHA-256.
- The app never replaces its own code in the background.
