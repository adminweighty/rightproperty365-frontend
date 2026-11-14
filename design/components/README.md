# Components

Specifications for the components in `src/components`. Each one is rendered at `/design-system`.

Shared rules:

- Components take a `className` for layout (margin, width, grid placement) only, never to restyle.
- Every interactive component has hover, focus-visible, disabled and, where relevant, invalid and busy states.
- Focus uses the global 2px `focus` outline with a 2px offset. Do not remove it.

## Button (`ui/button.tsx`)

`Button` performs an action; `ButtonLink` navigates. Never put a click handler on a link or an `href` on a button.

| Variant | Use |
| --- | --- |
| `primary` | The single main action of a view |
| `secondary` | Alternative actions |
| `ghost` | Low-emphasis actions in toolbars and tables |
| `danger` | Destructive actions, always behind a confirmation |

| Size | Height | Use |
| --- | --- | --- |
| `sm` | 36px | Dense desktop UI only |
| `md` | 44px | Default |
| `lg` | 48px | Form submit, hero actions |

- The primary button is the brand indigo with white text; it is the largest block of brand colour on any page. There are no variants for coloured backgrounds, because there are no coloured panels.
- Labels are weight 600, a verb or verb plus noun in sentence case: "Send request", "Clear filters".
- While an action is in flight: `disabled`, `aria-busy`, and a label that says what is happening ("Sending…").
- Icons sit before the label at 16px and are `aria-hidden`. Icon-only buttons need an `aria-label`.

## Field, Input, Select, Textarea (`ui/field.tsx`)

`Field` renders the label, the control, and a hint or an error.

- Every control has a visible label. Placeholders are examples, never labels.
- Mark optional fields "(optional)" rather than marking required ones with an asterisk.
- Errors replace the hint, sit under the control, and say how to fix the problem. The control gets `aria-invalid` and `aria-describedby` pointing at the error.
- Controls are 44px tall with 16px text and a `control` border that meets 3:1.
- Use the right `type`, `autoComplete` and `inputMode` so phones show the right keyboard.

## Badge (`ui/badge.tsx`)

A short, non-interactive label. Tones: `neutral`, `primary`, `accent`, `success`, `warning`, `danger`, `info`. One or two words. A badge always includes text; an icon is optional.

## Card (`ui/card.tsx`)

A white `surface` with a `line` border, `rounded-lg` and `shadow-xs`. Groups related content. Do not nest cards. Pass `padded={false}` when the card holds edge-to-edge media.

## Container (`ui/container.tsx`)

The page-width wrapper. Full-width bands (`bg-soft` or `bg-tint` with `border-y border-line`) put the background on the outer element and a `Container` inside it.

## ListingCard (`listings/listing-card.tsx`)

The unit of search results.

- Photo-led: a 4:3 photo fills the top of the card and zooms slightly on hover.
- Order under the photo: price, the facts line, title, location. Price comes first and is the most prominent text (24px, weight 700).
- The facts line (`ListingFacts`) is bedrooms, bathrooms and area on one line: an indigo icon, the value in `ink` weight 600, the unit in `muted`. At most three items; missing values are left out rather than shown as a dash.
- Tags on the photo, top left: the status tag (the deal type, "For sale" or "To rent") in `primary` with white text, then "New" on white, then "Featured" in `brand-accent` with `brand-deep` text. Tags are text on a solid fill, never text on the photo itself. Sponsored placements must be labelled.
- The whole card is one link, made by stretching the title link. There are no nested interactive elements inside it. On hover and keyboard focus it gains the `frame-brand` outline and a deeper shadow.
- `ListingPrice` always shows the ISO currency code, because markets and currencies are mixed across the platform.

- A listing without a photo shows a neutral frame that says "No photo yet", never a placeholder picture.
- Deal, suburb, city and price come from the API. The card has no text of its own apart from "Featured", "New" and "per month".

## ListingRail (`listings/listing-rail.tsx`)

A horizontal row of listing cards under a `SectionHeading`: "New listings", one row per deal type, and so on.

