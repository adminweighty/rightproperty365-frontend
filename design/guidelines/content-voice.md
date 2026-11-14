# Content and voice

RightProperty365 sounds like a knowledgeable, straightforward person who respects the reader's time: clear, calm and exact.

## Rules

- **Plain words.** "Send request", not "Submit enquiry form". "We could not reach the server", not "A network error occurred".
- **Sentence case** for headings, buttons, labels and menu items. The one exception is **role names**, which are proper titles (see "Role names").
- **Lead with what matters.** Put the outcome first, the detail second.
- **Be exact about status.** Say what the system knows. "Request received" is true the moment it is saved. "Delivered" and "seen" are claims we usually cannot make.
- **No blame.** "Enter a valid email address", not "You entered an invalid email".
- **No hype.** No exclamation marks, no "amazing", no "simply" or "just".
- **Numbers.** Use digits. Always show the currency code: `USD 385,000`. Use the metric system with a space before the unit: `2,000 m²`.
- **Dates and times.** Write `12 November 2026`. Include the time zone whenever a time is shown to two parties.

## Patterns

| Situation | Write | Avoid |
| --- | --- | --- |
| Primary button | Send request | Submit |
| Empty search | No properties match that search | Oops! Nothing here |
| Validation | Enter your phone number with the country code | Invalid input |
| Server failure | Something went wrong on our side. Please try again. | Error 500 |
| Success | Request received. Keep this reference: RP-7K2M9Q4D | Success! |
| Expired listing | This listing is no longer available | Listing not found |
| Self-recorded payment | Recorded by agent, not verified | Paid |
| Lease draft | Draft, not yet signed | Lease agreement |

## Role names

Role names are titles, written with capitals wherever they appear, including the middle of a sentence: "ask the Agency Principal to add you", "for Landlords and Property Sellers (Vendors)". Everything around them stays in sentence case.

**The source is the API, not this page.** The app shows the `label` of the `account_roles`, `organisation_kinds` and `directory_kinds` reference sets, the `role_label` of a membership and the `status_label` of an application, exactly as sent. This glossary is for writing copy around them; if the API's wording changes, the API wins and this list is updated.

| Group | Role names |
| --- | --- |
| Property Seekers | Prospective Buyer, Prospective Tenant |
| Real Estate Professionals | Estate Agent, Sales Agent, Lettings Agent, Property Manager, Solicitor |
| Real Estate Businesses | Agency Principal, Agency Administrator, Agency Staff |
| Property Owners | Landlord, Property Seller (Vendor) |
| Other property businesses | Host, Property Developer, Property Service Provider |
| Organisations | Real Estate Agency, Law Firm, Property Manager, Host, Property Developer, Property Service Provider |
| Membership of an organisation | Agency Principal, Agency Administrator, Estate Agent, Agency Staff at an agency; Principal, Manager, Staff elsewhere |
| RightProperty365 staff | Super Administrator, Platform Administrator, Market Administrator, Finance Administrator, Content Administrator, Moderator, Support |

- Say "Property Seeker", "Prospective Buyer" or "Prospective Tenant", not "buyer or renter" or "consumer". "Customer" is fine for the person who sent a request, seen from the inbox.
- Say "Property Seller (Vendor)", not "private seller"; "Agency Principal", not "agency owner"; "Real Estate Agency" for the organisation.
- Application statuses are also titles from the API: Pending Verification (not yet submitted), Under Review, Changes Requested, Approved, Rejected. Never "Verified" before an approval.
- The platform administrator titles are the one list written in the app (`platformRoleLabels` in `src/lib/api/auth.ts`), because the API has no labels for them.
- A role name describes who someone is, not what the product does. Do not promise a feature next to it that is not built (creating listings, appointments, bookings).

## Legal and trust wording

Wording for consent, privacy notices, lease documents, payment status and verification is controlled per market and needs sign-off before release. Use the approved text; do not rewrite it for tone.
