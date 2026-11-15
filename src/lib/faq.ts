import { APP_LINKS_PLACEHOLDER_NOTE, appLinks, appLinksArePlaceholders } from "@/lib/app-links";
import { legal, legalDocument } from "@/lib/legal";

/**
 * The frequently asked questions (/faq), as data.
 *
 * An answer is structured rich text, not HTML: paragraphs and short lists
 * made of plain text and links. The page renders it as elements and the
 * FAQPage structured data reads it as plain text, so there is no
 * `dangerouslySetInnerHTML` anywhere. The shape is plain JSON on purpose:
 * the questions can later be served by the API or kept in the database, and
 * the page will not change. Only this file would be replaced by a reader.
 *
 * Writing rules: answer from what the product does today, never promise a
 * feature that is not built, role names are titles, everything else is
 * sentence case (design/guidelines/content-voice.md). A question's `id` is
 * its address (`/faq#why-no-phone-numbers`): do not change one once it is
 * published.
 */

/** A run of text, or a link. Internal links start with "/"; others open in a new tab. */
export type FaqInline = string | { text: string; href: string };

export type FaqBlock =
  | { type: "paragraph"; content: FaqInline[] }
  | { type: "list"; items: FaqInline[][] }
  /** The links to the app stores, from `src/lib/app-links.ts`. */
  | { type: "appLinks" };

export type Faq = { id: string; question: string; answer: FaqBlock[] };
export type FaqCategory = { id: string; title: string; questions: Faq[] };

const p = (...content: FaqInline[]): FaqBlock => ({ type: "paragraph", content });
const list = (...items: (FaqInline | FaqInline[])[]): FaqBlock => ({
  type: "list",
  items: items.map((item) => (Array.isArray(item) ? item : [item])),
});
const link = (text: string, href: string): FaqInline => ({ text, href });
const mail = (address: string): FaqInline => ({ text: address, href: `mailto:${address}` });

const support = mail(legal.emails.support);
const privacy = mail(legal.emails.privacy);
const privacyPolicy = link("Privacy Policy", legalDocument("privacyPolicy").path);
const terms = link("Terms and Conditions", legalDocument("termsAndConditions").path);
const refundPolicy = link("Refund Policy", legalDocument("refundPolicy").path);

