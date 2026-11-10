# How OpenSecMaturity reaches a verdict

This page describes what the app does today, including what it does not yet take into account.

## Independence

No vendor pays to be listed, ranked, or described. There are no referral links. The catalog is plain data in `catalog/`, and every change to it is public in the git history.

## What a catalog entry is

Each product has a category, a price tier (Low, Medium, High), the company sizes it suits, a one-line description, and a compete note: where it wins and where it loses.

Each entry also carries `sources` and a `lastReviewed` date. An entry counts as reviewed only when it has both. The app shows this on every product card, and shows the count of reviewed entries at the top of the Compete board. Entries that have not been reviewed are labelled that way.

A review checks the facts in an entry against its sources: who makes the product and who owns it, what it does, which category it belongs in, and whether it is open source. Sources are vendor product pages and documentation, plus news reports for acquisitions and renames.

The price tier, the company sizes, and the wins/loses note are editorial judgement by the maintainers. Vendors rarely publish enterprise prices, so tiers are rough, and the cards say so.

## Maturity score

The score is the share of essential categories that are operating. A category counts only when it, or a product you own in it, is marked Deployed. Partial and Untested do not move the score: a licence is not the same as a control that works.

Limits: Deployed is your own statement. The app does not verify it.

## Framework requirements

Each category records how CIS Controls, NIST CSF, ISO 27001, SOC 2, PCI DSS, and the HIPAA Security Rule treat it, with a control reference. The app shows these in each framework's own terms:

- **Required**: the framework explicitly calls for this capability (for PCI DSS, a numbered requirement; for CIS, an IG1 or higher safeguard; for SOC 2, a criterion this capability is the usual way to meet).
- **Core outcome** (NIST CSF): the CSF is voluntary, so the strongest level is an outcome the framework centres on.
- **Annex A or clause (unless excluded)** (ISO 27001): required unless your Statement of Applicability excludes it.
- **Addressable** (HIPAA only): the Security Rule's own term. You implement it or document why an equivalent is reasonable.
- **Supports**: the capability helps meet the framework but is not the only way.
- **Not addressed**: the framework does not speak to it.

On the Compare tab, "Gaps only" sorts categories by how strongly the frameworks you selected call for them.

Limits: this mapping is maintainer judgement, reviewed against the framework texts but not by an assessor. Scope, compensating controls, and your auditor's reading decide what applies to you.

## Licence suites

`catalog/suites.json` lists licences that include catalog products, such as Microsoft 365 Business Premium, E3, and E5, with what each includes and a source. A product you license but have not marked as running shows as "Already licensed": the app tells you to deploy and prove it before buying another product. When you license a product but run a different one in the same category, it flags that you may be paying twice.

Only suites whose products are in the catalog are listed, so today the list is Microsoft-only. Other vendors' bundles are welcome as contributions.

## Deployment, FedRAMP, and EU residency

Each product records whether it runs as SaaS, self-hosted, or both. FedRAMP status and EU data residency are recorded only where a cited source confirms them, and the app shows "Not checked" everywhere else. "Not checked" does not mean "no". FedRAMP levels come from vendor announcements and should be confirmed on the FedRAMP Marketplace for the exact offering, which is often a separate government edition.

The FedRAMP and EU filters let self-hosted products through, because you control where they run.

## Add-ons

Products can list add-ons: modules, higher plans, managed services, and AI features such as Security Copilot, Charlotte AI, or Purple AI. Each add-on can say how it is paid for (included, higher plan, paid add-on, usage-based, or managed service), with a source. Add-ons without a source show "Pricing not checked".

For the products you run, the app says what each add-on would do for your maturity:

- **Closes a gap**: it covers another category you have not covered (for example a vulnerability module on your EDR agent). Once you mark it deployed, the score goes up.
- **Strengthens, no score change**: it improves a category you already cover, such as faster triage with AI. That can matter a great deal for how well the control works, but the score only counts whether an essential category is operating.
- **Overlaps**: you already cover that category with something else.

## Updates

"Check for updates" looks at the project's GitHub repository. Catalog updates (products, sources, add-ons, review dates) are data, so the app can download them, check them, and use them straight away; you can always go back to the built-in catalog. New app versions are a download you choose to install. The app never replaces its own code in the background, and the Content-Security-Policy would block it from running downloaded code.

## Shortlist

You can star up to three products per category to compare them side by side and download a one-page PDF. The shortlist appears in the full reports too.

## Compare verdicts

For one category, the app compares what you own against the catalog, using only company size and budget:

- **Shop**: you own nothing in the category. The cheapest product that suits your size and budget is named.
- **Drop one**: you own more than one product in the category.
- **Switch**: your product is not aimed at your company size, or its price tier is above your budget.
- **Stay**: your product suits your size and budget.

Limits: price tiers are coarse and are not quotes. The verdict does not consider integration effort, staffing, contract terms, or feature depth. In a category with only one or two products the verdict has little to compare, and `npm run validate:catalog` lists those categories.

## Corrections

If an entry is wrong or out of date, open an issue or a pull request with a source. See `CONTRIBUTING.md`.
