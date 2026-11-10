export type StandardRecord = {
  id: string;
  name: string;
  version: string;
  updated: string;
  summary: string;
};

export type StandardsFeed = {
  published: string;
  standards: StandardRecord[];
};

export const BUNDLED_STANDARDS: StandardsFeed = {
  published: "2026-11-09",
  standards: [
    {
      id: "cis",
      name: "CIS Controls",
      version: "8.1",
      updated: "2024-06",
      summary: "Prioritized safeguards. Implementation Group 1 is the practical baseline.",
    },
    {
      id: "nist",
      name: "NIST CSF",
      version: "2.0",
      updated: "2024-02",
      summary: "Outcome-based functions from Govern through Recover.",
    },
    {
      id: "iso",
      name: "ISO 27001",
      version: "2022",
      updated: "2022-10",
      summary: "Annex A control themes for an information security management system.",
    },
    {
      id: "soc2",
      name: "SOC 2",
      version: "2017 TSC",
      updated: "2022-12",
      summary: "Trust services criteria used in customer assurance reviews.",
    },
    {
      id: "pci",
      name: "PCI DSS",
      version: "4.0.1",
      updated: "2024-06",
      summary: "Cardholder-data controls. Use this on the payments area.",
    },
    {
      id: "hipaa",
      name: "HIPAA Security Rule",
      version: "2013",
      updated: "2013-03",
      summary: "Safeguards for protected health information.",
    },
    {
      id: "nist-800-53",
      name: "NIST 800-53",
      version: "Rev 5",
      updated: "2020-09",
      summary: "Security and privacy control catalog used by federal systems.",
    },
    {
      id: "nist-800-171",
      name: "NIST 800-171",
      version: "Rev 3",
      updated: "2024-05",
      summary: "Protecting controlled unclassified information in nonfederal systems.",
    },
    {
      id: "cmmc",
      name: "CMMC",
      version: "2.0",
      updated: "2024-10",
      summary: "Cybersecurity maturity levels required of defense contractors.",
    },
    {
      id: "fedramp",
      name: "FedRAMP",
      version: "Rev 5",
      updated: "2023-05",
      summary: "Cloud authorization baseline built on NIST 800-53.",
    },
    {
      id: "gdpr",
      name: "GDPR",
      version: "2016/679",
      updated: "2018-05",
      summary: "European rules for personal-data security and accountability.",
    },
    {
      id: "sox",
      name: "SOX ITGC",
      version: "2002",
      updated: "2002-07",
      summary: "IT general controls that support financial reporting.",
    },
  ],
};