export const faqCategories: FaqCategory[] = [
  {
    id: "about",
    title: "About RightProperty365",
    questions: [
      {
        id: "what-is-rightproperty365",
        question: "What is RightProperty365?",
        answer: [
          p(
            "RightProperty365 is a property marketplace. You can search homes, commercial property and land for sale or to rent, find places for a short stay, and find property professionals and businesses such as Estate Agents, Solicitors and Property Managers.",
          ),
          p(
            "We bring people together. We are not a party to any sale, lease or booking, and we are not an estate agent or a law firm.",
          ),
        ],
      },
      {
        id: "which-countries",
        question: "Which countries does it cover?",
        answer: [
          p(
            "Any country. RightProperty365 started in Zimbabwe and accepts listings from anywhere. The search shows the countries that have listings, and you can narrow it by country, region, city and suburb.",
          ),
        ],
      },
      {
        id: "is-it-free",
        question: "Is it free to search?",
        answer: [
          p(
            "Yes. Searching, sending enquiries and asking for a viewing are free, and you do not need an account to search or to send an enquiry.",
          ),
        ],
      },
      {
        id: "who-posts-listings",
        question: "Who puts the listings on the site?",
        answer: [
          p(
            "Listings come from Real Estate Agencies and their Estate Agents, Landlords, Property Sellers (Vendors), Hosts and Property Developers. Each of them applies for their role and is checked by our team before the role becomes active.",
          ),
        ],
      },
      {
        id: "what-verified-means",
        question: "What does “Verified” mean?",
        answer: [
          p(
            "A Verified badge means our team reviewed the documents we ask for when a professional, a business or an owner joins, such as proof of identity and business registration, and approved the application.",
          ),
          p(
            "The badge is shown beside the name of whoever advertises a property, on listings and on profiles. It is about them, not about one property.",
          ),
          p(
            "It is not a guarantee. We have not inspected the property, confirmed who owns it, or promised how anyone will behave. Make your own checks before you pay or sign anything. The ",
            terms,
            " explain this in full.",
          ),
        ],
      },
    ],
  },
  {
    id: "finding-a-property",
    title: "Finding a property",
    questions: [
      {
        id: "how-to-search",
        question: "How do I search?",
        answer: [
          p(
            "Start on the home page: choose “For sale” or “To rent”, pick a location, and press Search. Every drop-down can be searched by typing, so you can type part of a place name to find it.",
          ),
          p(
            "On the ",
            link("listings page", "/listings"),
            " you can narrow the results by country, region, city and suburb. “Advanced search” adds property type, bedrooms, bathrooms, floor and land area, price, features and how recently a property was listed.",
          ),
        ],
      },
      {
        id: "short-stays-search",
        question: "Can I find somewhere for a short stay?",
        answer: [
          p(
            "Yes. Choose the ",
            link("Short stays", "/listings?category=short-stay"),
            " category. Short stays are priced per night, in the currency of the listing.",
          ),
          p(
            "In “Advanced search” you can give the first night of your stay, the day you leave and the number of guests. The results are then the places that sleep that many and whose calendar is free for every night of the stay.",
          ),
          p(
            "Each short-stay listing shows a calendar of the nights that are available, its shortest stay and how many people it sleeps. The calendar is kept by the Host, and the page says when it was last updated.",
          ),
        ],
      },
      {
        id: "why-different-currencies",
        question: "Why are prices in different currencies?",
        answer: [
          p(
            "Each listing shows the price in the currency its advertiser chose, always with the currency code, for example USD 385,000. We do not convert prices. If you need a price in another currency, ask the advertiser.",
          ),
        ],
      },
      {
        id: "listing-no-longer-available",
        question: "Why does a listing say it is no longer available?",
        answer: [
          p(
            "Listings are published for a limited time, and advertisers remove them when a property is sold, let or withdrawn. If you follow an old link you will see “This listing is no longer available”, with a link to current listings.",
          ),
        ],
      },
      {
        id: "is-the-listing-accurate",
        question: "How do I know a listing is accurate?",
        answer: [
          p(
            "The advertiser is responsible for what a listing says. Ask questions in your enquiry, view the property, and check ownership and documents yourself or through a Solicitor before you commit. If something looks wrong, ",
            link("tell us", "#report-a-listing"),
            ".",
          ),
        ],
      },
    ],
  },
  {
    id: "contacting",
    title: "Contacting an agent, owner or business",
    questions: [
      {
        id: "why-no-phone-numbers",
        question: "Why are phone numbers and email addresses not shown?",
        answer: [
          p(
            "Contact on RightProperty365 is by enquiry only. It protects both sides from spam and scams, and it means there is a record of what was asked and when.",
          ),
          p(
            "Your own contact details are shown only to the person or business you send an enquiry to. They are never published.",
          ),
        ],
      },
      {
        id: "how-to-send-an-enquiry",
        question: "How do I send an enquiry?",
        answer: [
          p(
            "Open a listing, or the profile of a professional or business, and fill in the form: what you would like to do, your name and email address, how you want to be contacted, and your message. Tick the box to agree that your details are passed on, then send it.",
          ),
        ],
      },
      {
        id: "what-happens-after-enquiry",
        question: "What happens after I send an enquiry?",
        answer: [
          p(
            "You see “Request received” and a reference. That means we have saved your request and are passing it to the advertiser. It does not mean they have read it yet.",
          ),
          p(
            "They reply to you directly, using the contact method you chose. Keep the reference: quote it if you need to follow up with them or with us.",
          ),
        ],
      },
      {
        id: "nobody-replied",
        question: "What if nobody replies?",
        answer: [
          p(
            "Advertisers answer in their own time, and we cannot promise a reply. If you have heard nothing after a few days, send a new enquiry, or write to ",
            support,
            " with your reference and we will look into it.",
          ),
        ],
      },
      {
        id: "do-i-need-an-account",
        question: "Do I need an account?",
        answer: [
          p(
            "Not to search or to send an enquiry. You need an account to see and manage your appointments, and to apply for a professional role. ",
            link("Create an account", "/register"),
            " takes a minute.",
          ),
        ],
      },
    ],
  },
  {
    id: "appointments-and-stays",
    title: "Viewings, consultations and short stays",
    questions: [
      {
        id: "request-a-viewing",
        question: "How do I ask for a viewing or a consultation?",
        answer: [
          p(
            "On the listing’s form choose “Book a viewing”, or another option that offers a date and time, and add the time you would prefer. Your preferred time is saved as an appointment request. It is not confirmed until the advertiser accepts it.",
          ),
        ],
      },
      {
        id: "appointment-statuses",
        question: "What do “Requested”, “Confirmed” and “Reschedule Requested” mean?",
        answer: [
          list(
            "Requested: you asked for a time and the professional has not answered yet.",
            "Confirmed: the professional accepted the time.",
            "Reschedule Requested: one of you proposed a different time and is waiting for the other to accept it.",
          ),
          p("An appointment can also be Completed, Cancelled or marked No Show."),
        ],
      },
      {
        id: "where-are-my-appointments",
        question: "Where do I see my appointments?",
        answer: [
          p(
            "Sign in and open ",
            link("Your appointments", "/account/appointments"),
            ". You can accept a new time, propose another, or cancel. Times are shown in the appointment’s own time zone, which is named beside them.",
          ),
        ],
      },
      {
        id: "is-a-stay-request-a-booking",
        question: "Is a request to stay a confirmed booking?",
        answer: [
          p(
            "No. A request to stay is a request to the Host. It becomes a booking only when you and the Host agree it between yourselves.",
          ),
          p(
            "On a short-stay listing, choose your first night and the day you leave in the calendar, say how many guests, and send “Request to stay”. You get a reference straight away. The dates are not held for you, and nobody else is stopped from asking for them, until the Host confirms with you.",
          ),
          p(
            "The form shows an estimate, the nightly price times the number of nights. It is only an estimate: the Host confirms the final price. No payment for a stay is taken through RightProperty365.",
          ),
          p(
            "The availability on a listing is the Host’s own calendar. It is a guide to which nights are free, not a guarantee. If a night you asked for has been taken since the page was loaded, the form tells you which one.",
          ),
        ],
      },
      {
        id: "do-you-take-payments",
        question: "Do I pay through RightProperty365?",
        answer: [
          p(
            "No. There is no online payment on the website or in the app. We never take money for a stay, a deposit, rent or a purchase, and we never ask you to pay us for a property.",
          ),
          p(
            "Any payment is between you and the other person, so we cannot refund it. The ",
            refundPolicy,
            " explains this and what to do if something goes wrong.",
          ),
        ],
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts and roles",
    questions: [
      {
        id: "create-an-account",
        question: "How do I create an account?",
        answer: [
          p(
            link("Create an account", "/register"),
            " with your name, your email address and a password of at least 10 characters, and choose how you will use RightProperty365. We then send you an email with a link to confirm your address.",
          ),
        ],
      },
      {
        id: "more-than-one-role",
        question: "Can I choose more than one role?",
        answer: [
          p(
            "Yes. Choose every role that applies: for example, you can be a Prospective Buyer and a Landlord with one account.",
          ),
        ],
      },
      {
        id: "pending-verification",
        question: "Why does my role say “Pending Verification”?",
        answer: [
          p(
            "Prospective Buyer and Prospective Tenant are active straight away. Every other role is checked first. “Pending Verification” means you have not yet sent your application.",
          ),
          p(
            "Open ",
            link("Complete your profile", "/onboarding"),
            ", fill in the details, attach the documents and submit. The status changes to “Under Review”, and we email you when a decision is made.",
          ),
        ],
      },
      {
        id: "forgot-password",
        question: "I forgot my password. What do I do?",
        answer: [
          p(
            "Use ",
            link("Forgot password", "/forgot-password"),
            " and enter your email address. If an account exists for it, we send a link to set a new password.",
          ),
        ],
      },
      {
        id: "change-or-delete-account",
        question: "How do I change my details or delete my account?",
        answer: [
          p("To change your account details, write to ", support, " from the email address of your account."),
          p(
            "To delete your account, write to ",
            privacy,
            ". Deleting an account yourself from the site or the app is not available yet. The ",
            privacyPolicy,
            " explains what is deleted and what we may have to keep.",
          ),
        ],
      },
    ],
  },
  {
    id: "for-professionals",
    title: "For professionals",
    questions: [
      {
        id: "how-to-join",
        question: "How do I join as a professional or a business?",
        answer: [
          p(
            link("Create an account", "/register"),
            " and choose your role: Estate Agent, Solicitor, Property Manager, Landlord, Property Seller (Vendor), Host, Property Developer, Property Service Provider, or a role in a Real Estate Agency. After you confirm your email address you are taken to your application.",
          ),
        ],
      },
      {
        id: "which-documents",
        question: "Which documents will I be asked for?",
        answer: [
          p(
            "It depends on the role. They can include proof of identity, business registration, proof of address, professional certificates and proof of ownership. Your ",
            link("application", "/onboarding"),
            " lists exactly what your role needs and which items are optional.",
          ),
          p("Documents are private. Only you and our verification team can open them."),
        ],
      },
      {
        id: "how-long-verification-takes",
        question: "How long does verification take?",
        answer: [
          p(
            "Each application is reviewed by a person, so we do not give a fixed time. We email you when a decision is made. If we need something changed, the email and your application say what.",
          ),
        ],
      },
      {
        id: "where-enquiries-arrive",
        question: "Where do enquiries and appointments arrive?",
        answer: [
          p(
            "In your ",
            link("request inbox", "/agent/requests"),
            " and under ",
            link("Appointments", "/agent/appointments"),
            ", once your role is active, and in the RightProperty365 mobile app. The customer’s contact details are shown only there.",
          ),
        ],
      },
      {
        id: "how-to-add-listings",
        question: "How do I add my listings?",
        answer: [
          p(
            "Once your role is approved, sign in, open ",
            link("Your listings", "/agent/listings"),
            " and choose “Add a listing”. Fill in the details, add up to 20 photos and describe each one, then submit it for review. Everything is saved as you type.",
          ),
          p(
            "Our review team checks every listing before it is public, and every change to a public listing before visitors see it. We email you when a decision is made. If we ask for changes, the reason is shown on the listing.",
          ),
        ],
      },
      {
        id: "host-availability",
        question: "I am a Host. How do people see when my place is free?",
        answer: [
          p(
            "A short-stay listing shows an availability calendar. Every night is shown as available until you say otherwise. Sign in, open ",
            link("Your listings", "/agent/listings"),
            " and choose “Manage availability”. There you mark nights as booked or blocked, or make them available again, and set the shortest stay and the number of guests.",
          ),
          p(
            "Visitors only see whether a night is available. Why it is not, and any note you add, stay private to you and your organisation.",
          ),
          p(
            "A request to stay does not block any nights. When you agree a stay with a guest, mark its nights as booked yourself. Keep the calendar up to date: guests rely on it when they ask to stay, and searches by date use it. It is a guide for them, not a booking system.",
          ),
        ],
      },
      {
        id: "fees-and-subscriptions",
        question: "What does it cost?",
        answer: [
          p(
            "Where we offer paid subscriptions or promoted placements, the price is set out on an invoice. Invoices are paid outside the site and the app, for example by bank transfer. There is no online payment.",
          ),
          p("The ", refundPolicy, " says when a fee paid to us is refunded."),
        ],
      },
    ],
  },
  {
    id: "safety",
    title: "Safety and trust",
    questions: [
      {
        id: "avoid-scams",
        question: "How do I avoid property scams?",
        answer: [
          list(
            "Never pay a deposit, or any other money, for a property you have not seen.",
            "Check who you are dealing with, and that they own the property or are authorised to sell or let it.",
            "Have a Solicitor check title and ownership before you buy.",
            "Be wary of a price far below similar properties, and of pressure to pay quickly.",
            "Meet in a safe place, and take someone with you to a viewing if you can.",
            "Get agreements and receipts in writing.",
          ),
        ],
      },
      {
        id: "are-all-listings-verified",
        question: "Are all listings verified?",
        answer: [
          p(
            "Everyone who advertises on RightProperty365 is verified before their listings appear: every Estate Agent, Real Estate Agency, company and owner. A listing is shown only while whoever advertises it is verified. ",
            link("What “Verified” means", "/faq#what-verified-means"),
            ".",
          ),
          p(
            "That is a check of the advertiser, not of each property. We do not inspect properties, and a listing is not a guarantee of the property, its title, its price or the deal. Make your own checks, and have a Solicitor check title and ownership before you buy.",
          ),
        ],
      },
      {
        id: "agent-loses-verification",
        question: "What happens if an agent loses verification?",
        answer: [
          p(
            "Their listings are removed from the site and from search results, and stay off until they are verified again. The same applies to an agency, a company or an owner.",
          ),
          p(
            "If you think someone who is shown as Verified should not be, tell us at ",
            support,
            ".",
          ),
        ],
      },
      {
        id: "report-a-listing",
        question: "How do I report a suspicious listing or user?",
        answer: [
          p(
            "Write to ",
            support,
            " with the listing’s reference or address and what worried you. We investigate reports, and remove listings or suspend accounts that break our ",
            terms,
            ".",
          ),
          p("If you have lost money, also report it to the police and to your bank straight away."),
        ],
      },
      {
        id: "what-we-are-not",
        question: "Does RightProperty365 give legal or financial advice?",
        answer: [
          p(
            "No. We are not a party to your deal, and nothing on the site is legal, financial or valuation advice. For advice, speak to a qualified professional. You can find a ",
            link("Solicitor", "/directory/solicitors"),
            " here.",
          ),
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    questions: [
      {
        id: "what-data-you-keep",
        question: "What information do you keep about me?",
        answer: [
          p(
            "Your account details, the enquiries and appointment requests you send, and, if you apply for a professional role, your application and its documents. We use them to run your account, pass on your enquiries and check the people who list property. We do not sell personal information.",
          ),
          p("The ", privacyPolicy, " has the full list and explains your rights."),
        ],
      },
      {
        id: "cookies",
        question: "Do you use cookies?",
        answer: [
          p(
            "One. It keeps you signed in and is strictly necessary for accounts to work. There are no advertising, tracking or analytics cookies.",
          ),
        ],
      },
      {
        id: "emails-from-us",
        question: "What emails will I get?",
        answer: [
          p(
            "Only the ones the service needs: confirming your email address, resetting your password, updates about an enquiry or an appointment, and the outcome of an application. We do not send marketing emails today.",
          ),
        ],
      },
    ],
  },
  {
    id: "mobile-app",
    title: "Mobile app",
    questions: [
      {
        id: "is-there-an-app",
        question: "Is there a mobile app?",
        answer: [
          p(
            "Yes, the RightProperty365 mobile app for iPhone, Android and Huawei phones. You can search property and send enquiries in it, and professionals can manage their enquiries and appointments. It uses the same account as the website.",
          ),
        ],
      },
      {
        id: "where-to-get-the-app",
        question: "Where do I get the app?",
        answer: [
          p(
            appLinksArePlaceholders
              ? `From the Apple App Store, Google Play and Huawei AppGallery. ${APP_LINKS_PLACEHOLDER_NOTE}`
              : "From the Apple App Store, Google Play and Huawei AppGallery. The app is free and has no in-app purchases.",
          ),
          { type: "appLinks" },
        ],
      },
    ],
  },
  {
    id: "help",
    title: "Help",
    questions: [
      {
        id: "contact-support",
        question: "How do I contact support?",
        answer: [
          p(
            "Write to ",
            support,
            ". Tell us the email address of your account and any reference you were given, and describe what happened. For questions about your personal information write to ",
            privacy,
            ".",
          ),
        ],
      },
    ],
  },
];

const inlineText = (inline: FaqInline) => (typeof inline === "string" ? inline : inline.text);

/** An answer as plain text, for structured data and for searching. */
export function faqAnswerText(answer: FaqBlock[]): string {
  return answer
    .map((block) => {
      if (block.type === "paragraph") return block.content.map(inlineText).join("");
      if (block.type === "list") return block.items.map((item) => item.map(inlineText).join("")).join(" ");
      return appLinks.map((item) => item.label).join(". ") + ".";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export const faqCount = faqCategories.reduce((sum, category) => sum + category.questions.length, 0);
