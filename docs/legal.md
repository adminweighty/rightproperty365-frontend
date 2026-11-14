# Legal pages

The public legal documents are at `/legal`:

| Page | Address | Wording |
| --- | --- | --- |
| Privacy Policy | `/legal/privacy-policy` | `src/content/legal/privacy-policy.tsx` |
| Terms and Conditions | `/legal/terms-and-conditions` | `src/content/legal/terms-and-conditions.tsx` |
| Refund Policy | `/legal/refund-policy` | `src/content/legal/refund-policy.tsx` |
| End User Licence Agreement | `/legal/eula` | `src/content/legal/eula.tsx` |

The mobile apps and the app-store listings link to these addresses and to section anchors (`#deleting-your-account`). Do not change a path or a section `id`.

## Status

**These are working documents, written from what the product actually does. They are not legal advice. A qualified lawyer must review them before the live launch**, and again for each country where the business actively markets the service. The public pages carry no "draft" notice, so do not put them in front of real customers until that review is done. Staging shows the test-site banner on every page.

## Where the facts are

Every business fact is in `src/lib/legal.ts`. The pages print nothing of their own that may change. A value that is `null` is left out of the pages: there is no "TBC" text.

## Assumptions to confirm

| Value in `src/lib/legal.ts` | Set to | Needs |
| --- | --- | --- |
| `legalEntity` | `null` (pages say "RightProperty365") | The registered name of the operating company |
| `registrationNumber` | `null` | Its registration number |
| `registeredAddress` | `null` | Its registered address. Apple requires a contact address for the developer in the EULA; the EULA prints it once it is set |
| `emails.privacy`, `.legal`, `.support`, `.billing` | `privacy@`, `legal@`, `support@`, `billing@rightproperty365.com` | **The mailboxes must exist and be read.** The pages tell people to write to them for data requests, account deletion, refunds and complaints |
| `governingLaw`, `courts` | "the laws of Zimbabwe", "the courts of Zimbabwe" | Confirmation by the lawyer, with the entity's country |
| `dataProtectionOfficer`, `ukEuRepresentative` | `null` (none claimed) | A decision on whether either must be appointed |
| `minimumAge` | 18 | Confirmation |
| `refunds.requestWindowDays` | 14 | The commercial decision |
| `refunds.responseDays` | 10 | The commercial decision |
| `refunds.processingDays` | 14 | The commercial decision |
| `liabilityCapMonths` | 12 | The lawyer's view on a cap that is enforceable for consumers and for businesses |
| `documents.*.version`, `.effectiveDate` | `2026-11-14` | Set to the real effective date when the reviewed text is published |

## Statements that rest on an assumption

Check each of these against how the business will really operate:

- **Refund Policy.** The grounds for a refund (duplicate, mistaken, not activated, cancelled before activation, application refused, pro-rata if we withdraw a paid service) and the grounds for none (part-used periods, no results, removal for breach) are neutral defaults. The commercial terms have not been decided.
- **Retention.** The Privacy Policy describes how long information is kept in words ("while your account is open", "for a limited time afterwards"). No retention periods have been set. The business should set them and the policy should then state them.
- **Account deletion** is by email to the privacy address. The policy says listings and the public profile are removed when a Professional's account is deleted; the process for doing that must exist. Apple and Google both expect account deletion to be easy to start from inside the app: self-service deletion is planned and the documents must be updated when it ships.
- **Security.** The policy says connections are encrypted, passwords are hashed, onboarding documents are in private storage and each time an administrator opens one it is recorded. Confirm for the production deployment.
- **Processors.** Only the email provider (Resend) is named. The hosting provider is described, not named. Name it if the lawyer advises.
- **International transfers.** Described generally. If UK or EU residents are targeted, the transfer safeguards and the question of a UK or EU representative need advice.
- **Marketing emails.** The policy says none are sent today.
- **Mobile app permissions.** The EULA says the app asks before using a device feature such as notifications or the photo library. Match it to what the released apps request, and to the privacy labels in each store.
- **Verification.** "Verified" is described as a review of the onboarding documents and not a warranty. Keep the product's wording consistent with that.
- **Liability cap and indemnity** in the Terms and Conditions are drafted to be reasonable, not tested against any country's consumer law.

## Needs sign-off before launch

1. Entity details, governing law and courts.
2. Refund terms and the numbers above.
3. Data protection: registration or notification with the Data Protection Authority in Zimbabwe (POTRAZ) and anywhere else it is required; retention periods; processor contracts; whether a data protection officer or a UK/EU representative is needed.
4. Consumer law in each country where the service is marketed (cancellation rights, unfair terms, mandatory wording).
5. Estate-agency and advertising rules that apply to a listing platform in each market.
6. App-store review: Apple's minimum EULA terms, the privacy labels, and account deletion.

## Changing a document

1. Edit the wording in `src/content/legal`. Keep section ids.
2. In `src/lib/legal.ts`, set that document's `version` and `effectiveDate`.
3. The Privacy Policy's version is sent to the API with every consent (`PRIVACY_NOTICE_VERSION` in `src/lib/env.ts` follows it), so the API records which text a person agreed to. It may be at most 32 characters.
4. If the change is significant, tell users before it takes effect, as each document promises.
