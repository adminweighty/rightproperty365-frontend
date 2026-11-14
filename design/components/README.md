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

- Labels are a verb or verb plus noun in sentence case: "Send request", "Clear filters".
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

A `surface` with a `line` border, `rounded-lg` and `shadow-xs`. Groups related content. Do not nest cards. Pass `padded={false}` when the card holds edge-to-edge media.

## Container (`ui/container.tsx`)

The page-width wrapper. Full-width bands put the background on the outer element and a `Container` inside it.

## ListingCard (`listings/listing-card.tsx`)

The unit of search results.

- Order: media, price, title, location, facts. Price is the most prominent text.
- The whole card is one link, made by stretching the title link. There are no nested interactive elements inside it.
- Badges over the media: deal type first, "Featured" second. Sponsored placements must be labelled.
- Facts show at most three items; missing values are left out rather than shown as a dash.
- `ListingPrice` always shows the ISO currency code, because markets and currencies are mixed across the platform.

- A listing without a photo shows a neutral frame that says "No photo yet", never a placeholder picture.
- Deal, suburb, city and price come from the API. The card has no text of its own apart from "Featured", "New" and "per month".

## SearchBar (`listings/search-bar.tsx`)

The listing search on results pages. A GET form (`GetForm`) that works without JavaScript and produces shareable URLs.

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
- Use it for the main content of a page. Secondary content that fails (the "Popular searches" links, the market in the header) is left out instead, or replaced by one plain sentence (the market list in the footer).
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

## HeroSearch (`listings/hero-search.tsx`)

The landing-page search, shown on the brand indigo hero.

- One tab per deal type (the API's labels, "For sale" and "To rent" today) sits above city, suburb, property type, highest price, bedrooms and the submit button. The tabs are native radio buttons in a `fieldset`, so arrow keys switch between them and the choice is sent as the `deal` parameter.
- Like `SearchBar`, it is a GET form to `/listings` whose option lists are a prop built from the API: it works without JavaScript and produces a shareable URL.
- The selected tab is shown by text colour and an underline, not colour alone. The focus outline is drawn on the tab label.
- Two rows of three from `lg`, two columns from `sm`, one column on phones.
- Use it once, on the landing page. Results pages use `SearchBar`.

## PropertyRequestForm (`requests/property-request-form.tsx`)

The only route by which a customer contacts an advertiser. It posts to the RightProperty365 API, never to an agent directly.

- States: idle, sending, received (with reference), failed (with a message and, when present, a support reference).
- Success copy says the request was **received** and is being passed on. It must not say delivered, sent or read.
- Field errors returned by the API appear under the matching control.
- A retry of unchanged content reuses the same idempotency key; any edit starts a new request.
- Consent is an unticked checkbox that names who the details are shared with.
- The request types and contact methods are props from the API's reference data, in the API's order; the first of each is selected. The business enquiry form on a directory profile (`directory/profile-enquiry-form.tsx`) takes its contact methods the same way.

## SiteHeader and SiteFooter (`layout/`)

- The header is sticky, 64px tall, and begins with a "Skip to content" link.
- Primary navigation shows inline from `md`; on phones it is a horizontally scrolling row under the header, so no menu button is needed.
- The footer lists markets with their status, which keeps the multi-country roadmap honest. The markets, and the active market's name and currency in the header, come from the API (`layout/market-info.tsx`). If they cannot be loaded the header shows no market and the footer says the list could not be loaded.

## Alert (`ui/alert.tsx`)

An inline message about the result of an action, placed next to what it describes (above a submit button, at the top of a list).

- Tones: `danger`, `warning`, `success`, `info`. The title is a full sentence in the tone colour; supporting text below it is `ink`.
- `danger` uses `role="alert"` and interrupts screen readers. The other tones use `role="status"`.
- Pass `traceId` when the API returns one so people can quote it to support. Leave it out for expected outcomes such as a wrong password.
- Not for field validation. Field errors go under the control through `Field`.

## AuthShell (`auth/auth-shell.tsx`)

The frame for sign-in, registration and account recovery: a 448px card centred on the page with one `h1`, an optional description, the form, and one secondary link below the card.

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
- On the account page each chosen role is shown with a status badge: "Active" (`success`) or "Pending verification" (`warning`), separate from organisation memberships and staff access.

## Administrator sign-in and landing (`admin/admin-sign-in-form.tsx`, `admin/admin-home.tsx`)

Platform administrators sign in at `/admin/sign-in`, a separate page from the customer sign-in, and land on `/admin`.

- The page uses `AuthShell` with the heading "Administrator sign in". It has no "create an account" link, no role picker and no email password reset; a line of text says to ask a super administrator.
- It is not linked from the header, footer or customer sign-in, is `noindex, nofollow`, and is not in the sitemap. Administrators are given the address.
- Every failed attempt shows the same message, "That email and password do not match.", whether the address is unknown, the password is wrong, or the account is not an administrator. The customer sign-in shows the same message for an administrator account.
- `/admin` states: loading skeleton; signed out (redirects to `/admin/sign-in`); signed in without an administrator session (the "You do not have access" state with links to the account page and customer sign-in); administrator (name, platform roles with their market, and an honest "not built yet" notice).
- For an administrator session the account menu shows "Administration" in place of "Your account", and signing out returns to `/admin/sign-in`.

## AccountMenu (`auth/account-menu.tsx`)

The session control at the right of the header.

- Loading: an empty block the size of the button, so the header does not shift.
- Signed out: a small primary "Sign in" button.
- Signed in: a secondary button with the person's first name that opens a menu with their email, "Your account", "Request inbox" (professional accounts only) and "Sign out".
- The button has `aria-expanded` and `aria-controls`. The menu closes on Escape, on an outside click, and when an item is chosen.

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

## Not built yet

Dialog, toast, tabs, data table, date and slot picker, file upload, map, YouTube embed. Specify each here before building it.