- A native scroll container with scroll snapping, so touch, trackpad and keyboard scrolling work without JavaScript. It is a focusable `region` named for its content ("New listings, scrollable").
- Cards are 280px wide on phones and 352px from `sm`; the row bleeds to the screen edge so the next card is visibly cut off.
- Two round arrow buttons under the row, from `md`, scroll it by most of its width. They are a convenience; each has an `aria-label` that names the row.
- The listings are a prop from the API. A row with no listings is not rendered.

## SearchBar (`listings/search-bar.tsx`)

The listing search on results pages: a white card with a `line` border. A GET form (`GetForm`) that works without JavaScript and produces shareable URLs.

- First row: buy or rent, category, keyword and the "Search" button. Each control has a screen-reader label. On phones it stacks to one column; from `lg` it is a single row.
- Below it, `ListingFilterPanel` holds the rest of the filters.
- **Every option list is a prop** (`options`, built on the server by `buildSearchOptions` from the API's reference data and search facets). The component contains no list of its own.
- An option shows how many listings it has for the current search: "Harare (12)". The count is in the option text, so it is read out with the option. A value with no listings shows "(0)" and stays selectable.
- Submitting returns to page 1 of the new result. With JavaScript, empty fields are left out of the address (`/listings?deal=rent&city=harare`); without it they are submitted empty and ignored.

## ListingFilterPanel (`listings/listing-filters.tsx`)

The extra filters, inside the `SearchBar` form: property type, city or town, suburb, sort order, lowest and highest price, bedrooms, bathrooms and features.

- A native `<details>` with the summary "More filters" / "Fewer filters", so it opens with a click, Enter or Space and needs no JavaScript. The summary is 44px tall and shows how many of its filters are in use. It starts open when one is in use.
- Every control has a visible label (`Field`). Property types are grouped under their category and suburbs under their city with `<optgroup>`. Choosing a category or a city narrows the next list after the form is submitted.
- Prices are number inputs, not a list of ranges, with the currency in the label and a hint giving the price range of the current search. Bathrooms is a number input because the API has no bathroom facet.
- Bedrooms lists "n+" for the bedroom counts in the result, each with the number of listings that have at least n.
- Features are checkboxes in a `fieldset` with the legend "Features": the twelve most common in the result, plus any that are ticked. Each label row is 44px tall and the whole row is the target.
- Sort order starts on the API's default (newest first, or best match when there is a keyword), which adds nothing to the address.
- Actions: "Apply filters" (submits the form) and "Clear filters" (a link to `/listings`).
- Do not add a filter the API does not support, and do not fetch options in the browser.

## Pagination (`ui/pagination.tsx`)

Page links under a list that is split across addresses (`?page=2`).

- A `nav` named for the list ("Listing results pages") containing "Previous", the first page, the current page with its neighbours, the last page, and "Next". Gaps are an ellipsis hidden from assistive technology.
- Every page is an ordinary link, so it works without JavaScript and each page can be shared, bookmarked and indexed. Page 1 links to the list's plain address, without `page=1`.
- The current page is not a link and has `aria-current="page"`. It is marked by a filled background as well as its position. Page numbers are announced as "Page 2".
- "Previous" and "Next" are greyed text with `aria-disabled` at the ends, not hidden, so the control does not move.
- Each item is at least 44 by 44px. On phones the row wraps.
- It renders nothing when there is one page. Say the page in the status line above the list as well: "18 properties · page 2 of 2".
- A page number past the last page gets the empty state "There is no page 5 of these results" with a link to page 1.

## ErrorState (`ui/error-state.tsx`)

Shown in place of content when the RightProperty365 API cannot be reached or returns an error.

- A danger `Alert` that says what could not be loaded ("We could not load the listings."), one sentence that it is our side and not theirs, and a "Try again" link.
- "Try again" is a plain link to the same address. It works without JavaScript and makes a fresh request; a failure is never cached, so it works as soon as the service is back.
- Never show old, sample or placeholder content in its place, and never an empty state ("No properties match") for a failure: empty means the search ran and found nothing.
- Use it for the main content of a page. Secondary content that fails (the "Popular searches" links) is left out instead, or replaced by one plain sentence (the market list in the footer).
- Where a page still works without the data, keep the page: the account page and the request inbox show a role or request type by its code if the labels cannot be loaded.
- The page is marked `noindex` while it shows an error state.
- `src/app/error.tsx` is the fallback for any other rendering error: the same wording with a "Try again" button and a link home.

## Empty states

A dashed `line-strong` border, a heading that says what is (not) there in plain words, one sentence on what to do next, and one secondary action.

| Situation | Heading | Action |
| --- | --- | --- |
| A search found nothing | No properties match that search | Clear filters (and suggested places when a keyword was used) |
| A page number past the end | There is no page 5 of these results | Go to page 1 |
| A filter the API no longer accepts | That search could not be run | Clear filters |
| A listing that was public and is not any more | This listing is no longer available | Browse current listings |

## Hero (`app/page.tsx`)

The top of the landing page: a wide property photograph with a white panel centred on it.

- The photograph is the cover photo of a featured listing (the newest listing when none is featured), from the API. It fills the section, is loaded eagerly with high fetch priority, and is decorative (`alt=""`). From `xl` a small white caption at the bottom right gives that listing's price, title and suburb and links to it.
- The panel (`surface`, `rounded-xl`, `shadow-lg`, 768px at most) holds a short `rule-brand`, one line that says what the site is, the page's `h1` with one phrase underlined in turquoise (`mark-brand`), one sentence, and `HeroSearch`. All text is on white, so its contrast never depends on the photo.
- On phones the panel sits low so the photo shows above it; from `md` it is centred, and from `lg` the section is at least 640px tall.
- The loading state is the same frame with the same heading and a block the height of the search, so nothing moves when the page arrives. There is no slideshow and nothing auto-plays.
- A page has at most one hero. Other pages start with a plain `h1` on white.

## HeroSearch (`listings/hero-search.tsx`)

The landing-page search, inside the hero's white panel.

- One tab per deal type (the API's labels, "For sale" and "To rent" today), centred, sits above city, suburb, property type, highest price, bedrooms and the primary "Search" button. The tabs are native radio buttons in a `fieldset`, so arrow keys switch between them and the choice is sent as the `deal` parameter.
- Like `SearchBar`, it is a GET form to `/listings` whose option lists are a prop built from the API: it works without JavaScript and produces a shareable URL.
- The selected tab is shown by text colour and a 3px indigo underline, not colour alone. Tabs are 48px tall. The focus outline is drawn on the tab label.
- Two rows of three from `lg`, two columns from `sm`, one column on phones.
- Use it once, on the landing page. Results pages use `SearchBar`.

## SectionHeading (`landing/section-heading.tsx`)

The heading of a landing-page section.

- A 48px `rule-brand`, an `h2`, an optional sentence in `muted`, and an optional link at the right ("View all", "Open the directory") in `primary-ink`, 44px tall.
- Titles name what is in the row in plain words: "New listings", "Featured homes", "Explore by city". Row titles for a deal type come from the API's labels.

## PhotoTile and PhotoTileRow (`landing/photo-tile.tsx`)

A photo with a title and a count, for places and collections: "Explore by city" on the landing page.

- The photo has a fixed 4:3 frame with `rounded-lg` and is decorative; the title and count sit under it on white (the title weight 700, the count in `muted` with tabular figures). Text is never laid over the photo.
- The whole tile is one link. On hover the photo zooms slightly and the title gets a turquoise underline.
- `PhotoTileRow` scrolls sideways with snapping below `lg` and is a four-column grid from `lg`.
- Title, count and target come from the API. A city without artwork borrows a photo from a listing there; with no photo at all the frame stays neutral.

## Stat strip (`app/page.tsx`)

A slim band under the hero with three counts from the API: properties listed, cities and towns, professionals and businesses.

- A `dl` in three equal columns divided by hairlines. The number is `ink`, weight 700, tabular; the label is `muted`.
- The numbers are rendered by the server and do not animate. Only show a count the API returns.

## Tiles (`app/page.tsx`, `app/directory/page.tsx`)

Category and directory tiles: a white card with a `line` border that links to a search or a directory.

- A category tile has an icon in a `primary-soft` square, the category and its property types, and its listing count at the right. A directory tile leads with its profile count in `primary-ink`, then the label and description.
- The whole tile is one link with the `frame-brand` outline on hover and focus. Counts carry a screen-reader unit ("13 properties").
- Chips (popular suburbs, trades, other directories) are 44px pills with a `line-strong` border; on hover they take the `primary-soft` fill and a `primary` border.

## PropertyRequestForm (`requests/property-request-form.tsx`)

The only route by which a customer contacts an advertiser. It posts to the RightProperty365 API, never to an agent directly.

- States: idle, sending, received (with reference), failed (with a message and, when present, a support reference).
- Success copy says the request was **received** and is being passed on. It must not say delivered, sent or read.
- Field errors returned by the API appear under the matching control.
- A retry of unchanged content reuses the same idempotency key; any edit starts a new request.
- Consent is an unticked checkbox that names who the details are shared with.
- The request types and contact methods are props from the API's reference data, in the API's order; the first of each is selected. The business enquiry form on a directory profile (`directory/profile-enquiry-form.tsx`) takes its contact methods the same way.

## SiteHeader (`layout/site-header.tsx`)

- White, sticky, 64px tall, with a hairline under it and the 3px logo-colour band along its top. It begins with a "Skip to content" link.
- Left to right: the logo on white (`Logo` default tone), the main navigation, then at the right the session control (`AccountMenu`) and, below `lg`, the menu button (`SiteMenu`).
- The main navigation (`layout/nav-items.ts`) shows inline from `lg`. Links are `ink`, weight 600, and take a turquoise underline on hover.
- **The bar is one row at every width and never wraps or scrolls sideways.** The logo is the one part that may shrink: 24px tall on phones, 32px from `sm`. Do not add items to the bar; add them to the navigation list, which moves into the menu on small screens.
- The header shows no market or currency. Prices carry their currency code, and the footer lists the markets.
- Without JavaScript the session control cannot load, so a plain "Sign in" link is rendered in a `noscript`.

## SiteMenu (`layout/site-menu.tsx`)

The navigation below `lg`: a 44px menu button at the right of the header that opens a panel under it.

- A native `<details>`: the `<summary>` is the button, so the menu opens and closes without JavaScript.
- The button is named "Menu", has `aria-expanded` and `aria-controls`, and shows a menu icon that becomes a close icon while open.
- The panel spans the page width under the header, white with `shadow-lg`, and scrolls if it is taller than the screen. It holds the main navigation (one column on phones, two from `sm`) and, under a hairline, the link for professionals. Links are 48px tall.
- With JavaScript: opening moves focus to the first link; Escape closes it and returns focus to the button; it also closes when a link is followed, on a click outside, and when focus leaves it.
- Its `nav` is named "Main menu"; the inline one is "Main". Only one is displayed at a time.

## SiteFooter (`layout/site-footer.tsx`)

- Light: a `soft` background with a hairline and the 3px logo-colour band along its top. No dark or indigo footer.
- Five columns from `lg`: the logo with one sentence, then "Property", "Directory" and "Account" link columns and "Markets". Two columns from `sm`, one on phones. Each link column is a `nav` named by its heading; links are 44px tall on phones.
- "Markets" lists every market with its status, which keeps the multi-country roadmap honest. It comes from the API (`layout/market-info.tsx`); if it cannot be loaded the footer says so.
- A last row holds the copyright line.

## Alert (`ui/alert.tsx`)

An inline message about the result of an action, placed next to what it describes (above a submit button, at the top of a list).

- Tones: `danger`, `warning`, `success`, `info`. The title is a full sentence in the tone colour; supporting text below it is `ink`.
- `danger` uses `role="alert"` and interrupts screen readers. The other tones use `role="status"`.
- Pass `traceId` when the API returns one so people can quote it to support. Leave it out for expected outcomes such as a wrong password.
- Not for field validation. Field errors go under the control through `Field`.

## AuthShell (`auth/auth-shell.tsx`)

The frame for sign-in, registration and account recovery: a 448px white card centred on the white page with one `h1`, an optional description, the form, and one secondary link below the card.

- One task per screen. No marketing content, no navigation beyond the single secondary link.
- Password fields use `autoComplete="current-password"` or `"new-password"` so password managers work. Never block paste.
- The password rule (10 characters minimum) is shown as a hint before submission, not only as an error after it.
- Registration and password-reset confirmations must not reveal whether an address has an account. Say "If this address can be registered…" and "If an account exists…".
- A wrong email or password gets one message that does not say which was wrong.

## RoleSelect (`auth/role-select.tsx`)

The sign-up question "How will you use RightProperty365?". People choose one or more roles; any combination is allowed.

- The roles, their groups and every label are a prop (`groups`) from the API's `account_roles` reference set, in the API's order. Today that is three groups: Looking for property, Listing or managing property, Working at an agency.
- One outer `fieldset` with the question as its `legend` and the hint "Choose all that apply", then one nested `fieldset` per group with the group's label as its `legend`.
- Native checkboxes named `roles`. Each label row is at least 44px tall and the whole row is the target. The buyer or renter role (`CONSUMER`) is ticked by default.
- At least one is required. The error ("Choose at least one option.", or the API's `roles` message) appears under the groups and is linked to the outer fieldset with `aria-describedby`.
- A role the API marks `requires_verification` says "Needs verification" in its label, and a note under the groups explains that those roles are confirmed after we verify the person or their organisation. Choosing one records a request; it grants no access by itself.
- If the roles cannot be loaded the form is replaced by an `ErrorState`: an account cannot be created without choosing a role.
- Platform administrator roles never appear here. The API also rejects them, so this list is not the safeguard.
- On the account page each chosen role is shown with a status badge: "Active" (`success`), or the status of its onboarding application ("Not submitted", "Submitted for review", "Changes requested", "Not approved"), separate from organisation memberships and staff access. A role with an application links to it, and an approved role links to its public profile when it has one.

## Administrator sign-in and landing (`admin/admin-sign-in-form.tsx`, `admin/admin-home.tsx`)

Platform administrators sign in at `/admin/sign-in`, a separate page from the customer sign-in, and land on `/admin`.

- The page uses `AuthShell` with the heading "Administrator sign in". It has no "create an account" link, no role picker and no email password reset; a line of text says to ask a super administrator.
- It is not linked from the header, footer or customer sign-in, is `noindex, nofollow`, and is not in the sitemap. Administrators are given the address.
- Every failed attempt shows the same message, "That email and password do not match.", whether the address is unknown, the password is wrong, or the account is not an administrator. The customer sign-in shows the same message for an administrator account.
- `/admin` states: loading skeleton; signed out (redirects to `/admin/sign-in`); signed in without an administrator session (the "You do not have access" state with links to the account page and customer sign-in); administrator (name, a "Verifications" card with the number of applications waiting and a link to the review queue, platform roles with their market, and an honest list of what is not built yet). `AdminGate` (`admin/admin-gate.tsx`) gives every admin page the same states.
- For an administrator session the account menu shows "Administration" in place of "Your account", and signing out returns to `/admin/sign-in`.

## AccountMenu (`auth/account-menu.tsx`)

The session control at the right of the header.

- Loading: an empty block the size of the button, so the header does not shift.
- Signed out: a primary "Sign in" button, 44px tall, at every width. From `lg` the "For professionals" link sits beside it; it leads to the landing page's section for professionals, whose button goes to registration. Below `lg` that link is in the menu panel.
- Signed in: a secondary button, 44px tall, that opens a menu with the person's email, "Your account", "Complete your profile" (while an onboarding application is not submitted or has changes requested), "Request inbox" (professional accounts only) and "Sign out". From `sm` the button shows the person's first name; on phones it is the account icon alone, with the name kept for screen readers ("Account menu for Tendai"), so the header fits a 320px screen.
- The button has `aria-expanded` and `aria-controls`. The menu closes on Escape, on an outside click, and when an item is chosen. Items are 44px tall.

## RequireAuth (`auth/require-auth.tsx`)

Wraps content that depends on the session and renders one of four states: loading skeleton, "Sign in to continue" (with a link that returns to the page), "You do not have access to this page", or the content.

- It decides what to show. It is not a security boundary: the API authorises every request.
- A feature a role cannot use is absent from navigation; this state covers people who arrive by URL.

## RequestInbox (`agent/request-inbox.tsx`)

The list of customer requests routed to the signed-in person: an agent's own listings, everything in the agency for an owner or manager, or a private seller's own listings. It is shown to organisation members and private sellers; the API decides which requests each may read.

- Two sections, each with its own `h2`, count and states: "Property requests" (about listings) and "Business enquiries" (sent from a directory profile). Private sellers see only the first, because business enquiries go to organisations.
- A directory profile never shows a phone number or email address. The enquiry form is the only way to reach a business, and the customer's details appear only in this inbox.
- Each request is a card: type and status badges, received time in the viewer's time zone, customer name and listing, the message, then contact links and the reference. The listing's title comes with the request from the API; when it does not, the card says "about a listing". Request type and contact method labels come from the API's reference data.
- States: loading skeleton, error with "Try again", empty ("No requests yet"), and the list with a count.
- Contact details appear only here, behind sign-in. They must never be put in a notification preview or a URL.

## OnboardingHub (`onboarding/onboarding-hub.tsx`)

`/onboarding`: the signed-in person's applications for listing, managing and agency roles, one card per role.

- An opening paragraph says in plain words that these roles are confirmed after RightProperty365 has checked who the person is, and that a role gives no extra access until then.
- Each card: the role's label (from the API) as an `h2`, a status badge, what is still needed in words ("Details still needed: …", "Documents still needed: …"), and one primary action.
- Status wording is exact. Use the API's `status_label` when it sends one; otherwise: "Not submitted", "Submitted for review", "Changes requested", "Approved", "Not approved". Never "Verified" before an approval. The badge always has text; tone is neutral, info, warning, success, danger in that order.
- Action by status: "Start" (an untouched draft), "Continue", "Fix and resubmit" (changes requested, with the reviewer's reason on the card), "View" (submitted or approved, a secondary button), "Apply again" (not approved, with the reason). An approved role with a public profile also gets "View your public profile".
- States: loading skeleton, signed out (`RequireAuth`), error with "Try again", and "Nothing to complete" for an account with no such role.

## OnboardingForm (`onboarding/onboarding-form.tsx`)

`/onboarding/<role>`: one application. Which details and documents it has, and which are required, come from `GET /v1/onboarding/requirements`; cities, trades and agencies come from reference data. The component holds only how each detail is labelled (`onboarding/fields.ts`); a detail it does not know falls back to a text field.

- Order: a link back to the hub, the role as `h1` with the status badge, one sentence on what an approval leads to, any notice (see below), then two cards, "Details" and "Documents", then the actions.
- Details use `Field`. Optional ones are marked "(optional)"; required ones carry `aria-required`. Lists (areas, services) are one text field with "Separate with commas".
- **Private details say so.** The phone number's hint says it is used only by the verification team and is never shown publicly; the registration number likewise. In read-only views they carry a "Private" badge.
- Actions: "Save draft" (secondary; saves the details and says "Draft saved. Nothing has been sent for review yet.") and "Submit for review" (primary; saves, then submits).
- When submitting fails, every missing detail gets its message under its control and every missing document under its row, one summary `Alert` appears above the buttons, and focus moves to the first problem. The API's "is required" is rewritten to say what to do ("Enter business name before you submit.").
- After submitting: an info `Alert` titled "Submitted for review" with the time, saying the role is not active yet and the application cannot be changed. The details and documents are then read-only.
- "Changes requested" shows the reviewer's reason in a warning `Alert` above an editable form. "Not approved" shows the reason in a danger `Alert` with "Apply again", which starts a new application with the earlier details (documents are attached again).
- "Approved" shows a success `Alert` and, when there is one, a link to the public profile.

## DocumentUploader (`onboarding/document-uploader.tsx`)

One row per document type in an application.

- The row shows the type's label and description (from the API), "(optional)" when it is not required, and a badge: "Attached", "Needed" or "Not attached". With a file: its name and size.
- Controls: "Choose a file" (primary) when nothing is attached; "Replace", "Open" and "Remove" when something is. They are real buttons, 44px tall, with the global focus outline; the native file input is hidden and driven by the button, so the control has one clear name and works with the keyboard.
- "Open" is a link to the API's authenticated file route in a new tab. The file downloads; the link's accessible name says so.
- Accepts PDF, JPEG and PNG up to 10 MB. Type and size are checked before sending as a convenience ("notes.txt is not a PDF, JPEG or PNG file…"); the API checks the content and its message is shown as it is.
- Each row uploads on its own and shows its own state: the button reads "Uploading…" and is `aria-busy`, and a `role="status"` line announces "Uploading name…" then "name was uploaded." A failure is a `role="alert"` line in the danger colour and the row gets a danger border, so the problem is not shown by colour alone.
- Files are saved as soon as they are uploaded; "Save draft" is not needed for them.
- While an application is under review or decided, a row shows only the file and "Open".

## ReviewQueue (`admin/review-queue.tsx`)

`/admin/verifications`: applications waiting for a platform administrator. Shown only to an administrator session (`AdminGate`); customers get the "You do not have access" state.

- Status tabs are links in a `nav` (Submitted for review first, the default), each with its count as text inside the link and `aria-current="page"` on the current one. The current tab is filled, not only coloured.
- A GET form filters by role (the roles come from the API) and searches applicant, email or business. Status, filters and page live in the address, so a view can be bookmarked.
- Each row is a card that is one link (the applicant's name, stretched): role and status badges, submitted time, applicant name and email, the business name or "Joining <agency>", and the number of documents. Oldest submission first, as the API returns them.
- States: loading skeleton, error with "Try again", empty ("No applications are waiting for review." or "No applications match those filters" with "Clear filters"), and `Pagination`.

## ReviewDetail (`admin/review-detail.tsx`)

`/admin/verifications/<id>`: one application for a decision.

- Header: applicant name as `h1`, role and status badges.
- "Applicant" card: name, email with "Confirmed" or "Not confirmed", account age, market, and one sentence beginning "Approving creates:" that says in plain words what an approval does (a new organisation and a verified profile in a named directory, a membership in a named agency, or nothing beyond making the role active).
- "Details" card: every detail the role has. Private ones (phone, registration number) carry a "Private" badge. A missing required detail reads "Not given (required)".
- "Documents" card: one row per document type with "Attached", "Missing" or "Not attached", the file name, size and upload time, and "Open" (the admin file route, new tab, downloads). A line says every open is recorded in the audit log.
- "History" card: an ordered list of every status change with who made it, when, and the reason.
- "Decision" card (sticky on desktop): the requirement checklist in words ("provided", "missing (required)", "not provided (optional)") with an icon as a second cue, then three buttons: "Approve" (primary), "Request changes" (secondary), "Reject" (danger). They appear only while the application is submitted.
- **Every decision has a confirmation step** in place: a panel that names the action, says what will happen, and has a labelled text area and "Confirm approval" / "Send request" / "Confirm rejection" plus "Cancel". Focus moves into the panel. The note is optional for an approval; a reason of at least 5 characters is required to request changes or reject, and it is shown to the applicant.
- After a decision: a success `Alert` ("Application approved." with what was created, and a link to the public profile when there is one).
- A 409 (already decided, or the named agency is no longer verified) shows a warning `Alert` that says so and the page reloads the application.

## Not built yet

Dialog, toast, tabs, data table, date and slot picker, file upload, map, YouTube embed. Specify each here before building it.
