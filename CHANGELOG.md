# Changelog

## 2026.11.14

- **Maturity, not only coverage.** Each category now has a level from 0 to 4: deployed counts 1, and each of three yes/no practices you confirm adds 1 (for example, for security monitoring: a source that goes quiet raises an alert; detections are tested at least quarterly). The headline score is the average level of the essentials. Coverage is still shown beside it. Practices count only once a category is deployed.
- **Questions to ask vendors.** Every category lists common sales claims and the question that tests each, the proof to ask for before you buy, and red flags. They are in the Compare tab and in the shortlist PDF.
- **More products to compare.** 11 new entries, each with sources: Sophos Endpoint, Bitdefender GravityZone, and Cortex XDR for endpoint; Check Point Email Security, IRONSCALES, and Sublime Security for email; Intruder, Nuclei, and Microsoft Defender Vulnerability Management for vulnerability management; Infection Monkey and AttackIQ Flex for adversary emulation. 89 products in all.
- **Updates come only from releases.** "Check for updates" now reads the latest tagged release instead of the main branch, and refuses catalog files that do not match the digest published in the release notes.
- **Verifiable downloads.** Each release file has a signed build provenance attestation: `gh attestation verify <file> --repo generalwax2018/OpenSecMaturity`.
- **A hosted copy.** Each release is also published to GitHub Pages, so you can use it without downloading anything. It is the same static file, and your assessment still stays in your browser.
- **Identity-provider imports.** App lists exported from Microsoft Entra ID or Okta can be imported like any inventory.
- **Catalog freshness.** A weekly job lists entries not reviewed in 180 days and source links that no longer work, in one GitHub issue.
- **Under the hood.** Scoring and verdict logic moved out of the main component into `web/src/lib/assessment.ts`, with 46 unit tests. GitHub Actions are pinned to commit SHAs, the secret scanner download is checked against its published hash, and one version number now covers the app, the package, and the catalog, with a check that fails the build when they drift.

Older assessments open as before. Their score will usually be lower, because practices start unconfirmed.

## 2026.11.10.3

First public release.

- Runs as a single HTML file with no server and no accounts. Assessments are saved in the browser and can be saved to and opened from a file.
- Guided Setup: company size, budget, frameworks, licence suites (Microsoft 365 Business Premium, E3, E5, E7), the products you run, and add-ons you have.
- Compare: for each gap, which products would fill it, framework requirement levels, strengths and weaknesses, deployment, FedRAMP, and EU residency filters, and a shortlist of up to three with a one-page PDF.
- Add-ons, including AI features, with how they are paid for and whether they close a gap or only strengthen a category.
- Catalog of 78 products in 15 categories, every entry with sources and a review date.
- Check for updates: downloads newer catalog data after checking it, and links to new app releases.
- Reports as PDF, Excel, or text.
- Security: strict Content-Security-Policy, validated imports, and size limits on files.
