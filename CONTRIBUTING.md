# Contributing

The most useful contribution is a better catalog. You do not need to touch the app code to make one.

## Add or correct a product

1. Edit `catalog/products.json`. Each product is one object. `catalog/product.schema.json` describes every field.
2. Cite what you relied on in `sources` (a title and an `https://` link each) and set `lastReviewed` to the date you checked them, as `YYYY-MM-DD`.
3. Run the checks:

   ```bash
   cd web
   npm install
   npm run validate:catalog
   ```

4. Open a pull request. Say in it whether you work for, sell, or resell the product or a competitor.

A minimal entry:

```json
{
  "id": "example-edr",
  "name": "Example EDR",
  "vendor": "Example Inc.",
  "aliases": ["example endpoint"],
  "categoryId": "endpoint",
  "priceTier": "Medium",
  "bestFor": ["SMB", "Mid-market"],
  "openSource": false,
  "deployment": ["SaaS"],
  "fedramp": { "level": "Moderate", "source": { "title": "Example FedRAMP announcement", "url": "https://example.com/fedramp" } },
  "euResidency": { "source": { "title": "Example data residency page", "url": "https://example.com/eu" } },
  "description": "One neutral sentence on what it does.",
  "compete": {
    "wins": "Where it is the right choice.",
    "loses": "Where it is the wrong choice."
  },
  "lastReviewed": "2026-11-10",
  "sources": [{ "title": "Example EDR pricing page", "url": "https://example.com/pricing" }]
}
```

## Rules for entries

- Every product needs both a `wins` and a `loses`. An entry with no downside will not be merged.
- Write what a buyer would need to know, not what the brochure says. No superlatives.
- Prefer primary sources: vendor documentation and pricing pages, licence terms, public filings, independent test results. Analyst rankings and sponsored reviews are not sources.
- An entry without sources is allowed, but the app labels it "Not yet reviewed" and shows it as a maintainer opinion.
- Vendors are welcome to correct facts about their own product with a source. They do not get to edit the `loses` line of a competitor.

See `METHODOLOGY.md` for how the app turns the catalog into a verdict.

## Rules for FedRAMP and EU residency

Add `fedramp` or `euResidency` only with a source that confirms it for the SaaS offering. Leave the field out when you have not checked. Use `"Authorized"` when the source does not state the impact level.

## Add a licence suite

Edit `catalog/suites.json`. List the catalog products the suite includes, with the edition in `as` (for example "Defender for Endpoint Plan 1"), and cite the vendor's licensing page.

## Add a category

Edit `catalog/categories.json`. A category needs a control reference for CIS, NIST CSF, ISO 27001, and SOC 2, plus a `requirements` entry (level and reference) for each of the six frameworks, and should arrive with at least three products so there is something to compare.

## App changes

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:8080
npm test           # catalog checks and type check
```
