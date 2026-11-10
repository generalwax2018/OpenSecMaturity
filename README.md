# OpenSecMaturity

A free, open-source way to see where a security program stands and which products are worth looking at, without sitting through a sales pitch.

Enter your company size, budget, and the tools you already have. The app shows which essential categories are covered, where the gaps are, and how the products in each category compare: where each one wins and where it loses.

## It runs on your computer

There is no server, no account, and no tracking. What you enter is saved in your browser and nowhere else. You can save an assessment to a file, open it again later, or clear it.

The only network request the app can make is the optional **Check for updates** button, which reads this public repository from GitHub and sends nothing about your assessment.

## Install

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd web
npm install
npm run build
```

Then open `web/dist/index.html` in a browser. The build is one self-contained file, so you can also copy that file to another computer or a shared drive.

To work on the app with live reload:

```bash
cd web
npm run dev
```

and open http://127.0.0.1:8080.

## What is in it

- A guided Setup: pick your size, budget, frameworks, licence suites, and the products you run
- A Compare board that shows, for each gap, which products would fill it, what your frameworks require there, strengths and weaknesses, and filters for SaaS or self-hosted, FedRAMP, and EU data residency
- A shortlist of up to three products per category, side by side, with a one-page PDF
- Blue Team, Red Team, and Governance coverage, mapped to CIS Controls, NIST CSF, ISO 27001, and SOC 2, with PCI DSS and HIPAA for scoped business areas
- Inventory import from Excel (`.xlsx`) or CSV, with a downloadable template
- Risk register, 30/60/90-day plan, and a Compete board for each category
- Reports as PDF, Excel, or text

Connectors for Microsoft Entra ID, Snowflake, Databricks, and BigQuery are planned. In this release they show sample data only and do not connect to anything.

## The catalog

Products and categories live in `catalog/` as plain JSON. Each product can cite its sources and the date it was last reviewed, and the app labels any entry that has not been reviewed.

The catalog has 77 products across 15 categories. Every entry cites its sources, and its facts were last checked on the date shown on its card. Price tiers and wins/loses notes are editorial judgement. Corrections are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or correct a product, and [METHODOLOGY.md](METHODOLOGY.md) for how verdicts are reached and what they leave out.

Price tiers are rough guidance, not quotes.

## License

MIT
