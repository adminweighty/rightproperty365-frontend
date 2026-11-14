/**
 * Every business fact the legal pages state. The documents in
 * `src/content/legal` read from here and write nothing of their own that may
 * change: change a value here and every page, the footer and the consent
 * version follow.
 *
 * VALUES MARKED "CONFIRM" ARE ASSUMPTIONS. They were chosen as neutral
 * defaults so the pages read correctly, and must be confirmed or corrected by
 * the business and its lawyer before the live launch. See docs/legal.md.
 *
 * A value that is `null` is simply left out of the pages: nothing is printed
 * in its place.
 */

export type LegalDocumentKey = "privacyPolicy" | "termsAndConditions" | "refundPolicy" | "eula";

export const legal = {
  /** The name the service trades under. */
  tradingName: "RightProperty365",
  website: "rightproperty365.com",

  /** CONFIRM: the registered name of the company or person that operates the service, e.g. "Example (Private) Limited". */
  legalEntity: null as string | null,
  /** CONFIRM: its company or business registration number. */
  registrationNumber: null as string | null,
  /** CONFIRM: its registered or principal business address, on one line. */
  registeredAddress: null as string | null,

  /** CONFIRM: these mailboxes must exist and be read before the pages go live. */
  emails: {
    privacy: "privacy@rightproperty365.com",
    legal: "legal@rightproperty365.com",
    support: "support@rightproperty365.com",
    billing: "billing@rightproperty365.com",
  },

  /** CONFIRM: the law the documents are governed by, as it reads after "governed by". */
  governingLaw: "the laws of Zimbabwe",
  /** CONFIRM: the courts that hear disputes, as it reads after "heard by". */
  courts: "the courts of Zimbabwe",

  /** A data protection officer, if one is appointed: name or title and how to reach them. Null: none is claimed. */
  dataProtectionOfficer: null as string | null,
  /** A representative in the UK or the EU, if one is appointed. Null: none is claimed. */
  ukEuRepresentative: null as string | null,

  /** The youngest age at which someone may hold an account. */
  minimumAge: 18,

  /**
   * CONFIRM: the refund terms for fees paid to RightProperty365 are not
   * decided. These numbers are placeholders that make the Refund Policy
   * complete; the business must confirm each one.
   */
  refunds: {
    /** Days after a payment within which a refund may be requested. */
    requestWindowDays: 14,
    /** Days within which we answer a refund request. */
    responseDays: 10,
    /** Days after a refund is approved within which it is paid. */
    processingDays: 14,
  },

  /** CONFIRM: the cap on our liability is the fees paid to us in this many months before the claim. */
  liabilityCapMonths: 12,

  /**
   * Each document's version and the date it took effect (ISO dates). Change
   * both whenever the wording of a document changes. The privacy policy's
   * version is sent to the API with every consent (`PRIVACY_NOTICE_VERSION`),
   * at most 32 characters.
   */
  documents: {
    privacyPolicy: { version: "2026-11-14", effectiveDate: "2026-11-14" },
    termsAndConditions: { version: "2026-11-14", effectiveDate: "2026-11-14" },
    refundPolicy: { version: "2026-11-14", effectiveDate: "2026-11-14" },
    eula: { version: "2026-11-14", effectiveDate: "2026-11-14" },
  } satisfies Record<LegalDocumentKey, { version: string; effectiveDate: string }>,
} as const;

export type LegalDocumentInfo = {
  key: LegalDocumentKey;
  /** The page's address. The mobile apps link to these: do not change them. */
  path: string;
  title: string;
  /** A shorter name for links in a sentence or a list. */
  shortTitle: string;
  /** One sentence for the index page and the page's description. */
  description: string;
  version: string;
  effectiveDate: string;
};

export const LEGAL_INDEX_PATH = "/legal";

/** The four documents, in the order they are listed everywhere. */
export const legalDocuments: LegalDocumentInfo[] = [
  {
    key: "privacyPolicy",
    path: "/legal/privacy-policy",
    title: "Privacy Policy",
    shortTitle: "Privacy Policy",
    description:
      "What personal information RightProperty365 collects, why, who sees it, how long it is kept and the rights you have over it.",
    ...legal.documents.privacyPolicy,
  },
  {
    key: "termsAndConditions",
    path: "/legal/terms-and-conditions",
    title: "Terms and Conditions",
    shortTitle: "Terms and Conditions",
    description:
      "The rules for using RightProperty365: accounts, roles and verification, listings, enquiries, what is not allowed, and what we are and are not responsible for.",
    ...legal.documents.termsAndConditions,
  },
  {
    key: "refundPolicy",
    path: "/legal/refund-policy",
    title: "Refund Policy",
    shortTitle: "Refund Policy",
    description:
      "When fees paid to RightProperty365 are refunded, how to ask, and why we cannot refund money paid to an agent, owner, host, solicitor or service provider.",
    ...legal.documents.refundPolicy,
  },
  {
    key: "eula",
    path: "/legal/eula",
    title: "End User Licence Agreement",
    shortTitle: "End User Licence Agreement (EULA)",
    description:
      "The licence to install and use the RightProperty365 mobile and web applications, including the terms that apply to apps downloaded from the Apple App Store and Google Play.",
    ...legal.documents.eula,
  },
];

export function legalDocument(key: LegalDocumentKey): LegalDocumentInfo {
  const found = legalDocuments.find((document) => document.key === key);
  if (!found) throw new Error(`Unknown legal document: ${key}`);
  return found;
}

/** "14 November 2026" for an ISO date, whatever the server's time zone. */
export function formatLegalDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/**
 * Who operates the service, as one sentence that reads naturally whichever
 * details are known: with none, it says only what the service is and where
 * it is found.
 */
export function operatorSentence(): string {
  const { tradingName, legalEntity, registrationNumber, registeredAddress, website } = legal;
  const parts: string[] = [];
  if (legalEntity) {
    parts.push(
      `${tradingName} is operated by ${legalEntity}${registrationNumber ? ` (registration number ${registrationNumber})` : ""}${registeredAddress ? `, of ${registeredAddress}` : ""}.`,
    );
  } else if (registeredAddress) {
    parts.push(`${tradingName} operates from ${registeredAddress}.`);
  }
  return [`${tradingName} is an online property marketplace, and a place to find property professionals and businesses, available at ${website} and through the ${tradingName} mobile applications.`, ...parts].join(" ");
}
