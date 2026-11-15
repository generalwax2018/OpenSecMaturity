# Roadmap

## Good first issues

These need no app code, only research and a pull request to `catalog/`. See CONTRIBUTING.md.

- Work through the open **Catalog freshness report** issue: re-check entries and fix broken links.
- Source the pricing for add-ons that show "Pricing not checked" (for example Falcon Complete, Vigilance MDR, Wiz Defend, Tenable OT Security).
- Confirm FedRAMP status on the FedRAMP Marketplace for products marked "Authorized", and record the impact level.
- Check EU data residency for SaaS products that show "Not checked".
- Add licence suites from vendors other than Microsoft whose products are in the catalog.
- Challenge or improve the maturity practices and vendor questions for a category you know well.

## Planned

- New categories: third-party risk management, OT and ICS security, data loss prevention, device management, secrets management, and AI security and governance.
- Split the remaining tabs out of `maturity-app.tsx` into their own components.
- An accessibility audit.

## Done

- Maturity levels per category, questions to ask vendors, a hosted copy, release-pinned catalog updates with a digest check, build provenance, and imports of identity-provider app exports (2026.11.14).

## Decided against

- **A live Microsoft Entra ID connector.** It would need a sign-in and new network destinations, which breaks the promise that the only network request is the optional update check. Importing an app list exported from Entra ID or Okta gives most of the value and keeps that promise.
