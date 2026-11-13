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

## SearchBar (`listings/search-bar.tsx`)

A GET form that works without JavaScript and produces shareable URLs. Each control has a screen-reader label. On phones it stacks to one column; from `lg` it is a single row.

## HeroSearch (`listings/hero-search.tsx`)

The landing-page search, shown on the brand indigo hero.

- Buy and Rent tabs sit above a row with location, property type and the submit button. The tabs are native radio buttons in a `fieldset`, so arrow keys switch between them and the choice is sent as the `deal` parameter.
- Like `SearchBar`, it is a GET form to `/listings`: it works without JavaScript and produces a shareable URL.
- The selected tab is shown by text colour and an underline, not colour alone. The focus outline is drawn on the tab label.
- Use it once, on the landing page. Results pages use `SearchBar`.

## PropertyRequestForm (`requests/property-request-form.tsx`)

The only route by which a customer contacts an advertiser. It posts to the RightProperty365 API, never to an agent directly.

- States: idle, sending, received (with reference), failed (with a message and, when present, a support reference).
- Success copy says the request was **received** and is being passed on. It must not say delivered, sent or read.
- Field errors returned by the API appear under the matching control.
- A retry of unchanged content reuses the same idempotency key; any edit starts a new request.
- Consent is an unticked checkbox that names who the details are shared with.

## SiteHeader and SiteFooter (`layout/`)

- The header is sticky, 64px tall, and begins with a "Skip to content" link.
- Primary navigation shows inline from `md`; on phones it is a horizontally scrolling row under the header, so no menu button is needed.
- The footer lists markets with their status, which keeps the multi-country roadmap honest.

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

- One outer `fieldset` with the question as its `legend` and the hint "Choose all that apply", then one nested `fieldset` per group: Looking for property, Listing or managing property, Working at an agency.
- Native checkboxes named `roles`. Each label row is at least 44px tall and the whole row is the target. "Buyer or renter" is ticked by default.
- At least one is required. The error ("Choose at least one option.", or the API's `roles` message) appears under the groups and is linked to the outer fieldset with `aria-describedby`.
- A note under the groups says listing, managing and agency roles are confirmed after verification. Choosing one records a request; it grants no access by itself.
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

- Each request is a card: type and status badges, received time in the viewer's time zone, customer name and listing, the message, then contact links and the reference.
- States: loading skeleton, error with "Try again", empty ("No requests yet"), and the list with a count.
- Contact details appear only here, behind sign-in. They must never be put in a notification preview or a URL.

## Not built yet

Dialog, toast, tabs, pagination, data table, date and slot picker, file upload, map, YouTube embed. Specify each here before building it.
