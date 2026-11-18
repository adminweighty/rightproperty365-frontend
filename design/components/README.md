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

## Field, Input, Textarea (`ui/field.tsx`)

`Field` renders the label, the control, and a hint or an error.

- Every control has a visible label. Placeholders are examples, never labels.
- Mark optional fields "(optional)" rather than marking required ones with an asterisk.
- Errors replace the hint, sit under the control, and say how to fix the problem. The control gets `aria-invalid` and `aria-describedby` pointing at the error.
- Controls are 44px tall with 16px text and a `control` border that meets 3:1.
- Use the right `type`, `autoComplete` and `inputMode` so phones show the right keyboard.
- There is no plain `Select`. Every drop-down is a `SearchableSelect`.

## SearchableSelect (`ui/searchable-select.tsx`, `lib/searchable-select.ts`)

The drop-down: a list of options from which one is chosen, that can be searched by typing. It is used for **every** drop-down, including lists of two or three options, so that all of them look and behave the same.

**When to use.** One choice from a list: a country, a property type, a status, a contact method. Not for several choices (checkboxes), not for two or three choices that should all be visible at once (radio buttons, as in the hero's "For sale" / "To rent" tabs), and not for free text with suggestions: the value is always one of the options.

**Without JavaScript** it is a native `<select>` with the same `name`, options and `<optgroup>`s, rendered by the server. Every GET form therefore submits the same address with JavaScript off, and the HTML holds every option.

**With JavaScript** the native select stays in the page as the form control, and a text field with a list is drawn over it:

- The select keeps its `name`, `required` and `disabled`, so it is what the form submits, what `FormData` reads and what the browser validates. It is invisible, takes no clicks, is out of the tab order (`tabindex="-1"`) and hidden from assistive technology (`aria-hidden`). It fills the same box as the text field, so the browser's "Please select an item" message appears on the field, and focus moves to the text field. A hidden input was not used because it cannot be `required` and would duplicate the value for visitors without JavaScript.
- Choosing an option sets the select and fires its `change` event, so a form's own `onChange` still runs. The text field has no `name` and is never submitted.
- The field's `id` moves from the select to the text field, so the `<label>` (or `Field`) names the text field. The select and the upgraded field are both 44px tall and full width: nothing moves when the page becomes interactive.

**Anatomy**

- The field: a text input with `role="combobox"`, showing the selected option's text ("Harare (6)"). At its right, a chevron; or, when the list has an "any" option (value `""`) and something else is chosen, a 44px clear button named "Clear" plus the label ("Clear Country").
- The list: a white panel with a `line-strong` border and `shadow-lg`, as wide as the field, under it, or over it when there is more room there (the on-screen keyboard, the bottom of the screen). At most 320px tall; it scrolls inside. It never makes the page scroll sideways.
- Options are at least 44px tall and wrap long text. The label is `ink`; secondary text such as a count is `muted`. The selected option is weight 600 with a tick. The active option (the one Enter will take) has a `primary-soft` fill and a 3px `primary` bar at its left, so it is not shown by colour alone.
- Group headings (`muted`, weight 600, sentence case) are not options and cannot be chosen. A heading stays while any of its options match; typing a heading's words finds its options ("commercial" finds every commercial type).
- "No matches" when nothing fits what was typed.
- Lists are rendered 100 options at a time. While more matches exist, the list ends with "Keep typing to narrow the list"; scrolling to the end or arrowing past the last option renders the next 100, and End renders them all, so every option is reachable.

**States:** default, hover (border `ink`), focus (the global outline and a `focus` border), open, invalid (`danger` border, `aria-invalid`, the error linked with `aria-describedby`), disabled (`sunken`, 60% opacity, cannot be opened), disabled option (`subtle`, skipped by the arrow keys).

**Keyboard**

| Key | Does |
| --- | --- |
| Type | Opens the list and filters it. The first match becomes active. Matching ignores case and accents, looks anywhere in the label, secondary text, keywords and group heading, and needs every word typed. |
| Down, Up | Open the list on the selected option; then move the active option. They stop at the ends. Alt+Down opens without moving. |
| Home, End | First and last option, while the list is open. |
| Enter | Chooses the active option and closes. With the list closed, submits the form, as in any text field. |
| Escape | Closes the list. Pressed again, discards what was typed and shows the selected option. |
| Tab | Moves on. It chooses the active option only if the arrow keys were used to reach it; otherwise the selection is unchanged. |

Leaving the field without choosing discards what was typed. Focus stays in the text field throughout: the active option is announced through `aria-activedescendant`.

**Pointer and touch.** A click or tap on the field opens the list and selects its text, so typing replaces it. A click on an option chooses it. The same searchable list is used on phones, by decision: the native picker is not searchable, and country and city lists are long. The text is 16px, so iOS does not zoom.

**Accessibility.** The WAI-ARIA "editable combobox with list autocomplete" pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`; the list is a `role="listbox"` named after the field's label, groups are `role="group"` named by their heading, options are `role="option"` with `aria-selected`. A polite `role="status"` says how many options match what was typed ("3 options", "No matches").

**Use**

- Give it an `id` (the one its `Field` or `<label htmlFor>` uses), a `name`, and `options`: a list of `{ value, label, secondary?, keywords?, disabled? }` and groups `{ label, options }`. `selectOption` and `selectGroups` in `lib/search-options.ts` turn the search forms' counted options into these.
- Uncontrolled with `defaultValue`, or controlled with `value` and `onValueChange`. An uncontrolled field follows `defaultValue` when it changes.
- Pass `aria-invalid` and `aria-describedby` as for any control.
- Option lists still come from the API (README, "No lists in code").
- The logic (matching, grouping, the keyboard state machine) is in `lib/searchable-select.ts` and is checked by `npm test`.

## Badge (`ui/badge.tsx`)

A short, non-interactive label. Tones: `neutral`, `primary`, `accent`, `success`, `warning`, `danger`, `info`. One or two words. A badge always includes text; an icon is optional.

## Card (`ui/card.tsx`)

A white `surface` with a `line` border, `rounded-lg` and `shadow-xs`. Groups related content. Do not nest cards. Pass `padded={false}` when the card holds edge-to-edge media.

## Container (`ui/container.tsx`)

The page-width wrapper. Full-width bands (`bg-soft` or `bg-tint` with `border-y border-line`) put the background on the outer element and a `Container` inside it.

## ListingCard (`listings/listing-card.tsx`)

The unit of search results.

- Photo-led: a 4:3 photo fills the top of the card and zooms slightly on hover.
- Order under the photo: price, title, location, then a bottom row above a hairline: the facts line on the left and **the advertiser at the far right** (`AdvertiserCompact`: logo or initials, name, the Verified mark). Price comes first and is the most prominent text (24px, weight 700).
- Where the facts and the advertiser do not fit side by side (a narrow card, a short stay's longer facts line) the advertiser drops to its own line, still at the right. A long name is cut with an ellipsis and carries the whole name as its `title`. Nothing leaves the card at 320px.
- The advertiser on a card is text and an image, never a link: the whole card stays one link.
- The facts line (`ListingFacts`) is bedrooms, bathrooms and area on one line: an indigo icon, the value in `ink` weight 600, the unit in `muted`. Missing values are left out rather than shown as a dash.
- **A short stay** leads the facts line with how many it sleeps ("Sleeps 8") and ends it with its shortest stay ("2 nights minimum") in place of the area. Its price says "per night".
- Tags on the photo, top left: the status tag (the deal type, "For sale" or "To rent") in `primary` with white text, then "New" on white, then "Featured" in `brand-accent` with `brand-deep` text, then "Video tour" (a small filled play icon, `aria-hidden`, and the words) on white when the API says `has_video`. Tags are text on a solid fill, never text on the photo itself. Sponsored placements must be labelled.
- The whole card is one link, made by stretching the title link. The one other control is the save heart (`SaveListingButton`) at the top right of the photo: a sibling of the link drawn above it, never inside it, so there are no nested interactive elements. The tags stop short of it. On hover and keyboard focus the card gains the `frame-brand` outline and a deeper shadow.
- **Impressions (API 0.30.0).** Given an `impression` (`{ placement, rank }`), the card carries `data-rp-impression`, `data-rp-listing` and `data-rp-rank` on its `article`, and `AnalyticsRoot` counts it. Nothing else changes: the card stays a server component, and the heart and the "Video tour" tag are untouched. Placements: `search` (`/listings`, ranked across pages), `rail` (`ListingRail`), `home` (the featured grid), `similar` (the listing page), `saved` (`/account/saved`). Cards on a profile have no placement in the contract and are not counted.
- `ListingPrice` always shows the listing's own ISO currency code ("GBP 185", "MUR 8,500"), because countries and currencies are mixed across the platform.

- A listing without a photo shows a neutral frame that says "No photo yet", never a placeholder picture.
- The place on a card is short: suburb and city ("Borrowdale, Harare"). The listing page adds the region, unless it has the city's name, and the country.
- **A place line is built from what the listing names** (`lib/places.ts`). The suburb and the region can be missing, and a city can be free text typed by the lister (a country with no reference places): a card without a suburb shows city and country ("Grand Baie, Mauritius"), and a listing that names no place has no place line. Never print an empty part, "null" or a doubled comma. A free-text place is plain text: it has no code, so it is never a link or a filter.
- Deal, suburb, city and price come from the API. What a rental is charged per ("per month", "per night") is the label of the API's `price_periods` set, passed in as `periods`. The card has no text of its own apart from "Featured", "New", "Sleeps" and "nights minimum".
- On results found with stay dates or guests, the link to a short stay carries them (`?check_in=…&check_out=…&guests=…`), so its request form starts from them. The listing's canonical address stays the plain one.

## Advertiser: LogoMark, VerifiedMark, AdvertiserCompact, AdvertiserBlock (`ui/logo-mark.tsx`, `listings/advertiser.tsx`)

Who advertises a listing, with the status that matters most: whether RightProperty365 has verified them. Built from the API's `advertiser.display` (the agency, company or owner) and `advertiser.agent_display` (the assigned agent).

- **LogoMark.** A fixed square box. With a logo: the image, `object-contain` on white with a hairline, `loading="lazy"`, explicit width and height, and the alt text "<name> logo". Without one, or when the image does not load: up to two initials on a soft token colour chosen from the name, so one name always has the same colour. The initials are decorative (`aria-hidden`): the name is always written beside them and must not be read twice. Businesses get a rounded square, people a circle.
- **A plain `<img>`, not `next/image`.** The file is served by the API (`GET /v1/directory/<kind>/<slug>/logo?v=…`, public, cacheable, the `v` changes with the logo). The API's origin is a build-time setting that differs per environment and is missing in CI, so it cannot be listed in `images.remotePatterns` once for every build. The address is the API's path behind the **public** API address (`NEXT_PUBLIC_API_URL`), also in HTML rendered on the server, because the visitor's browser fetches it (`logoUrl` in `lib/logos.ts`).
- **VerifiedMark.** A tick and the word "Verified" in the success colour, only when the API says `verified: true`. Otherwise the words "Not verified" in a neutral colour. Never draw the badge from anything but that flag, and never use colour or the icon without the word.
- **AdvertiserCompact** (cards; the listing page under the title on phones): logo at 32px, the name, the Verified mark under it. Screen readers hear "Advertised by <name>".
- **AdvertiserBlock** (the listing page, at the top of the side panel, above the request form): the heading "Advertised by"; the agency, company or owner with a 56px logo, the name as a link to its profile under Professionals, its title from the API ("Real Estate Agency", "Host") and the Verified mark; under it the assigned agent with their own photo or initials, name (a link), title ("Estate Agent", "Sales Agent", "Lettings Agent") and their own Verified mark; then "Verified on 14 November 2026." and the link "What does Verified mean?" to the FAQ. A direct owner is their own name with "Landlord" or "Property Seller (Vendor)" and no link, because they have no public profile.
- No phone number, email address or address, here or anywhere public. Contact is the request form.

## Trust strip and assurance lines (`app/page.tsx`, `app/listings/page.tsx`)

What the site may say about verification, with real numbers. The rule is in `design/guidelines/content-voice.md`, "What we may say about verification".

- **Landing page**, under the stat strip: a band on the soft success colour with a tick, "24 listings · all from verified agents, agencies and owners", "28 verified professionals and owners" under it, and one sentence: "Verified means we reviewed the documents of whoever advertises a property before their listings appeared. It is a check of the advertiser, not an inspection of the property." with the link "What Verified means". The numbers are the API's (`GET /v1/trust/summary`); "all" is written only when the API's two listing counts are equal, and the band is left out when the summary cannot be read.
- **Search results**, under the count: "All listings are from verified agents, agencies and owners." with the same link.
- **Listing page**: "What does Verified mean?" under the advertiser.
- Never: "verified listing", "inspected", "guaranteed", "approved property", or a count of "listings reviewed".

## Logo upload (`onboarding/document-uploader.tsx`, `auth/profile-logos.tsx`, `ui/private-image.tsx`)

A logo or profile photo is the one thing an applicant uploads that becomes public.

- **In the onboarding form** the optional "Logo or profile photo" row is a document row with three differences: a warning-toned note with an eye icon, "**This one is public.** Once your application is approved it is shown on your profile and beside your name on your listings. Your other documents stay private."; it takes images only (PNG or JPEG, up to 2 MB, 128 to 4096 pixels on each side, said under the button); and after an upload it shows the picture itself at 96px, not only a file name.
- **On the account page**, "Your public profile" lists each profile the API returns for the person (`GET /v1/me/profiles`) with its logo or initials, the Verified mark, a link to the public profile, "Upload a new logo" and "Remove logo". Removing asks first, in place ("Remove the logo of …?" with "Yes, remove it" and "Keep it"). Results are said in a live region under the buttons; a refusal is said in the API's terms ("The image must be between 128x128 and 4096x4096 pixels.", "Only the owner or a manager of this business can change its logo."). The block is absent for someone with no profile.
- A wrong file type or size is caught before anything is sent, in the same place. The API checks again by content.
- **For the reviewer** the logo document is shown as an image above its file name, because approving the application publishes it.
- `PrivateImage` shows an image that needs the session (an uploaded document): it is fetched with the cookie and shown from memory, with a line of text in its place if it cannot be read.

## ListingRail (`listings/listing-rail.tsx`)

A horizontal row of listing cards under a `SectionHeading`: "New listings", one row per deal type, and so on.

- A native scroll container with scroll snapping, so touch, trackpad and keyboard scrolling work without JavaScript. It is a focusable `region` named for its content ("New listings, scrollable").
- Cards are 280px wide on phones and 352px from `sm`; the row bleeds to the screen edge so the next card is visibly cut off.
- Two round arrow buttons under the row, from `md`, scroll it by most of its width. They are a convenience; each has an `aria-label` that names the row.
- The listings are a prop from the API. A row with no listings is not rendered.

## SearchBar (`listings/search-bar.tsx`)

The listing search on results pages: a white card with a `line` border. A GET form (`GetForm`) that works without JavaScript and produces shareable URLs.

- First row: buy or rent, category, keyword and the "Search" button. Each control has a screen-reader label. Every drop-down in the form is a `SearchableSelect`. On phones it stacks to one column; from `lg` it is a single row.
- Then a `fieldset` with the legend "Location" (`LocationFields`), always visible, and under it the advanced search panel (`ListingFilterPanel`).
- **Every option list is a prop** (`options`, built on the server by `buildSearchOptions` from the API's reference data, the countries that have listings and the search facets). The component contains no list of its own.
- An option shows how many listings it has for the current search: "Harare (12)". The count is in the option text, so it is read out with the option. A value with no listings shows "(0)" and stays selectable. Regions show a count only once a country is chosen, because the API counts regions within a country.
- Submitting returns to page 1 of the new result. With JavaScript, empty fields are left out of the address (`/listings?deal=rent&region=harare`); without it they are submitted empty and ignored.
- **A search the API refuses is not a broken page.** The form is shown again with the API's message under each control it refused ("City or town is not a city of that region.", `aria-invalid`, linked with `aria-describedby`), the panel opens if the control is inside it, and a "That search could not be run" state takes the place of the results.

## LocationFields (`listings/location-fields.tsx`)

The four location selects: Country, Region or province, City or town, Suburb. Each is a `SearchableSelect` named for the API's parameter, with a visible label.

- Countries are the ones that have listings (`GET /v1/markets?has_listings=true`, most listings first), plus the chosen one. Regions, cities and suburbs are reference sets in which each item names its country and the place it is in; they are offered for those countries only.
- **A kind of place the chosen country has no list for is not asked for.** Most countries have no reference places yet: their listings name the city as free text, which cannot be filtered by code. Choosing such a country removes the three selects and shows one line: "We have no list of regions, cities or suburbs for Mauritius yet. To narrow the search to a town or an area, type its name in the keyword box."
- **Without JavaScript** each is a native `<select>` and every option is present, grouped with `<optgroup>` under its parent (regions under their country, cities under their region, suburbs under their city). Any combination can be submitted; one that does not fit comes back with the API's message beside the control.
- **With JavaScript** the selects depend on each other: a country narrows the regions, a region narrows the cities, a city narrows the suburbs, and a choice that no longer fits is cleared. Each list can be searched by typing. The narrowing starts after the page has loaded, so the HTML always holds the full lists.
- Nothing is fetched in the browser.

## ListingFilterPanel (`listings/listing-filters.tsx`)

The advanced search, inside the `SearchBar` form.

- A native `<details id="advanced-search">` with the summary "Advanced search" / "Hide advanced search", so it opens with a click, Enter or Space and needs no JavaScript. The summary is 44px tall and shows how many of its filters are in use. It starts open when one is in use, when the API refused one, or when the address has `advanced=1` (the hero's "Advanced search" link).
- **Short stays** is a group of its own after Property: "First night" and "Day you leave" (native `type="date"` inputs named `check_in` and `check_out`) and "Guests" (`guests_min`). It is shown when the category is short stays, when no category is chosen (dates then narrow the search to short stays) and whenever one of the three is in use. The form submits them as it is without JavaScript. With it (`StayFields`), the first night cannot be before today, the day of leaving must be after it and at most 90 nights later, and each date is required once the other is set (both or neither). The API checks the same rules and its message appears under the control ("Day you leave is required with the first night."). A line under the group says that availability is the host's own calendar and that a stay is agreed with the host, not booked here.
- The other groups, each a `fieldset` whose `legend` is the heading: **Property** (property type; bedrooms, bathrooms, floor area and land area, each "at least" and "at most"), **Price** (see below), **More** (listed in the last 24 hours, 7, 14, 30 or 90 days; advertised by a Real Estate Agency or a private owner; listing reference; sort order; "Only listings with photos"), then **Features** as checkboxes.
- **Price is in one currency per search, and nothing is converted.** With a country chosen it is that country's currency, named in the labels ("Lowest price (GBP)") with the range of the result as a hint. With no country and results in several currencies, the group shows a "Currency" `SearchableSelect` (each code with its count) and the hint "Choose a currency or a country to filter by price."; the two price boxes are left out until one is chosen (they stay when they already hold a value, so a refused search can be corrected in one step). A price sent without a currency comes back from the API as a message under "Currency".
- Every control has a visible label (`Field`). Property type, "Listed", "Advertised by" and "Sort by" are `SearchableSelect`s. Ranges are two number inputs, not a list of ranges. Areas are in square metres, said in the label.
- Features are the twelve most common in the result, plus any that are ticked. Each label row is 44px tall and the whole row is the target.
- Sort order starts on the API's default (newest first, or best match when there is a keyword), which adds nothing to the address. The others are oldest first, price lowest or highest first, and largest first.
- A maximum below its minimum, or any other value the API refuses, is reported under that control in the API's words.
- Actions: "Apply filters" (submits the form) and "Clear filters" (a link to `/listings`).
- Do not add a filter the API does not support, and do not fetch options in the browser.

## Filter chips (`app/listings/page.tsx`, `lib/filter-chips.ts`)

The filters in use, above the results.

- A `nav` named "Filters in use" holding one chip per filter, in the order of the form: a 44px pill with the filter in words ("Harare", "At least 3 bedrooms", "Up to USD 300,000", "Prices in GBP", "17–20 Nov 2026 · 3 nights", "4 guests", "With photos") and a small cross.
- **Each chip is a real link** to the same search without that filter, so removing a filter works without JavaScript and can be undone with Back. Its accessible name starts "Remove filter:" ("Remove filter: Harare"); the cross is decorative.
- The two dates of a stay are one chip; removing it removes both.
- Labels come from the API's reference data or from the value itself. Sort order is not a filter and has no chip; removing a chip keeps it.
- "Clear all" at the end is a link to the search with no filters.
- The row is absent when no filter is in use.

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
- The loading state is the same frame with the same heading and a block the height of the search, so nothing moves when the page arrives. There is no slideshow and nothing loops.
- Motion (`HeroMotion`, see "Motion"): the photograph sits in a frame 8% taller than the hero at each end; the frame drifts down as the page scrolls (parallax) and eases into a 4% zoom over the first seconds. The panel rises 16px into place as the page paints. The `h1` and the photograph are never hidden or faded.
- A page has at most one hero. Other pages start with a plain `h1` on white.

## HeroSearch (`listings/hero-search.tsx`)

The landing-page search, inside the hero's white panel.

- One tab per deal type (the API's labels, "For sale" and "To rent" today), centred, sits above Location, property type, highest price, bedrooms and the primary "Search" button. Highest price is there only when every listing is priced in one currency (it is named in the placeholder); with several, price is filtered in the advanced search, where a currency is chosen.
- **Location is one `SearchableSelect`** covering every kind of place, for the countries that have listings: countries, then regions or provinces and cities and towns under their country, then suburbs under their city, each under a group heading (an `<optgroup>` without JavaScript). Typing "borrow" finds Borrowdale; typing "suburbs of harare" lists them. It is sent as `location=region:harare`, which the results page reads as that filter; the address people share from the results is the plain one (`?region=harare`).
- Under the form, an "Advanced search" link goes to `/listings?advanced=1#advanced-search`, the results page with the advanced search open. The tabs are native radio buttons in a `fieldset`, so arrow keys switch between them and the choice is sent as the `deal` parameter.
- Like `SearchBar`, it is a GET form to `/listings` whose option lists are a prop built from the API: it works without JavaScript and produces a shareable URL.
- The selected tab is shown by text colour and a 3px indigo underline, not colour alone. Tabs are 48px tall. The focus outline is drawn on the tab label.
- From `lg`: Location (two columns wide) and property type, then price, bedrooms and the button. Two columns from `sm`, one column on phones.
- Use it once, on the landing page. Results pages use `SearchBar`.

## RoleGroups (`landing/role-groups.tsx`)

"Who RightProperty365 is for" on the landing page: the roles a person can choose, so the page speaks in real estate terms.

- One white card per role group, in the API's order (today: Property Seekers, Real Estate Professionals, Real Estate Businesses, Property Owners, Other property businesses). Three columns from `lg`, two from `sm`, one on phones.
- A card has the group's label as an `h3`, then a `dl` of its roles: the role's title in `ink` weight 600 and its one-line description in `muted`. Groups, titles and descriptions are the API's `account_roles` reference set (`groupRoles` in `src/lib/roles.ts`); the component names no role.
- One action per card, at the bottom. A group whose roles need no verification links to "Browse listings". Every other group says "Verified before the role is active" (with a shield icon) and links to "Create an account". Which case applies comes from the API's `requires_verification`.
- Under the grid, one `soft` panel with the page's single "Register as a professional" button. It says what registering leads to today: verification, an active role, a public profile for roles that have one, and the request inbox. It promises nothing that is not built.
- The section has the id `for-professionals`, which the header's "For professionals" link targets. It is left out when the reference data has no roles.

## SectionHeading (`landing/section-heading.tsx`)

The heading of a landing-page section.

- A 48px `rule-brand`, an `h2`, an optional sentence in `muted`, and an optional link at the right ("View all", "All professionals") in `primary-ink`, 44px tall.
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
- The numbers are rendered by the server, and that is what is shown without JavaScript. With it, each counts up from zero once, the first time the strip is on screen (`CountUp`); its width does not change while it counts. Only show a count the API returns.

## Tiles (`app/page.tsx`, `app/directory/page.tsx`)

Category tiles and the tiles under "Find a professional": a white card with a `line` border that links to a search or to a kind of professional.

- A category tile has an icon in a `primary-soft` square, the category and its property types, and its listing count at the right. A professionals tile leads with its profile count in `primary-ink`, then the label and description.
- The whole tile is one link with the `frame-brand` outline on hover and focus. Counts carry a screen-reader unit ("13 properties").
- Chips (popular suburbs, trades, other kinds of professional) are 44px pills with a `line-strong` border; on hover they take the `primary-soft` fill and a `primary` border.

## PropertyRequestForm (`requests/property-request-form.tsx`)

The only route by which a customer contacts an advertiser. It posts to the RightProperty365 API, never to an agent directly.

- States: idle, sending, received (with reference and a "What happens next?" link to the FAQ), failed (with a message and, when present, a support reference).
- Success copy says the request was **received** and is being passed on. It must not say delivered, sent or read.
- Field errors returned by the API appear under the matching control.
- A retry of unchanged content reuses the same idempotency key; any edit starts a new request.
- Consent is an unticked checkbox that names who the details are shared with and links to the Privacy Policy (`LegalLink`).
- **On a short stay** the form starts on "Request to stay" (the API's label) and adds "First night", "Day you leave" (native date inputs) and "Guests", filled from the calendar (`StayCalendar`) or from the search the visitor came from. Under them: the stay in words, the sum "3 × USD 320 = USD 960" and "Estimate. The host confirms the final price.", then one sentence that this is not a booking, the dates are not held and no payment is taken through RightProperty365. Problems are said under the control before anything is sent (shortest stay, a taken night, too many guests); the API has the last word. If a night was taken in the meantime (409 `DATES_UNAVAILABLE`) the form says which night and the calendar is read again. The receipt repeats the stay and says in bold that **the dates are not reserved** until the host confirms. Never write "booked", "reserved" or "confirmed" about a request, and never show a pay button. Other request types stay available there; "Request to stay" is not offered on any other listing.
- The request types and contact methods are props from the API's reference data, in the API's order; the first of each is selected. Both are `SearchableSelect`s, as are the service and contact method of the business enquiry form. The business enquiry form on a directory profile (`directory/profile-enquiry-form.tsx`) takes its contact methods the same way.

## NightCalendar (`availability/night-calendar.tsx`, `lib/nights.ts`)

A month calendar of nights. One component for the visitor's availability calendar and for the lister's editor: it shows what each night is and reports which day was picked, and holds no rules of its own.

- **A night is a date, not a time**: `YYYY-MM-DD` in the time zone of the listing's country, which the surrounding text names. A stay from the 17th to the 20th is the nights of the 17th, 18th and 19th; the day of leaving is not a night. All arithmetic is in `lib/nights.ts` (pure, tested by `npm test`), done on the date itself so it never depends on the zone of the server or the browser.
- Two months side by side from `md`, one on phones. "Previous month" and "Next month" (44px, labelled) move one month and stop at the ends of the window the calendar covers. The months on show are announced politely.
- Each month is a `table` with `role="grid"` named by its month heading: weekday column headers (two letters seen, the full name read), a row header per week for assistive technology, and one `gridcell` per day with `aria-selected` and `aria-disabled`. Weeks start on Monday.
- **Keyboard**: one cell is in the tab order. Arrow keys move by a day or a week, Home and End to the ends of the week, Page Up and Page Down by a month (the page turns when the day is not on show), Enter or Space picks.
- **State is never colour alone.** A night that is not available is struck through on a grey fill; the lister also sees "Booked" (tinted, the word in the cell) and "Blocked" (hatched, the word in the cell). Today is ringed and bold. The chosen span is indigo: its two ends solid, the nights between tinted. Every cell's accessible name says it all: "Tuesday 17 November 2026, available, first night". A key under the grid explains the fills.
- Cells are 44px tall. At 320px they are about 37px wide: above the WCAG 2.2 minimum of 24px, below our 44px target, which seven columns cannot reach at that width. The form fields beside the calendar do the same job with full-size controls.
- It renders on the server, so the first months are in the HTML and readable without JavaScript. Picking and the month buttons need JavaScript; every flow that uses the calendar also has date inputs that do not depend on it.
- **Two uses.** A visitor chooses a stay (`StayCalendar`): first night, then the day of leaving; nights that cannot start or end a stay are `aria-disabled`. A lister chooses a range to change (`AvailabilityEditor`): any two nights of the booking window, with the kind written in the cell.
- Props: `first`, `last`, `today`, `kindOf(night)`, `canPick(day)`, `selected`, `ends` (what the two ends are called), `onPick(day)`, `showKinds` (write "Booked" and "Blocked" in the cells) and `legend`.

## StayCalendar (`availability/stay-calendar.tsx`)

"Availability" on a short-stay listing, under the features.

- Before the grid, in words: the shortest stay and how many it sleeps, the next available night, "Updated 14 November 2026." (or "The host has not updated the calendar yet."), and the time zone the dates are in ("Central Africa Time (Africa/Harare)"). Then: "This is the host's own calendar. … Choosing dates does not book or hold them."
- The grid is a `NightCalendar` over the booking window (today and the next year) with two kinds of night: available and not available. Why a night is not available is never public.
- Choosing a night sets the first night; choosing a later day sets the day of leaving, which may itself be taken (someone else arrives then) as long as every night before it is free. Anything else starts again. The choice fills in the request form (`StayProvider` shares it), a status line says it in words ("17–20 Nov 2026 · 3 nights chosen.") with a link to the form, and "Clear dates" undoes it.
- The calendar is read with the page (cached with the listing, so a change by the host can take a minute to show) and again in the browser when the API refuses a request because a night was taken.

## SiteHeader (`layout/site-header.tsx`)

- White, sticky, 64px tall, with a hairline under it and the 3px logo-colour band along its top. It begins with a "Skip to content" link.
- Left to right: the logo on white (`Logo` default tone), the main navigation, then at the right the session control (`AccountMenu`: "Sign in" and "Sign up" for a signed-out visitor) and, below `lg`, the menu button (`SiteMenu`).
- The main navigation (`layout/nav-items.ts`) shows inline from `lg`. Links are `ink`, weight 600, and take a turquoise underline that grows from the left on hover and keyboard focus (`link-sweep`).
- Once the page has been scrolled the bar gains `shadow-md` and the logo is drawn at 90%. The bar stays 64px tall, so nothing under it moves.
- **The bar is one row at every width and never wraps or scrolls sideways.** The logo is the one part that may shrink: 24px tall on phones, 32px from `sm`. Do not add items to the bar; add them to the navigation list, which moves into the menu on small screens.
- The header shows no market or currency. Prices carry their currency code, and the footer lists the markets.
- Without JavaScript the session control cannot load, so plain "Sign in" and "Sign up" links are rendered in a `noscript`.

## SiteMenu (`layout/site-menu.tsx`)

The navigation below `lg`: a 44px menu button at the right of the header that opens a panel under it.

- A native `<details>`: the `<summary>` is the button, so the menu opens and closes without JavaScript.
- The button is named "Menu", has `aria-expanded` and `aria-controls`, and shows a menu icon that becomes a close icon while open.
- The panel spans the page width under the header, white with `shadow-lg`, and scrolls if it is taller than the screen. It holds the main navigation (one column on phones, two from `sm`) and, under a hairline, the link for professionals. Links are 48px tall.
- For a signed-out visitor the panel ends, under another hairline, with "Sign in" (secondary) and "Sign up" (primary) as 48px buttons, side by side from `sm`. On phones this is where "Sign up" lives, because the bar has no room for it.
- With JavaScript: opening moves focus to the first link; Escape closes it and returns focus to the button; it also closes when a link is followed, on a click outside, and when focus leaves it.
- Its `nav` is named "Main menu"; the inline one is "Main". Only one is displayed at a time.

## SiteFooter (`layout/site-footer.tsx`)

- Light: a `soft` background with a hairline and the 3px logo-colour band along its top. No dark or indigo footer.
- Five columns from `lg`: the logo with one sentence, then "Property", "Professionals" and "Account" link columns and "Countries with listings". Two columns from `sm`, one on phones. Each link column is a `nav` named by its heading; links are 44px tall on phones.
- "Professionals" lists every kind the API returns, by its label (Real Estate Agencies, Estate Agents, Solicitors and so on), then "Find a professional". If they cannot be loaded it shows that one link.
- "Countries with listings" links the six countries with the most listings to their result pages (`/listings?country=GB`), then "All countries". The API knows every country (249); the footer names only those with something to show. If they cannot be loaded it shows that one link.
- Under the columns, a row of its own headed "Get the app": the three app-store links (`AppLinks`), side by side from `sm` and stacked at full width on phones.
- Under the columns, a row of links in a `nav` named "Help and legal": Frequently asked questions, then Privacy Policy, "How we count views" (`/analytics-definitions`), Terms and Conditions, Refund Policy, End User Licence Agreement, from `src/lib/legal.ts`. One per line and 44px tall on phones; one wrapping row from `sm`.
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
- The card rises 16px into place as the page paints (`enter-rise`). It is a CSS transform: the form is never hidden and can be typed in from the first moment. Nothing inside the form is animated.
- Password fields use `autoComplete="current-password"` or `"new-password"` so password managers work. Never block paste.
- The password rule (10 characters minimum) is shown as a hint before submission, not only as an error after it.
- Registration and password-reset confirmations must not reveal whether an address has an account. Say "If this address can be registered…" and "If an account exists…".
- A wrong email or password gets one message that does not say which was wrong.

## RoleSelect (`auth/role-select.tsx`)

The sign-up question "How will you use RightProperty365?". An account is either for a Property Seeker (Prospective Buyer, Prospective Tenant or both) or for roles from the other groups (any mix of those), never both. The API enforces the same rule.

- The roles, their groups, their titles and their one-line descriptions are a prop (`groups`) from the API's `account_roles` reference set, in the API's order. Today that is five groups: Property Seekers, Real Estate Professionals, Real Estate Businesses, Property Owners, Other property businesses.
- Each row is the role's title (weight 500) with its description under it in `muted` 14px. Role names are titles, as the API sends them (content and voice, "Role names").
- One outer `fieldset` with the question as its `legend` and a hint that states the rule: "Choose one. An account is either for finding a property or for property work, not both."
- The question is asked in two steps, so a combination the rule forbids cannot be made. First two radio buttons: "I am looking for a property" and "I work in property, or I own property to sell or let". Under the chosen one are its checkboxes: the Property Seekers roles, or one nested `fieldset` per other group with the group's label as its `legend` and "Choose all that apply". The group with the code `PROPERTY_SEEKERS` is the first kind; every other group is the second.
- The checkboxes of the kind not chosen are hidden and disabled, so they are not sent. They keep their ticks if the person switches back. Nothing is unticked behind the person's back, and nothing is shown disabled without a reason.
- If the API returns only one of the two kinds there are no radio buttons: the groups are listed with the hint "Choose all that apply".
- Native checkboxes named `roles`. Each label row is at least 44px tall and the whole row is the target. "I am looking for a property" is chosen and the Prospective Buyer role (`CONSUMER`) is ticked by default.
- At least one is required. The error ("Choose at least one option.", or the API's `roles` message) appears under the groups and is linked to the outer fieldset with `aria-describedby`.
- A role the API marks `requires_verification` says "Needs verification" beside its title (on its own line on phones), and a note under the groups explains that those roles are confirmed after we verify the person or their organisation. Choosing one records a request; it grants no access by itself.
- If the roles cannot be loaded the form is replaced by an `ErrorState`: an account cannot be created without choosing a role.
- Platform administrator roles never appear here. The API also rejects them, so this list is not the safeguard.
- On the account page each chosen role is shown with a status badge: "Active" (`success`), or the status of its onboarding application in the API's words ("Pending Verification", "Under Review", "Changes Requested", "Rejected"), separate from organisation memberships and staff access. A role with an application links to it, and an approved role links to its public profile when it has one.
- A membership shows the organisation's name, its kind from the `organisation_kinds` reference set ("Law Firm", "Real Estate Agency") and the membership's `role_label` from the API as a badge ("Principal", "Agency Principal"). Staff access shows the platform role's title ("Super Administrator").

## Validation on the account forms (`lib/auth-validation.ts`, `auth/use-field-errors.ts`)

Sign-up, sign-in, administrator sign-in, "forgot password" and "reset password" check what was typed before anything is sent.

- The forms are `noValidate`: the browser's own bubbles are off, so every message looks the same and sits under its field through `Field`.
- On submit, every problem is shown at once and focus moves to the first invalid field, whose `aria-describedby` points at its message. Changing a field clears its message.
- The rules repeat the API's: full name required, 120 characters at most; an email address that looks like one; a new password of 10 to 128 characters (sign-in asks only that a password was typed); at least one role and the role rule; consent ticked; the captcha answered in digits.
- The API stays the authority. Its `fields` errors are shown in the same places, the same way. A failure with no field this form has is an `Alert` above the button.
- The rules are pure functions, tested by `scripts/auth-validation.test.mjs`.

## Captcha (`auth/captcha.tsx`)

The site's own check against automated sign-ups on the create-account form: a sum to answer. Not a third-party service; nothing is loaded from elsewhere.

- The question comes from `GET /v1/auth/captcha`, asked from the browser when the form appears and never cached. It can be answered once and lasts ten minutes. The answer is sent with the registration as `captcha: { captcha_id, answer }`.
- The question is the label ("What is 7 + 5?") of a short text input with `inputMode="numeric"` and `autoComplete="off"`, beside a secondary "New question" button. The hint under it: "This quick question helps us keep automated sign-ups out."
- A new question replaces the old one when the person asks, when the old one runs out of time, and after every failed attempt to create the account. The answer is cleared whenever the question changes, and a polite live region reads the new question (and says so visibly when the old one ran out of time).
- A wrong or expired answer comes back from the API as the `captcha` field error and is shown under the input.
- If the question cannot be loaded: a danger `Alert` with "Try again" replaces the input, a line under "Create account" says the account can be created once the question has loaded, and pressing "Create account" explains the same and moves focus to "Try again".

## Administrator sign-in and landing (`admin/admin-sign-in-form.tsx`, `admin/admin-home.tsx`)

Platform administrators sign in at `/admin/sign-in`, a separate page from the customer sign-in, and land on `/admin` (or on the `/admin` page in `?next=`, which `AdminGate` adds when it sends a signed-out visitor to sign in). Sign-in has a second step, the emailed code (see "Sign-in code step").

- The page uses `AuthShell` with the heading "Administrator sign in". It has no "create an account" link, no role picker and no email password reset; a line of text says to ask a super administrator.
- It is not linked from the header, footer or customer sign-in, is `noindex, nofollow`, and is not in the sitemap. Administrators are given the address.
- Every failed attempt shows the same message, "That email and password do not match.", whether the address is unknown, the password is wrong, or the account is not an administrator. The customer sign-in shows the same message for an administrator account.
- `/admin` states: loading skeleton; signed out (redirects to `/admin/sign-in`); signed in without an administrator session (the "You do not have access" state, which says the area is for Platform Administrators, with links to the dashboard and the main sign-in); administrator (the overview, see "Admin overview"). `AdminGate` (`admin/admin-gate.tsx`) gives every admin page the same states.
- For an administrator session the account menu shows "Dashboard" (to `/admin`) and "Verifications" in place of the customer items, and signing out returns to `/admin/sign-in`.

## Sign-in code step (`auth/sign-in-code-step.tsx`, `lib/sign-in-code.ts`)

The second step of both sign-in forms. A correct email and password are answered with `CODE_REQUIRED` and a code is emailed; no session exists until the code is accepted.

- The step replaces the email and password fields inside the same card: an `h2` "Check your email", "We sent a code to u•••@example.com", one field "Code from the email" (`inputMode="numeric"`, `autoComplete="one-time-code"`, monospace), the time the code works until as its hint, and "Sign in". Focus moves to the field when the step opens.
- 4 to 6 digits are accepted (spaces and dashes are removed), not exactly `code_length`, because the test site also takes a 4-digit demo code. On the test site only (`env.testSite`) a line under the field says "Test site: you can use the demo code 1234."
- A wrong code shows the API's `fields.code` message under the field and selects what was typed. An expired code (`CODE_EXPIRED`) returns to the first step with a warning to sign in again; the email is kept and focused. Once `expires_at` has passed, a warning says so in place.
- "Send a new code" waits 30 seconds, or the 429 answer's Retry-After, with "Available in 0:27" beside it; the button stays focusable (`aria-disabled`). A new code is announced in a polite live region.
- "Use a different account" returns to the first step with focus on the email field.
- An API without the code step answers the first step with the session itself; that is a successful sign-in.
- After sign-in: `?next=` when it is a path on this site (`safeNextPath` in `lib/portal.ts`; an administrator only to `/admin` pages), else `/dashboard`, or `/admin` for an administrator.

## Dashboard (`dashboard/dashboard-home.tsx`, `/dashboard`)

Every signed-in customer-scope account lands here. Everything comes from `GET /v1/me/dashboard`; the page works out no role rules itself.

- Order: "Dashboard" eyebrow, `h1` "Hello, <first name>", one line for the kind of dashboard, the person's roles as badges, then "What needs your attention": the API's next actions as large cards with their count, each a link (an onboarding action opens that role's application). Nothing waiting: one quiet sentence.
- **Seeker**: a "Find a property" search (`/listings?q=`), requests by status, latest requests (empty state "You have not sent a request yet" with "Find a property"), next appointments.
- **Professional, not yet verified**: "Your applications", one card per role: status badge (the API's `status_label`), what is still needed in numbers, the reviewer's reason, the next step in words, and the action ("Continue your application", "Fix and resubmit", "View your application", "Apply again").
- **Verified professional and direct owner**: counters by group as tiles (property requests, requests by stage as an eight-step pipeline, business enquiries, appointments received, listings including short stays whose calendar needs updating), latest five requests, next five appointments, and "Your workspace" (role at each organisation, links to the inbox, appointments, listings, team when `sees_team`, account).
- A counter or action whose target has no page on this site is plain text, never a link. Targets map to pages in `TARGET_PATHS` (`lib/portal.ts`); a counter for one stage or status opens the list filtered to it.
- An administrator session is sent to `/admin`. Tiles and action cards enter with `Stagger` and numbers count up; nothing moves with reduced motion.

## Signed-in lists and details (`portal/portal-ui.tsx`, `portal/use-api.ts`)

- `StatTile`: a number and its label, a link when it has a page. `ChipNav`: filter links with counts, the current one filled and `aria-current`. `EmptyState`, `LoadingBlock`, `LoadError` (403 is the "no access" state), `BackLink`.
- **`/account/requests`** and **`/account/requests/<id>`**: the person's own requests, status chips with counts, one line on what each status means, paging; the detail shows the message, stay and preferred time, and the status history. Never the lead stage, notes or who handles it.
- **`/account/saved`**: see `SavedListings`.
- **`/agent/requests`**: stage chips with counts (`stage_counts`), a filter form (search, type, received from and until; a GET form that works without JavaScript), a count in a status region, request cards that link to the detail, `Pagination`. Business enquiries follow at `#business-enquiries`.
- **`/agent/requests/<id>`**: the customer's message, stay and preferred time; contact links; "Stage" with only the API's `allowed_stages` as radio buttons and "Move the request"; "History"; "Notes", marked "Only your team can see notes. The customer never does." A 409 explains that someone else moved it, and the request is read again.
- **`/agent/team`**: read-only members of each organisation the person owns or manages: name, role, market and status. No invite or remove controls until the API has them.

## Admin overview (`admin/admin-home.tsx`, `/admin`) and routing exceptions (`admin/routing-exceptions.tsx`)

- `/admin` shows what needs attention (applications waiting, listings waiting for review, requests nobody could receive), then only the sections `GET /v1/admin/overview` returns for the person's roles: Verifications (counts by status, linking to the queue), Accounts (counts, roles table, newest sign-ups), Listings (by status, linking to the listing reviews), Property requests (counts, by stage, routing exceptions). A role with no section is told so. Roles and "Not built yet" follow.
- `/admin/routing-exceptions`: "Still open", "Dealt with" and "All" as chips, the customer's details so the request can be passed on by hand, and "Mark as dealt with", which opens a note field in place with "Keep it open" to back out. A 409 says another administrator already did it and reloads.

## TestSiteBanner (`layout/test-site-banner.tsx`)

A disclaimer across the top of every page on a test copy of the site (staging). It renders nothing on the live site.

- Shown when the site's address starts with `staging.`, or when the build sets `NEXT_PUBLIC_TEST_SITE=1` (`0` forces it off). The same rule adds an `X-Robots-Tag: noindex, nofollow` header to every response, so a test site never appears in search results.
- A full-width `warning-soft` band above the header, with an icon, the words "This is a test site." in the `warning` colour and the rest in `ink`. It scrolls away with the page; the header stays sticky.
- No dismiss button. The notice has to stay true for everyone on every page, including someone arriving from a link in an email.
- The copy says what is not real (the properties, businesses and accounts), what does not happen (enquiries and bookings do not reach real agents or owners) and what not to do (enter real personal or payment details). Keep it to three short sentences.
- It is an `aside` with the label "Test site notice", so screen reader users can find or skip it.

## AccountMenu (`auth/account-menu.tsx`)

The session control at the right of the header.

- Loading: an empty block the size of the button, so the header does not shift.
- Signed out: "Sign in" as a ghost button at every width and, from `sm`, the primary "Sign up" button to its right, which goes to `/register`. Both are 44px tall. On phones the bar has no room for "Sign up"; it is in the menu panel with "Sign in".
- From `xl` the "For professionals" link sits before them; it leads to the landing page's section for professionals, whose button goes to registration. Below `lg` that link is in the menu panel. Between `lg` and `xl` the bar has no room for it beside the navigation and the two buttons.
- Signed in: a secondary button, 44px tall, that opens a menu with the person's email, "Dashboard" (always first), "Your account", "Complete your profile" (while an onboarding application is not submitted or has changes requested), "Your requests", "Your appointments", "Saved properties", "Request inbox", "Appointments received" and "Your listings" (professional accounts and owners only), "Contacts" (organisation members) and "Sign out". From `sm` the button shows the person's first name; on phones it is the account icon alone, with the name kept for screen readers ("Account menu for Tendai"), so the header fits a 320px screen.
- The button has `aria-expanded` and `aria-controls`. The menu closes on Escape, on an outside click, and when an item is chosen. Items are 44px tall.

## RequireAuth (`auth/require-auth.tsx`)

Wraps content that depends on the session and renders one of four states: loading skeleton, "Sign in to continue" (with a link that returns to the page), "You do not have access to this page", or the content.

- It decides what to show. It is not a security boundary: the API authorises every request.
- A feature a role cannot use is absent from navigation; this state covers people who arrive by URL.

## RequestInbox (`agent/request-inbox.tsx`)

The list of customer requests routed to the signed-in person: an Estate Agent's own listings, everything in the organisation for its principal or a manager, or an individual owner's own listings. It is shown to organisation members (a Real Estate Agency, a Law Firm and so on), Landlords and Property Sellers (Vendors) (`canUseInbox`); the API decides which requests each may read.

- Two sections, each with its own `h2`, count and states: "Property requests" (about listings) and "Business enquiries" (sent from a public profile). Landlords and Property Sellers (Vendors) see only the first, because business enquiries go to organisations.
- A public profile never shows a phone number or email address. The enquiry form is the only way to reach a business, and the customer's details appear only in this inbox.
- Each request is a card: type and status badges, received time in the viewer's time zone, customer name (a link to the request's own page) and listing, the stage, the first three lines of the message, then "Open the request" and the reference. Contact details are on the request's page. Business enquiries keep their contact links on the card. The listing's title comes with the request from the API; when it does not, the card says "about a listing". Request type and contact method labels come from the API's reference data.
- A request to stay shows its stay above the message: "Asks to stay 8–11 Dec 2026 · 3 nights · 3 guests". It is a request: the nights are not blocked until the lister marks them in the availability calendar.
- States: loading skeleton, error with "Try again", empty ("No requests yet"), and the list with a count.
- Contact details appear only here, behind sign-in. They must never be put in a notification preview or a URL.

## Listing manager (`agent/listing-manager.tsx`, `/agent/listings`)

The advertiser's listings (API 0.22.0): everything the signed-in person or their organisation manages, from `GET /v1/me/listings`, whatever its status. Linked as "Your listings" from the account menu, the account page, the request inbox and the dashboard. Not indexed. Rules that are not the API's (status words and tones, tabs, which buttons `actions` become, banners) are pure functions in `lib/listing-manage.ts`, checked by `npm test`.

- `h1` "Your listings", one paragraph on review (a draft is private; submitting sends it to our review team; changes to a public listing are reviewed too while visitors keep the approved version) and, when the dashboard says `manages_listings`, the primary "Add a listing".
- **Status tabs** (`ChipNav`): All, Draft, Changes requested, Waiting for review, Published, Archived always, and any other status that has listings, each with its count as text in the link. The tab and the page are in the address (`?status=CHANGES_REQUESTED&page=2`), so the dashboard's counters and its "listings need changes" action open the right tab. The counts are of the listings read (up to 240; the status line says when there are more).
- **Each row** is a card: the cover photo (`small` size) or "No photo yet"; the status badge in words (the API's `status_label`) and, for a published listing with `pending_changes`, a second badge ("Changes waiting for review", "Changes requested", "Changes not approved", "Changes not sent yet"); category and type; the title, a link to the editor; place, reference and "7 of 20 photos"; the price or "No price yet"; how many things are still needed. Then the actions: "Edit" (or "View" without `edit`), the API's `actions` as buttons (submit only once the listing is complete), "See it as visitors do" while published, and "Manage availability" for a short stay. Every action's accessible name ends with the listing's title.
- A row is read in full (`GET /v1/me/listings/{id}`, four at a time, 12 rows a page) for its actions, pending changes and photo, because the list summary has none of them.
- Archive, relist and delete ask first (`ConfirmDialog`); the result is announced in a polite live region and the list is read again.
- States: loading skeleton; error with "Try again"; empty per tab; "There is no page 5"; the "You do not have access to this page" state when the API answers 403; signed out, the sign-in prompt.

## New listing (`agent/new-listing.tsx`, `/agent/listings/new`)

- One short form: "Who is this listing for?" (a `SearchableSelect`, only when the person lists for several organisations or also as a direct owner; the organisations come from the dashboard's `can_manage_listings`), "Country" (every country, found by name or ISO code; starts on the organisation's market) and an optional title. "Start the listing" creates the draft (`POST /v1/me/listings`) and opens the editor.
- Nobody who may not create listings sees a form: "You cannot add listings yet" says who can.

## ListingEditor (`agent/listing-editor.tsx`, `/agent/listings/<id>`)

- Order: back link; status badges and reference; the title as `h1`; "See it as visitors do" while public; the banner for the status; then two columns from `lg`: the sections, and a sticky side panel ("Saving", "Still needed" or "Ready to submit", "Actions"). On phones the panel comes first.
- **Sections:** Basics (category, property type limited to the category, for sale or to rent, title, summary, description), Price (amount, currency, what it is charged per), Location, Details (bedrooms, bathrooms, floor and land area, features as 44px checkbox rows), Short stay (guests at most, shortest stay, a link to the calendar; only for the short-stay category), Photos (`PhotoManager`), Video tour, History. Every drop-down is a `SearchableSelect` fed by the API's reference data (`lib/api/server/listing-editor.ts`).
- **Location follows the search's rules.** Where the country has reference places: "Region or province" (optional, it only narrows the cities and is not saved), "City or town" and "Suburb" as selects, each narrowing the next. Where it has none: "City or town" and "Region or province" as text (80 characters), with a line that says so. A new country clears the places and, while no price is typed, sets the country's currency, as the API does. A published listing's country cannot change.
- **Saving is automatic.** A choice is saved at once; typing is saved a moment after it stops and when the field is left (`PATCH` with only the changed fields). One save at a time; edits made meanwhile follow it. The "Saving" panel is a polite live region: "Saving…", "Changes not saved yet…", "All changes saved. Saved at 14:02.", or what went wrong with "Try saving again". Leaving the page with unsaved changes asks first (`beforeunload`); moving to another page of the site saves what is left. Values the API derives (a short stay is to rent, per night) are shown after the save.
- A value that cannot be sent (a price with three decimals, 51 bedrooms) is said under its field and not sent; the API's own field errors appear the same way.
- **"Still needed"** lists `completeness.missing` in the API's words; each item is a button that moves focus to its control (to the first undescribed photo for a missing description).
- **Actions** come from the API's `actions`: "Submit for review" (or "Send changes for review"), disabled with the reason until the listing is complete; "Relist", "Archive" and "Delete", each behind a `ConfirmDialog`. A refused submit (`LISTING_INCOMPLETE`) marks each missing field and moves focus to the first.
- **Banners:** waiting for review ("We are reviewing this listing", nothing can be changed); changes requested and rejected, with the reviewer's reason in a quoted block; published (with or without pending changes); expired and archived. A colleague's listing (`can_edit: false`) says who looks after it, and every control is disabled.
- **Someone else saved at the same moment** (`409 LISTING_CHANGED`): a warning says the latest version was loaded and the last change must be made again; focus moves to it. A listing that went into review meanwhile is read again and becomes read-only.
- **Location on the map** (API 0.29.0, optional), after Location: a `LocationPicker` (only when `env.map` is set; otherwise a line says to type the position), then "Latitude" and "Longitude" (optional; decimal degrees, up to 6 decimals, `inputMode="decimal"`), the accessible alternative to the map and kept in sync with it both ways. The two boxes are one value: a change to either saves both a moment after typing stops, and the map's click, drag or "Use this position" saves at once (rounded to 6 decimals). One box without the other, a value out of range, more than 6 decimals and (0, 0) are said under the box and not sent; the API's field errors on `latitude` and `longitude` appear the same way. "Show only the approximate area publicly" (a 44px checkbox row) saves `location_precision` APPROXIMATE, with a line saying visitors see an area about 1 km across and never the exact position. "Remove the pin" (when there is one) clears both and returns focus to "Latitude". On a listing that was published, the line in the video's wording: adding, changing or removing the pin of a public listing is reviewed before visitors see it.
- **Video tour** (API 0.28.0): "YouTube video tour" (optional), a `type="url"` box saved like the other text boxes, with a hint naming the accepted links (youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…, /embed/…; a `t=` start time is kept; playlists and channels are not accepted). The API parses the link; its field error on `youtube_url` ("must be a link to a YouTube video") is shown under the box. After a save the box shows the canonical watch address the API sends back. Once `youtube_video_id` is saved, a preview: YouTube's poster ("The poster could not be shown…" for a missing or placeholder one), "Starts at 1:05" and "Watch on YouTube" (new tab). "Remove the video" clears it and returns focus to the box. On a listing that was published, a line says that adding, changing or removing the video is reviewed before visitors see it, like any other change.

## PhotoManager (`agent/photo-manager.tsx`, `lib/listing-photos.ts`)

- "7 of 20 photos", the rules (JPEG, PNG or WebP, up to 15 MB, at least 800 pixels on the longer side) and a drop area with "Choose photos" (a real button over a hidden file input; several files at once). At 20 the button is disabled and the area says "A property can have up to 20 photos. Delete one to add another."
- Files are checked before anything is sent (type, size, and the pixel size when the browser can read it), and files beyond the limit are refused in place. The rest upload **one by one**, each with a row: its name, "Waiting", "Uploading… 45%" with a progress bar, "Added", or "Not added" and the reason in the danger colour with a danger border. A polite live region says each start and result. The API checks everything again and its message is what is shown.
- Each photo is a card in an ordered list: the `small` image, its number, "Cover photo" on the first, "Waiting for review" on a photo that is not public yet, "Description needed" while it has no alt text. "Description of photo 3" is saved when the field is left or Enter is pressed; without one the field says "Describe this photo before you submit the listing." in the danger colour.
- **Order without a mouse:** "Up", "Down" and "Make cover" (named "Move photo 3 up" and so on); focus stays on the photo that moved and its new place is announced. With a mouse a photo can also be dragged onto another. The order is saved at once (`PUT …/photos/order`) and goes back if it is refused.
- "Delete" asks first, with the photo shown, and says when it also leaves the public listing. The last public photo of a published listing cannot be deleted (the API's message says so).

## ListingPhotoImage (`agent/listing-photo-image.tsx`)

A listing photo as its managers and reviewers see it. Approved photos of a public listing are plain `<img>` elements (public and cached for a year). A photo that is not public is only served with the session, whose cookie belongs to the API's origin: an `<img>` on this site sends it only when the two are the same site, which is not true of every deployment. So such a photo is fetched with `credentials: "include"` and shown from an object URL, released when it leaves the page; "The photo could not be shown." takes its place on failure.

## ConfirmDialog (`ui/confirm-dialog.tsx`)

The confirmation before an action that removes something, takes it offline or is final: a native `<dialog>` opened with `showModal()`, so focus stays inside, the page behind is inert, Escape closes it and focus returns to the button that opened it. Focus starts on "Cancel". A title, one or two sentences on what will happen, an optional field (a reviewer's reason), the API's message on failure, then "Cancel" and the action ("Yes, delete it"), which says what is happening while it runs.

## Listing reviews (`admin/listing-queue.tsx`, `admin/listing-review.tsx`, `/admin/listings`)

- **Queue:** a GET form (status, "New listings" or "Changes to public listings", country, title or reference), oldest submission first, 20 a page. Each row is one link: "New listing" or "Changes to a public listing", the status, the country, when it was submitted, the proposed title, the reference, the advertiser with "Verified" or "Not verified", and the photos ("5 photos, 2 waiting for review"). Linked from the admin overview's Listings section (its status tiles open the queue filtered) and "What needs your attention", and as "Listing reviews" in the administrator's account menu.
- **Review page:** the title, kind and status; for changes to a public listing, "What changes": a table of each field with "Public now" and "Proposed" in words (codes become labels), the number of new photos and changed descriptions, and the new photos; when the video changed, "Video tour" with the public and the proposed video side by side (poster, id, start time, "Watch on YouTube" in a new tab, or "No video"); when the pin changed, "Location on the map" with the public and the proposed pin side by side (coordinates to 6 decimals, "Exact pin" or "Approximate area (about 1 km)", "Check it on OpenStreetMap" in a new tab, or "Not on the map"), and the table names latitude, longitude and "Shown on the map as"; then "How it will look" (photos, price, title, place, where it is on the map or "Not on the map", facts, description, features, the video's poster, every photo's description); then the history. Nothing plays on the review page.
- **Decision** (sticky on desktop): only the API's `decisions`. "Approve" says what happens (published for 90 days, or the changes become public) and asks to confirm. "Request changes" and "Reject" open the dialog with a required "Reason" (1 to 1000 characters, shown to the advertiser and emailed). After a decision a success message says what happened; a 409 says it was already decided and the listing is read again.

## AvailabilityEditor (`agent/availability-editor.tsx`, `/agent/listings/<id>/availability`)

Where a lister keeps the calendar of one short stay. Not indexed.

- Order: a link back to "Your listings"; `h1` "Availability" with the listing's title and reference; the time zone the dates are in and the booking window (today and the next 365 days); a panel that says **reasons and notes are private**, that visitors only see available or not, and that **a request to stay does not block any nights** (the lister marks them booked here); the "Calendar" card; "Nights that are not available"; "Stay rules".
- **Calendar card.** A `NightCalendar` whose cells say "Booked" or "Blocked" (tinted with the word, hatched with the word) and nothing for an available night. Choosing a night starts a range and choosing a second ends it, in either order; choosing again starts a new one. Under the grid, **"Change nights" is an ordinary form** that does the same without the grid: "First night" and "Last night" (native date inputs limited to the booking window; the grid fills them in), "What to do with these nights" (a `SearchableSelect`: Mark as booked, Block, Make available) and "Private note" (optional, 200 characters, switched off for Make available because the API keeps no note for an available night). The submit button carries the chosen action as its label. Everything can be done with a keyboard and a screen reader through this form alone.
- **Saving** sends only that one change (`PUT …/availability`). The API answers with the calendar as it now is, and that answer is what is shown: nothing is assumed before it arrives. Success: a success `Alert` "Saved. 20–23 Dec 2026 blocked." and the form is cleared. Failure: the API's message for each field under its control (`changes[0].to` is the "Last night" control) and a danger `Alert` with the support reference. Dates outside the booking window or the wrong way round are caught before sending, in the same words under the control.
- **"Nights that are not available"** lists every stored range: its dates, the number of nights, a "Booked" or "Blocked" badge, the private note, and "Make available", whose accessible name includes the dates. Blocking part of a booked range splits it, as the API does. Empty: "Every night in the booking window is available."
- **"Stay rules"**: "Shortest stay, in nights" (1 to 365) and "Guests, at most" (1 to 50), saved with `PATCH …/stay-rules`; only what changed is sent. The API's message appears under the field.
- A closing line says a change can take up to a minute to show on the public listing.
- States: loading skeleton; error with "Try again"; "We could not find that listing" (unknown, or not one the caller manages); "This listing has no availability calendar" (not a short stay); no access; signed out.
- Never call a night "reserved" or a request "confirmed" here: the product takes no bookings. "Booked" is the lister's own word for a night they have agreed with a guest.

## Appointments (`appointments/appointment-card.tsx`, `appointments/appointment-lists.tsx`)

Viewings and consultations. The mobile app is the main place for them; the web pages are simple but complete enough to act on, because the API's emails link to them.

- **`/account/appointments`** (anyone signed in): "Upcoming" and "Past" as two links (`?when=past`), the current one filled and marked `aria-current`. **`/agent/appointments`** (professionals): a filter row (status and type, each a `SearchableSelect`, and from and to dates) above the list. The API decides who may read the professional list: a 403 shows the "You do not have access" state with a link to the person's own appointments.
- **AppointmentCard**: type and status badges (the API's `status_label`: Requested, Confirmed, Reschedule Requested, Completed, No Show, Cancelled) and the reference; the date and time as the card's heading; the listing (linked) and the professional's public profile (linked); where to meet; the customer's note; the reason when cancelled.
- **Times are shown in the appointment's own time zone, and the zone is named**: "Tue, 24 November 2026 at 10:00 (Africa/Harare time)". A new time is typed in that zone too (the label says so) and sent to the API in UTC.
- A proposed new time is a highlighted line that says who proposed it and, for the proposer, that it is waiting for the other person.
- **Actions come from the API's `can_*` flags.** Customer: "Accept the new time", "Propose a new time", "Cancel" (reason optional). Professional: "Confirm" (or "Accept the new time" for a customer's proposal), "Propose a new time", "Mark as completed", "Customer did not arrive", "Cancel" (reason required, shown to the customer). Every action except confirm and accept opens a confirmation step in place, with "Keep as it is" to back out; focus moves into it. Buttons are 44px tall.
- The professional's card also shows the customer's name and contact details and who the appointment is assigned to. Contact details appear only there, behind sign-in. A customer never sees a professional's phone number or email.
- After an action the list reloads. A 409 is explained: `SLOT_TAKEN` is "You already have a confirmed appointment at that time. Propose a different time."; `INVALID_STATE` says the appointment changed and refreshes the list.
- "History" is a `<details>` that loads the timeline the first time it is opened: each change in the API's words, who made it, when, and the time it was for.
- States: loading skeleton, signed out (`RequireAuth`), error with "Try again", empty (with "Browse listings" for a customer with nothing upcoming).
- Links: "Your appointments" in the account menu and on the account page; "Appointments received" for professionals in both; "Appointments" at the top of the request inbox with a badge counting those waiting for an answer (`GET /v1/inbox/summary`).
- When a viewing or consultation request with a preferred time is received, the request form's receipt adds the appointment's reference, says it is not confirmed until the advertiser accepts it, and (signed in) links to the person's appointments.
- Not built: assigning an appointment to a colleague (the API has `can_assign` but no endpoint that lists an organisation's members), paging beyond the first page of a list, and asking for an appointment from a public profile.

## OnboardingHub (`onboarding/onboarding-hub.tsx`)

`/onboarding`: the signed-in person's applications for listing, managing and agency roles, one card per role.

- An opening paragraph says in plain words that roles for real estate professionals, businesses and property owners are confirmed after RightProperty365 has checked who the person is, and that a role gives no extra access until then.
- Each card: the role's label (from the API) as an `h2`, a status badge, what is still needed in words ("Details still needed: …", "Documents still needed: …"), and one primary action.
- Status wording is the API's `status_label`: "Pending Verification" (not yet submitted), "Under Review", "Changes Requested", "Approved", "Rejected". The same words are the fallback where only the code is known. Never "Verified" before an approval. The badge always has text; tone is neutral, info, warning, success, danger in that order.
- Action by status: "Start" (an untouched draft), "Continue", "Fix and resubmit" (changes requested, with the reviewer's reason on the card), "View" (submitted or approved, a secondary button), "Apply again" (not approved, with the reason). An approved role with a public profile also gets "View your public profile".
- States: loading skeleton, signed out (`RequireAuth`), error with "Try again", and "Nothing to complete" for an account with no such role.

## OnboardingForm (`onboarding/onboarding-form.tsx`)

`/onboarding/<role>`: one application. Which details and documents it has, and which are required, come from `GET /v1/onboarding/requirements`; cities, trades and agencies come from reference data. The component holds only how each detail is labelled (`onboarding/fields.ts`); a detail it does not know falls back to a text field.

- Order: a link back to the hub, the role as `h1` with the status badge, one sentence on what an approval leads to, any notice (see below), then two cards, "Details" and "Documents", then the actions.
- Details use `Field`. Optional ones are marked "(optional)"; required ones carry `aria-required`. Lists (areas, services) are one text field with "Separate with commas". Country, city, trade and agency are `SearchableSelect`s that start on "Choose…".
- **Country first, then the city.** "Country" lists every country by name and is found by name or by code ("GB"). Once one is chosen, "City or town" is a `SearchableSelect` of that country's cities where the reference data has them, and a text box where it has none (its hint says why). The API needs exactly one of the two (`city` or `city_name`), so the one shown is required. Changing the country starts the city again. Read-only views show one "City or town" line.
- **Private details say so.** The phone number's hint says it is used only by the verification team and is never shown publicly; the registration number likewise. In read-only views they carry a "Private" badge.
- Actions: "Save draft" (secondary; saves the details and says "Draft saved. Nothing has been sent for review yet.") and "Submit for review" (primary; saves, then submits).
- When submitting fails, every missing detail gets its message under its control and every missing document under its row, one summary `Alert` appears above the buttons, and focus moves to the first problem. The API's "is required" is rewritten to say what to do ("Enter business name before you submit.").
- After submitting: an info `Alert` titled with the status ("Under Review") with the time, saying the role is not active yet and the application cannot be changed. The details and documents are then read-only.
- "Changes requested" shows the reviewer's reason in a warning `Alert` above an editable form. "Rejected" shows the reason in a danger `Alert` with "Apply again", which starts a new application with the earlier details (documents are attached again).
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

- Status tabs are links in a `nav` (Under Review first, the default), each with its count as text inside the link and `aria-current="page"` on the current one. The current tab is filled, not only coloured.
- A GET form filters by role (a `SearchableSelect`; the roles come from the API) and searches applicant, email or business. Status, filters and page live in the address, so a view can be bookmarked.
- Each row is a card that is one link (the applicant's name, stretched): role and status badges, submitted time, applicant name and email, the business name or "Joining <agency>", and the number of documents. Oldest submission first, as the API returns them.
- States: loading skeleton, error with "Try again", empty ("No applications are waiting for review." or "No applications match those filters" with "Clear filters"), and `Pagination`.

## ReviewDetail (`admin/review-detail.tsx`)

`/admin/verifications/<id>`: one application for a decision.

- Header: applicant name as `h1`, role and status badges.
- "Applicant" card: name, email with "Confirmed" or "Not confirmed", account age, market, and one sentence beginning "Approving creates:" that says in plain words what an approval does (a new organisation and a verified public profile under Professionals, in a named kind, a membership in a named agency, or nothing beyond making the role active).
- "Details" card: every detail the role has. Private ones (phone, registration number) carry a "Private" badge. A missing required detail reads "Not given (required)".
- "Documents" card: one row per document type with "Attached", "Missing" or "Not attached", the file name, size and upload time, and "Open" (the admin file route, new tab, downloads). A line says every open is recorded in the audit log.
- "History" card: an ordered list of every status change in the API's words (`to_label`, `from_label`) with who made it, when, and the reason.
- "Decision" card (sticky on desktop): the requirement checklist in words ("provided", "missing (required)", "not provided (optional)") with an icon as a second cue, then three buttons: "Approve" (primary), "Request changes" (secondary), "Reject" (danger). They appear only while the application is submitted.
- **Every decision has a confirmation step** in place: a panel that names the action, says what will happen, and has a labelled text area and "Confirm approval" / "Send request" / "Confirm rejection" plus "Cancel". Focus moves into the panel. The note is optional for an approval; a reason of at least 5 characters is required to request changes or reject, and it is shown to the applicant.
- After a decision: a success `Alert` ("Application approved." with what was created, and a link to the public profile when there is one).
- A 409 (already decided, or the named agency is no longer verified) shows a warning `Alert` that says so and the page reloads the application.

## Professionals: hub, lists and profiles (`directory/profile-card.tsx`, `app/directory`)

**"Professionals" is the name people see for what the code, the addresses and the API call the directory.** The navigation says "Professionals", the hub's `h1` is "Find a property professional", and copy says "your public profile" or "under Professionals". The word "directory" is not shown to visitors. Addresses (`/directory/...`), the API (`/v1/directory`, `directory_kinds`) and file and component names keep it, so existing links keep working.

Every kind the API lists has a tile on `/directory`, a list at `/directory/<kind>` and a profile page per entry. Nothing in these pages names a kind: Solicitors appeared when the API added it. Breadcrumbs read Home, Professionals, the kind, the profile.

- `ProfileCard`: the logo or photo (`LogoMark`; initials without one, round for a person, square for a business; an agent without a photo carries their agency’s logo, named as the agency’s in its alt text), name, one line under it, tagline, then city, listing count, "Verified" and "Sponsored" badges. The line under the name is the agent's specialism when the API sends one ("Sales Agent", "Lettings Agent"), otherwise the profile's role line or trade, followed by the agency for an agent.
- A list has a small GET form above it: Country and Region or province (each a `SearchableSelect`), "Apply" and, when a filter is in use, "Clear". The heading is the kind's label alone ("Solicitors"); a chosen region or country is added ("Solicitors in the United Kingdom"). A filtered list has its own address (`/directory/agencies?region=bulawayo`), is `noindex`, and says "No profiles match those filters." when empty.
- Profile page: breadcrumb, a header with the kind's singular label, trade or specialism, "Verified" and "Sponsored" badges, then About, Services (offerings with descriptions when the API has them), Areas covered, and the enquiry card. A law firm, an agency and a plumber use the same page.
- Contact is enquiry-only on every kind. No phone number, email or address is shown.
- Structured data picks a schema.org type per kind code (`profileEntityType` in `src/lib/seo.ts`): agencies `RealEstateAgent`, agents `Person`, solicitors `LegalService`, anything else `Organization`.

## LegalDocument (`legal/legal-document.tsx`, `legal/legal-link.tsx`)

The layout of the four legal pages under `/legal`: Privacy Policy, Terms and Conditions, Refund Policy, End User Licence Agreement. The mobile apps link to these addresses, so the paths and the section ids are stable.

- **Static and complete.** A Server Component with no API call and no client code. The whole text is in the HTML, so it reads without JavaScript, on a phone, and in a crawler.
- **Order:** breadcrumb (Home, Legal, the document); a short `rule-brand`; the title as the page's one `h1`; "Last updated" with the date (`<time>`) and the version; then the table of contents and the text.
- **Table of contents:** a `nav` named "Contents" holding an ordered list of anchor links, one per section, numbered. Above the text on phones (links 44px tall); a sticky column at the left from `lg`, which scrolls by itself if it is taller than the screen.
- **"In short":** a `soft` panel with an `h2` and two to five plain sentences that say what the document means for the reader, then one line saying that the full text is what applies.
- **Sections:** each is a `section` with a stable `id` (`#your-rights`), a scroll margin on top of the page’s `scroll-padding-top`, so the sticky header does not cover its heading, and an `h2` that carries its number ("11. Your rights"). Sub-headings are `h3`. Numbers come from the order of the sections, never typed by hand.
- **Text:** `text-base`, `leading-relaxed`, `ink`, at most `max-w-prose` wide. Links are `primary-ink`, weight 500 and underlined, so they are not shown by colour alone. Long email addresses may break (`wrap-anywhere`), so nothing scrolls sideways at 320px.
- **"Questions":** always the last numbered section: the four contact addresses with what each is for, and the operator's registered details when the config has them.
- **"Other documents":** a `nav` with links to the other three.
- **Print:** the header, footer, test-site notice, breadcrumb, table of contents and "Other documents" are left out; headings do not end a page.
- **Every business fact comes from `src/lib/legal.ts`:** names, addresses, emails, governing law, refund numbers, dates and versions. A detail that is `null` there is left out; nothing is printed in its place. The wording is in `src/content/legal`. See `docs/legal.md` before changing either.
- **Voice:** plain English, short sentences, sentence-case headings, defined terms used the same way throughout (Platform, Listing, Professional, Content), role names as titles. Describe what the product does today. No "draft" banner on the page.
- **`LegalLink`** is the link to a legal document from a consent line or a form (register, property request, business enquiry, onboarding documents). It opens in a new tab so what was typed is not lost, and says "(opens in a new tab)" to screen readers.
- `/legal` lists the four as tiles with one sentence and the date each was last updated.

## FaqList (`faq/faq-list.tsx`, `app/faq/page.tsx`, `lib/faq.ts`)

`/faq`, "Frequently asked questions": what the site is and how its services work, for customers and for professionals.

- **Content is data.** `src/lib/faq.ts` holds categories of `{ id, question, answer }`. An answer is structured rich text (paragraphs and short lists of text and links), rendered as elements and never as raw HTML. The same data makes the `FAQPage` structured data. The shape is plain JSON so the questions can move to the API later without changing the page.
- **Page:** a short `rule-brand`, the `h1`, one sentence, then a "Topics" `nav` (anchor links to each category with its number of questions; above the list on phones, a sticky column from `lg`) and the list. It ends with a `soft` "Still need help?" panel with the support address from `src/lib/legal.ts`.
- **Categories** are `section`s with an `h2`. **Each question is a native `<details>`**: the `<summary>` holds the question as an `h3` and a chevron that turns when open, is at least 48px tall, the whole row is the target, and it takes the global focus outline. It opens with a click, Enter or Space and needs no JavaScript. Every answer is in the HTML. With JavaScript the answer opens and closes with its height (`MotionDetails`, see "Motion"); with reduced motion it opens at once.
- A question's `id` is its address: `/faq#why-no-phone-numbers`. With JavaScript the question named in the address is opened on load and when the hash changes; without it the browser scrolls to the closed question. Do not change an id once published.
- **"Search the questions"** (with JavaScript only; its space is reserved so nothing moves): a search field that filters the questions as you type, by the words of the question, its answer and its category, ignoring case and accents. A polite `role="status"` says how many match ("3 questions match."). With none: a dashed empty state, "No questions match", with the support address. Categories with no match are hidden.
- **Answers** are 2 to 4 sentences, at most `max-w-prose` wide, with underlined links to the page that does the thing. Answer from what is built today: never offer a feature that does not exist, and never give a time we cannot keep (verification says "we email you when a decision is made").
- Linked from the footer, the landing page's "How it works" heading ("Questions and answers"), the enquiry receipts ("What happens next?" goes to `/faq#what-happens-after-enquiry`) and `/legal`. It is not in the header bar, which has no room for another item.

## AppLinks (`layout/app-links.tsx`, `lib/app-links.ts`)

The links to the mobile app in the Apple App Store, Google Play and Huawei AppGallery: in the footer under "Get the app", and in the FAQ's "Where do I get the app?".

- Three secondary buttons, each with the store's mark to the left of its words: "Download on the App Store", "Get it on Google Play" and "Explore it on AppGallery". One row from `sm`; stacked at equal width on phones, each at least 44px tall.
- **The marks** are the Apple, Google Play and AppGallery glyphs of the `simple-icons` package (`siApple`, `siGoogleplay`, `siAppgallery`; CC0-1.0, the marks remain their owners' trade marks), drawn as inline SVG on the server at 20px in the button's text colour. They are decorative (`aria-hidden`): the words name the store. Do not recolour, redraw, stretch or crowd them, and do not join them to our logo.
- **The stores' official badges are not used yet.** The black "Download on the App Store", "Get it on Google Play" and "Explore it on AppGallery" badges may only be shown for an app that is available in that store, and must be the artwork each company publishes. At launch they replace these buttons (README, "Mobile app links").
- Each link opens in a new tab (`rel="noopener"`) and says "(opens in a new tab)" to screen readers.
- The addresses are in `src/lib/app-links.ts` and nowhere else. **Today they are placeholders** (each store's home page, `placeholder: true`). While any is a placeholder, one sentence under the links says the apps are being prepared for the stores and the links will go to the app pages once they are published. Set the real addresses and `placeholder: false` and the sentence disappears, in the footer and in the FAQ.

## ApiBoundary (`components/api-boundary.tsx`)

Wraps every public component that reads the API through `load()`.

- In a build made with the API it renders its children directly, so their content is ordinary HTML in the page and is visible without JavaScript. In a build made without the API it is a `<Suspense>` with the given fallback.
- Do not wrap API-backed public content in a plain `<Suspense>`: React moves the finished content of a boundary into a hidden element and reveals it with a script, so a visitor without JavaScript sees only the fallback.
- A page whose content also reads `params` or `searchParams` exports `instant = false`. See README, "Builds and the API".
- The fallback still matters: it is what a build without the API stores and shows first. Match the content's size.

## Motion (`components/motion`, `app/globals.css`)

The site moves a lot, and none of it is allowed to cost anything: not content, not speed, not accessibility. GSAP 3 (with `@gsap/react` for `useGSAP`) animates what enters as the page is scrolled, what counts and what opens; its ScrollTrigger plugin ties the hero's parallax to the scroll position; CSS does hover, focus and the first paint. An entrance starts when the browser reports that the element is on screen (IntersectionObserver), not from a measured scroll position, so it cannot be missed at the end of a page or go stale when the page changes height. GSAP is not MIT-licensed: both packages are under GSAP's own "Standard no charge" licence (https://gsap.com/standard-license), which the package describes as free of charge, commercial use included. Only the core and ScrollTrigger are imported.

**Rules. They are not negotiable.**

- **The server HTML is fully visible.** No element is hidden in markup or in CSS for a script to reveal. Hidden starting states are set from JavaScript, in a layout effect, and removed when the animation ends. If the script fails, everything is simply there.
- **Nothing that has been seen is hidden again.** When a page is loaded from the server, whatever is already on screen when the script starts is left alone; only what is still below the screen is prepared for an entrance. After a client-side navigation the script runs before the first paint, so everything may enter. This is why a first load is calmer than moving between pages.
- **`prefers-reduced-motion: reduce` means no movement at all.** Every GSAP animation is created inside `gsap.matchMedia()` under `(prefers-reduced-motion: no-preference)`; the CSS utilities are inside the same media query. Content just appears.
- **Largest Contentful Paint is protected.** The hero's `h1` and photograph, a listing's main photo and the first row of listing cards never start invisible. They move with `transform` only, or what surrounds them moves.
- **`transform` and `opacity` only**, so nothing shifts. The one exception is the height of an opening answer (`MotionDetails`), which follows a click.
- **Sideways movement only inside a row that already scrolls sideways** (`ListingRail`). Anywhere else it could widen the page on a phone.
- **Forms are not animated.** A panel that holds a form may enter once; moving focus into anything that is still entering finishes it at once. No transform is left on an element afterwards, so drop-down lists and sticky panels inside it are positioned as before.
- GSAP is imported only by `components/motion/gsap.ts`, which registers the plugins once, and only client components import that file. Server components use the motion components as wrappers around their own content; pages stay server components.
- **Print shows everything.** Elements still waiting to enter carry `data-motion`, and the print stylesheet shows them.
- Short and small: 0.3 to 0.8s, 12 to 20px, the `standard` easing from the tokens, 30 to 100ms between the items of a group. Nothing loops.

**Components**

| Component | What it does |
| --- | --- |
| `Reveal` | Fades its content in and raises it 20px when it comes on screen. `as` picks the element, `from` is `up`, `scale` or `fade`. A descendant marked `data-draw` (the `rule-brand` of a heading) is drawn from left to right. |
| `Stagger` | The same for the direct children of a grid, row or list, one after another. Children that come on screen together enter together, so a long grid animates row by row. `from="right"` is for `ListingRail` only; `solid={3}` keeps the first three children from fading (the first row of listing cards). |
| `CountUp` | A whole number that counts up from zero the first time it is on screen. Figure spaces and tabular digits keep its width. |
| `HeroMotion` | The hero `section`: parallax and a slow settle on the frame marked `data-hero-photo`; elements marked `data-hero-item` rise in after a client-side navigation. |
| `MotionDetails` | A native `<details>` whose body (one unstyled element marked `data-details-body`) opens and closes with its height. It carries `data-closing` while it closes. |
| `SiteMotion` | Once, in the root layout. Marks the header `data-scrolled`, and has ScrollTrigger measure again whenever the page changes height (a navigation, streamed content, an opened answer). |
| `useReveal` | The hook behind `Reveal` and `Stagger`, for a client component that already owns the element (`ListingRail`). |

**CSS utilities** (no JavaScript; all inside the reduced-motion query)

| Utility | What it does |
| --- | --- |
| `enter-rise` | Rises 16px into place as the page paints. For what is on screen when a page opens: the hero panel, a page's heading, the auth card, a profile's header. |
| `enter-settle` | A photo eases back from a 5% zoom inside its frame: the main photo of a listing. |
| `link-sweep` | An underline in the accent colour that grows from the left on hover and focus. Put it on the text, inside the link. |
| `sheen` | A highlight that crosses the element once when it, or the `group` it is in, is hovered: the "Featured" tag, the "Verified" badge of a profile card, the app-store buttons. |
| `wobble-once` | An icon tilts once shortly after the page paints: the flask of the test-site notice. |

Cards (`ListingCard`, `ProfileCard`) rise 4px under the pointer. The hover is read from the `li` around the card (`cardLift`), so the card does not move out from under the pointer.

**Where it is used**

- **Every page:** header shadow and underlines; footer columns and app-store buttons come in one after another when the footer is reached.
- **Landing page:** hero (above); the stat strip counts up; the assurance band, every `SectionHeading` (with its rule drawn), the listing rails (cards slide in from the right), the featured grid, country and suburb chips, city tiles (grow in), category and professional tiles (with their counts counting up), "How it works" steps and promises, the role groups and the closing panel.
- **Search results:** the heading rises; filter chips, listing cards row by row (the first row moves but does not fade), popular searches; the advanced search panel opens and closes with its height.
- **Listing:** the main photo settles; more photos grow in; facts, description, features, the calendar, the side panel with the advertiser and the request form, and "Similar properties" enter as they are reached.
- **Professionals:** headings rise; tiles, trade chips, profile cards, a profile's services, areas, agents and listings enter as they are reached; a profile's header rises.
- **FAQ:** the heading rises; answers open and close with their height; "Still need help?" enters.
- **Legal:** headings rise and the index cards come in. The text of a document does not move.
- **Sign-in, registration, account recovery:** the card rises. **Not found:** the message rises.

**Adding motion to something new.** Wrap it in `Reveal` or `Stagger` from a server component; do not make the page a client component and do not import GSAP anywhere else. If it is on screen when its page opens, use `enter-rise` instead. If it holds a photo that loads with priority, do not fade it. When the same component shows a new set of items after a client-side navigation (search results), give its wrapper a `key` that changes with them, so the entrance runs again.

## YouTubeTour (`listings/youtube-tour.tsx`, `lib/youtube.ts`)

A listing's video tour (API 0.28.0, BR-013, FR-011), in a "Video tour" section of the listing page after the facts. Only when the API sends `video`. A client island: the server renders the poster, the same for everyone, so the page stays cached and nothing is personalised.

- **Before play:** a 16:9 frame with YouTube's thumbnail (`thumbnail_url`, a plain `<img>`, lazy, alt "Video tour of <title>") and, centred on it, a 48px white pill button with a play icon on `primary`: "Play the video tour (YouTube)". Under the frame, always: "Plays from YouTube. YouTube may set cookies when you press play." and a link to YouTube's privacy policy (new tab). Nothing is loaded from youtube.com before the press; the poster comes from i.ytimg.com.
- **After play:** the official player replaces the poster in the same 16:9 box: `src` is the API's `embed_url` (youtube-nocookie) plus `autoplay=1` (allowed only because the visitor just pressed play) and `enablejsapi=1&origin=…` for the IFrame API (`playerSrc`, which refuses anything but a youtube-nocookie embed of a valid id); `title="Video tour: <title>"`, the contract's `allow` list, `allowfullscreen`, `referrerpolicy="strict-origin-when-cross-origin"`, `loading="lazy"`. Keyboard focus moves to the player when it loads. The IFrame API script (`https://www.youtube.com/iframe_api`) is added only then, once per page; if it does not load within 15 s (blocked, offline) the player still plays and only the error detection is lost.
- **Fallback:** when the thumbnail fails or is YouTube's 120 by 90 placeholder (a removed video), or the IFrame API reports error 100, 101 or 150 (removed, private, not embeddable), a neutral `sunken` 16:9 frame says "This video can't be shown here" with "Watch on YouTube" (`watch_url` at the start time, new tab, `rel="noopener noreferrer"`). After an error during play, focus moves to that frame.
- **Measurement:** with a `listingId`, a press of play records `youtube_play_intent` (once per page view) before anything loads from YouTube. Nothing is read back from the player.
- **Motion:** the button grows 5% on hover only under `prefers-reduced-motion: no-preference`. Nothing plays until the press.
- **Headers:** `next.config.ts` sends `Content-Security-Policy: frame-src https://www.youtube-nocookie.com https://www.youtube.com`, a frame-only policy. A new embed must add its origin there.

## SaveListingButton (`listings/save-listing-button.tsx`)

The heart that saves a listing (API 0.27.0). On every `ListingCard` and on the listing page beside the title.

- A native `button` with `aria-pressed`. Its name is the state word and the listing title: "Save 3-bedroom house in Borrowdale", "Saved 3-bedroom house in Borrowdale". On the listing page the word is visible (a secondary `md` button, "Save" / "Saved"); on a card it is a 44px round white button over the photo with the word for screen readers only.
- Not saved: the lucide `Heart` outline in `ink`. Saved: the heart filled in `primary`. The state is never shown by colour alone: the fill changes, and `aria-pressed` and the name say it.
- **Every render from the server is "Save".** Listing pages and search results are cached and the same for everyone; the hearts fill in once the browser has read the saved ids (`SavedListingsProvider`). Never read the saved state on the server.
- Signed out: pressing it goes to `/sign-in?next=<this page and its query>` (`signInHref` in `lib/portal.ts`, which only keeps a path on this site), and sign-in returns there.
- Signed in: the heart changes at once. If the API refuses, it goes back and a `Toast` says what happened in plain words (`saveFailureMessage` in `lib/saved-listings.ts`): "<title> is no longer available, so it cannot be saved.", "We could not save <title>. Please try again." A second press while the first is on its way is ignored.
- Not shown to an administrator session, which cannot save (the API answers 403).

## SavedListingsProvider (`listings/saved-listings-provider.tsx`)

The client context behind the hearts, inside `AuthProvider` in the root layout.

- Reads `GET /v1/me/saved-listings/ids` once per page load, in the browser, when a customer-scope session is known; again only when the account changes. Nothing when signed out.
- `isSaved(id)`, `toggle({ id, title })` (optimistic, rolled back on failure), `forget(id)` (the Saved list's own Remove), `status` ("off", "loading", "ready") and `canSave`.
- When the ids cannot be read the hearts stay empty and still work: saving is idempotent.
- It renders the page's one `Toast`.

## Toast (`ui/toast.tsx`)

A message about an action taken from somewhere on the page that has no room for an inline `Alert` (the heart on a card). Today it is used only for failures.

- At the bottom of the screen, centred on phones with a 16px gutter, at the bottom right from `sm`; at most 384px wide, so it never makes the page scroll sideways at 320px.
- A white `surface` panel, `line-strong` border with a 4px `danger` bar on the left, a danger icon, the message in `ink`, and a 44px "Dismiss message" button.
- It stays until it is dismissed or replaced by the next message. It never times out, so it can be read at any pace.
- The `role="alert"` region is always in the page, so the message is announced when it appears. Focus does not move to it.

## ActivityNav (`account/activity-nav.tsx`)

The customer activity hub: "Requests", "Appointments" and "Saved" as one row of links at the top of `/account/requests`, `/account/appointments` and `/account/saved`. Drawn with `ChipNav` (named "Your activity"); the current page is filled and has `aria-current="page"`. Each page names itself, so the row reads nothing from the address and is part of the static shell.

## SavedListings (`account/saved-listings.tsx`, `/account/saved`)

The properties the signed-in person saved, newest saved first, 24 a page (`GET /v1/me/saved-listings`). Read in the browser with the session cookie; `noindex, nofollow`.

- Order: `ActivityNav`, `h1` "Saved properties", one sentence on what is kept, a status line ("3 saved properties, page 1 of 2, newest saved first"), the list, `Pagination` (`?page=2`).
- **Available**: a card with the photo, category, title as a link to the listing (the photo repeats the link, out of the tab order), price with its period, city and country, when it was saved and the reference.
- **No longer available**: a dashed `sunken` card with the photo greyed, a warning `Badge` with the API's `unavailable_label` ("Listing expired", "Let", "Sold", "No longer listed"), the title as plain text and "This listing is no longer available. It is kept here for your reference, as it was when you last saw it." It is never a link, to the listing or to search. Its text keeps full contrast; only the photo is faded.
- **Remove** on every item (a secondary button, "Remove" plus the title for screen readers, "Removing…" while it runs). An available item is removed at once, since it can be saved again; an unavailable one asks first in a `ConfirmDialog` ("Remove this saved property?", "Keep it" / "Yes, remove it"), because it cannot be saved again. Afterwards the status line says "Removed <title> from your saved properties.", focus moves to the `h1`, the list reloads, and the hearts elsewhere are told (`forget`). A failure is an `Alert` under the item, or in the dialog.
- States: loading skeleton (also the page's Suspense fallback), signed out (`RequireAuth`), error with "Try again" (403 is the "no access" state), empty ("You have not saved any properties yet" with "Find a property"), and a page past the end ("There is no page 3 of your saved properties" with "Go to page 1").
- At 320px the card stacks: photo on top, then the text, then the date and Remove.
- Links: "Saved" in `ActivityNav`, "Saved properties" in the account menu, on the account page and in the dashboard ("Find a property" for seekers, "Your workspace" for professionals).

## ViewToggle (`listings/view-toggle.tsx`)

"List" / "Map" above the results of `/listings`, only when the site has map tiles (`env.map`).

- A segmented control of two links in a `nav` named "Show the results as": a `line-strong` bordered `surface` group with 44px segments (icon and label, at least 96px wide). The current one is filled `primary` with `on-primary` text and `aria-current="page"`; the other is `ink` on white with a `sunken` hover.
- The view is in the address (`view=map`), so it works without JavaScript, can be shared, and the page stays cached. The list is always the default. Both links keep the filters and start again at page 1; the search form keeps the view (a hidden `view` field) and drops the map area.

## Maps: ResultsMap, ListingMap, LocationPicker (`map/maps.tsx`, `map/*-view.tsx`, `lib/map.ts`)

Leaflet 1.9.4 with raster tiles from `NEXT_PUBLIC_MAP_TILE_URL` (OpenStreetMap's public tiles by default, outside production only; README, "Environment variables"). When `env.map` is null no map is rendered anywhere and every list works as before.

- **Loading:** each map is a client island loaded with `next/dynamic` and `ssr: false`; Leaflet and its stylesheet are in no page's first download. Until it loads, a `sunken` placeholder of the same size (no layout shift); if the code cannot be loaded, "The map could not be loaded. Check your connection and reload the page." When tiles fail, a line says so; the lists and boxes still work.
- **Markers** are drawn in CSS (`globals.css`, `.rp-map-*`), not images: a `primary` pin with a white border for an exact position; a white ring with a `primary` border over a dashed, lightly filled circle (800 m) for an approximate one, whose public position the API has rounded to about 1 km. Focus is a 3px `focus` outline.
- **The map container** is a `region` with `aria-roledescription="map"` and a name that says how to use it. Scroll-wheel zoom is off until the map is clicked or focused, so scrolling the page never gets stuck on it. Zoom buttons are 44px.
- **ResultsMap** (`/listings?view=map`): 55% of the screen height (at least 256px, at most 576px), full width at every size, with the results listed under it ("Properties on the map" or "Properties in this area"), so the map is never the only way to a listing. Every marker is a keyboard-focusable button named after its listing ("<title>, <price>[, approximate location]"); Enter or Space opens a card with the title as a link, the price, the place and "Approximate location" when it is one, and focus moves to the link; closing the card returns focus to the marker. Moving the map never searches: once it has been still for 400 ms, a primary "Search this area" button appears over the top of the map and writes `bbox` to the address ("Searching…" while it runs). Above the map, "12 of 20 results can be shown on the map." from `mappable_total` of the same search without the box. Empty states: "No properties in this area" with "Search the whole map"; "None of these properties is on the map yet" with "Show them as a list". The Map view reads 48 results a page, with `Pagination` as in the list.
- **ListingMap** (listing page, under the address, at most 672px wide, 224px tall, 256px from `sm`): loaded only when it comes within 200px of the screen (IntersectionObserver). Still until it is clicked or focused: no dragging, swiping, double-click or wheel zoom and no zoom buttons, so it does not trap scrolling on a phone; then it can be moved and zoomed, and a polite status says so. An exact pin is decorative (the address above says where it is); an approximate one is the circle, with "Approximate location." under the map. Not shown when the listing has no location.
- **LocationPicker** (listing editor): 288px tall, 320px from `sm`. Click the map or drag the pin to place it; or move the map (arrow keys once focused) until the cross in the middle is on the property and press "Use this position" (secondary button). The pin follows the latitude and longitude boxes. With no pin the map starts on the whole world. Dragging is a mouse convenience only: the boxes and "Use this position" do the same without one.

## Listing analytics (`analytics/*`, `lib/analytics/*`, API 0.30.0)

First-party measurement of listings and the pages that report it. These are our own counts, never Google Analytics figures, and every page that shows them links to "How we count" (`/analytics-definitions`).

### Tracker (`lib/analytics/core.ts`, `lib/analytics/tracker.ts`, `analytics/analytics-root.tsx`)

- No third-party code. Events wait in a queue and go to `POST /v1/analytics/events` as `{ "schema": 1, "events": [...] }`, at most 50 a request: 5 s after the first, at once at 50, and on `visibilitychange` to hidden and on `pagehide` (`fetch` with `keepalive` and the session cookie; `navigator.sendBeacon` with a `text/plain` body where `fetch` is refused). A 5xx or 429 puts the batch back; each `event_id` is a UUID, so a resend never counts twice.
- **Off** when `navigator.doNotTrack === "1"` or `navigator.globalPrivacyControl === true` (nothing queued, no cookie), and for an administrator session (events waiting while the session loads are dropped).
- **Session pseudonym:** 128 random bits in `sessionStorage` and a first-party cookie `rp_as` (`Path=/`, `SameSite=Lax`, `Secure` on https, no `Domain`), expiring at the next local midnight and never more than 24 hours after it was made. A new tab picks up the cookie.
- **Source** is a class worked out from the host of `document.referrer` against short lists (search engines, social sites, web mail); after a navigation inside the site it is `internal`. The referrer itself never leaves the browser. **Device** is the viewport: phones below 768px, tablets below 1024px.
- **De-duplication:** a page view is a new path and query (not a hash). Each event kind counts once per listing per page view (an impression once per placement), so a re-render or React's double effects never send twice.
- `AnalyticsRoot` is the one island in the root layout. It renders nothing; it watches `[data-rp-impression]` cards with a `MutationObserver` and an `IntersectionObserver` and records an impression when a card is at least 50% visible for 1 s in a visible tab. `ListingViewBeacon` (listing page) records `listing_detail_view`; the request form's submit records `contact_click` (the one contact action: no phone or email is shown); `YouTubeTour` records `youtube_play_intent`. Pages stay cached: everything runs in effects and handlers.

### Analytics pages (`analytics/report-ui.tsx`, `analytics/agent-analytics.tsx`, `analytics/admin-analytics.tsx`)

- **`/agent/analytics`**: `h1` "Analytics" and one paragraph that says these are first-party counts, not Google Analytics figures, with "How we count". Then a form: "Period" (`SearchableSelect`: Last 24 hours, Last 7 days, Last 30 days, Choose dates), "First day" and "Last day" (`type="date"`, only for chosen dates; checked in place: both needed, the first on or before the last, the last not after today), "Organisation" (`SearchableSelect`, only with several, from the dashboard's `organisations`, as the lease templates choose it) and "Show". Everything is in the address (`?period=custom&from=…&to=…&org=…`). An AGENT is told the figures are of the listings assigned to them.
- **`/agent/analytics/listings/<id>`**: the same for one listing, its title and reference from the API, and links back to the listing and to all listings. A 404 says the figures are for the lister, their organisation's owner and managers and the assigned agent.
- **`/admin/analytics`** (SUPER_ADMIN, PLATFORM_ADMIN, MARKET_ADMIN): the same report with a "Country" `SearchableSelect` (a MARKET_ADMIN sees only theirs; with one, the select is replaced by a line naming it), "By country" and "Top listings" with a country column.
- **Order of a report:** the days covered; **totals** as tiles in a `dl` (views, unique views, seen in lists, contact clicks, saves, enquiries, enquiry conversion, contact rate, video plays, viewing requests, viewings confirmed, relisted; a rate with no views says "No views yet", never 0% or a dash); **listing views per day**; **from list to enquiry** (the funnel) beside **where views came from**; **devices**; **top listings** (organisation and admin); then the footer: when the figures were brought up to date (`refreshed_at`), "near real time" for 24 hours, how many bot events and late events were left out, and "How we count".
- **States:** loading skeleton (`LoadingBlock`), the API's message with "Try again" (`LoadError`; 403 is "no access"), and the empty state "No views yet" with "How we count" when every total is 0. Signed out: the sign-in prompt. All three pages are `noindex` and read in the browser with the session.

### Charts (`DailyViewsChart`, `FunnelCard`, `BreakdownCard`)

The site's data-visualisation rules. They apply to any chart added later.

- **Form first.** One measure over days is columns; a share of a whole or a step of a funnel is a horizontal bar with its number written beside it. A single figure is a tile, not a chart. Never two value axes.
- **Colour.** One series is `primary`; tracks are `sunken`; gridlines `line`, the baseline `line-strong`; axis text `muted` at 12px. Text is never in the series colour. No categorical palette is needed while every chart has one series; a chart with several must first add a palette to the tokens and check it for colour-blind separation and contrast.
- **Marks.** Columns grow from the baseline with 4px rounded tops and a 2px gap (6px up to 20 days); a value above zero is never drawn less than 2px tall. The value axis is rounded to 1, 2 or 5 times a power of ten in whole steps, and zero data still gets an axis from 0 to 4 (`niceScale`, `columnLayout` in `lib/analytics/report.ts`, tested). At most three day labels (first, middle, last), so nothing collides at 320px. The SVG is drawn at its real pixel width (a `ResizeObserver`), so its text is never stretched.
- **Hover.** Each day has a hit area the full height of the plot; hovering or tapping it writes "12 November 2026: 34 views, 20 unique" in a line above the plot. It is a convenience: the same figures are in the table.
- **Accessible by construction.** A one-line summary in words above every chart ("1,202 listing views from … to …. Busiest day: …", `seriesSummary`); the SVG is `role="img"` named by that summary; under it "Show the figures as a table" (a native `details`) holds a `table` with a caption and row headers. Bars in the funnel and breakdowns are `aria-hidden`: the label, count and share are text.
- Missing days are zero days (`fillDays`). Days are each market's local days, as the API sends them; the page never shifts them by the viewer's time zone.

### ListingAnalyticsCard (in `ListingEditor`'s side panel) and the list

- "Last 30 days" with views, unique views, saves and enquiries (`GET /v1/analytics/listings/{id}?period=30d`), and "See the analytics", named with the listing's title, to `/agent/analytics/listings/<id>`. A loading block, or "The figures could not be loaded." in its place; the rest of the editor never waits for it.
- In "Your listings" every listing past its draft has an "Analytics" ghost button to the same page, and the page's opening line links to `/agent/analytics`.

### How we count (`/analytics-definitions`)

Public, static, indexable. Every figure is defined in a `dl` with an anchor each (`#unique-views`), then days and time zones, bots and automated traffic, late events, what we collect, Do Not Track and Global Privacy Control, and how long events are kept. It opens with "These are not Google Analytics figures" in a `soft` panel. Linked from every analytics page, the footer (beside the Privacy Policy) and the Privacy Policy's "Measurement" section.

## Contact book (`agent/contacts/*`, `lib/contacts.ts`, API 0.31.0)

An organisation's private, shared book of contacts. Every member reads every contact (the relationship owner is a field, not a visibility rule); OWNER, MANAGER and AGENT change them; Agency Staff only read; import and export are for the OWNER and MANAGER. The customer never sees any of it. Every page is `noindex, nofollow`, read in the browser with the session, and reflows at 320px. Rules that are not the API's (stage words and tones, filters in the address and the API query, chips, the merge preview, the CSV check, where timeline entries link) are pure functions in `lib/contacts.ts`, checked by `npm test` (`scripts/contacts.test.mjs`). Types and sources come from the `contact_types` and `contact_sources` reference sets; the stages are a fixed enum (New, Contacted, Viewing requested, Viewing confirmed, Negotiating, Closed, Unsuccessful) whose words come from the API's `stage_label`, then a `contact_stages` set if the API has one, then the fallback in `lib/contacts.ts`.

### ContactsShell (`contacts/shared.tsx`)

- `BackLink`, the page's `h1` (a contact's page uses the contact's name instead), one line of intro, then the organisation: from `?org=`, else the first of the dashboard's `organisations`. With several, an "Organisation" `SearchableSelect` (as on the team and analytics pages); the line under it names the organisation and the person's role, and says when they can only read. Every link in the book keeps `?org=`.
- "List", "Pipeline" and (OWNER, MANAGER) "Import" as a `ChipNav` named "Contact book sections".
- States: loading, error with "Try again", "The contact book belongs to an organisation" for someone with none (a direct owner), signed out, no access. The content is keyed by organisation, so nothing of one stays on screen for another.

### Contact list (`contacts/contact-list.tsx`, `/agent/contacts`)

The primary accessible view. "Add a contact" (primary) and "Merge contacts" for writers; "Export as CSV" for the OWNER and MANAGER (a download named by the API's `Content-Disposition`; a success `Alert` says it is recorded in the activity log).

- Stage links as a `ChipNav` ("All" and each stage, with counts when the API sends `stage_counts`), then a GET filter form that works without JavaScript: Search (name, email or phone), Type, Stage, Tag, Relationship owner and Order, each a `SearchableSelect`, and "Only contacts with a reminder due". The tag list is the tags of the contacts read (the contract has no list of tags); the owner list is the team (OWNER and MANAGER can read it), otherwise "Anyone" and the person themselves.
- "Filters in use": one chip per filter, each a link to the list without it ("Remove filter: Tag: cash"), and "Clear all", as the listing search's chips.
- A status line ("12 contacts match, page 2 of 3"), cards (type and stage badges, "Reminder due" with an icon and the word, the name as the link, the first email and phone with "+1" for more, tags, owner, last contact or when added), `Pagination`.
- Empty: "No contacts yet" (with "Add a contact" for writers), "No contacts match these filters", "There is no page 5 of these contacts".

### ContactForm (`contacts/contact-form.tsx`)

The details, on the new-contact page and in a contact's "Details" card. Name, Type (`SearchableSelect`), Email addresses and Phone numbers (a list of fields, each with a 44px "Remove email address 2" button, and "Add another email address"), Tags (a field with "Add tag"; Enter adds instead of sending; each tag a 44px chip with "Remove tag cash"), Where they came from (`SearchableSelect`), and "Marketing permission": what is stored (a badge, when it was recorded, by whom and how), a checkbox and "How they agreed". Checked before sending in the words shown under each control (a phone starts with + and the country code); the API's field errors go under their controls; an error summary takes focus. Agency Staff see it disabled with one line that says why.

### New contact and the duplicate banner (`contacts/contact-new.tsx`, `/agent/contacts/new`)

The form plus Stage, Relationship owner and First note. A 409 `CONTACT_DUPLICATE` shows a `warning-soft` banner with a 4px `warning` bar (`role="alert"`, focus moves to it): what was found, "Open the existing contact: <name>" for each duplicate with its stage, and "Create anyway" (secondary), which sends again with `allow_duplicate=true`. Success opens the new contact.

### Contact page (`contacts/contact-detail.tsx`, `/agent/contacts/<id>`)

- Head: type and stage badges, source, the name as `h1`, email and phone links (44px), when added and last contact; "Merge with another contact" and "Delete the contact" (a `ConfirmDialog`: "Keep it" / "Yes, delete it") for writers.
- Main column: "Details" (`ContactForm`), "Notes" (marked "Only your team can see notes. The contact never does."; append-only: the hint says a correction is a new note; newest first, author and time), "Timeline" (newest first; each entry in the API's words or made from its kind, who and when; a linked request, enquiry, appointment, listing or contact is a link to its page, anything else plain text; read again after every change).
- Side column: "Stage" (the badge now, "Move it to" `SearchableSelect` of the other stages, optional "Why", "Change the stage"), "Relationship owner" (the owner; for an OWNER, MANAGER or the current owner, "Give it to" from the team, or only themselves when the team cannot be read, and "Save the owner"), "Reminders" (Due, Coming up or Done badges with the word, the time, "Mark as done" / "Mark as not done" named with the text; "Add a reminder": When as `datetime-local` in the person's time zone, What to do), "Linked listings" (each a link with "Unlink"; "Link a listing" `SearchableSelect` of the person's listings).
- Each change says how it went in a polite live region under its control and reads the contact again. A 404 is "We could not find that contact"; a merged contact says where it went with "Open the contact it was merged into".

### Pipeline board (`contacts/contact-pipeline.tsx`, `/agent/contacts/pipeline`)

- One column per stage, in order, as an `ol` that wraps (one column on phones, two from `md`, four from `xl`), never scrolling sideways. Each column: its stage badge and count as its `h2`, up to 50 cards, "See all 73 in the list" when there are more, "Nobody at this stage" when empty.
- Each card: the name (a link), type, owner and, for writers, **"Move to…"**, a `SearchableSelect` of the other stages named with the contact's name. Choosing a stage moves the card at once and says "Rudo Moyo moved to Negotiating." in a polite live region; failures say why. This is the keyboard and screen-reader way to move a card.
- Pointer users may also drag a card (a grip icon, `cursor-grab`) to another column, which is outlined `primary` on `tint` while a card is over it. Dragging is a convenience only; the list remains the primary accessible view.

### Merge flow (`contacts/contact-merge.tsx`, `/agent/contacts/merge`)

Three steps on one page. "1. Find the contacts": a search with checkboxes on each result (at most 10). "2. Choose the one to keep": radio buttons with "Remove" for each chosen contact (`?keep=<id>` from a contact's page preselects it). "Preview the merge" reads each contact in full. "3. Check what moves": who stays, who becomes a pointer, and the email addresses, phone numbers and tags new to the contact kept plus the counts of notes, reminders, listings and linked items that move; the kept contact's name, type, stage and owner stay. "Merge the contacts" asks in a `ConfirmDialog` (it cannot be undone) and opens the contact kept.

### Import (`contacts/contact-import.tsx`, `/agent/contacts/import`)

OWNER and MANAGER only (others are told who can and offered "Add a contact").

- **File upload:** a labelled native `<input type="file" accept=".csv">` whose button is styled as a secondary button (44px). The page says which columns are read. Before anything is sent the file is checked in the browser (`checkContactCsv`): a CSV, at most 5 MB, a header row with `name`, 1 to 5,000 rows; the problem appears under the control. Then the API's dry run is the preview.
- **Preview:** "Nothing has been imported yet", counts as badges (new, already in the book, rows with errors), one sentence that only new rows are added and nothing is overwritten, and the table.
- **Data table:** a `table` with a caption, column headers and the row number as the row header, inside a focusable `region` that scrolls sideways on its own at 320px (the page never does). Each row's result is a badge with its word ("Will be created", "Already in the book" with a link to that contact, "Not imported" with each problem in `danger` text).
- "Import 12 contacts" asks in a `ConfirmDialog`, then "Import finished" with how many were added and left out, the rows, "See the contacts" and "Import another file".

### CreateContactButton (`contacts/create-contact-button.tsx`)

"Create contact" (secondary, with an icon) on a property request's page (in its "Contact" card), on each business enquiry card in the inbox and on each received appointment's card (there are no separate pages for those two). It calls `POST …/contacts/from-request/{id}` and opens the contact; a line under it says it links to an existing contact instead when there is one. With several organisations a "Contact book" `SearchableSelect` comes first. Not shown to anyone without a book they can write to. In a list its accessible name includes the customer's name; the buttons on one page share one read of the dashboard.

### RemindersDueCard (`contacts/reminders-due-card.tsx`)

"Reminders due" on the professional dashboard, after "Next appointments": the overdue reminders and those due today in every book the person belongs to (`…/contacts/reminders?due=overdue` and `today`), soonest first, five shown, each with the contact as a link, the text, an "Overdue" or "Today" badge and the time; "Contacts with a reminder due" opens the list filtered. A quiet line when none; one plain sentence when they cannot be read.

Links: "Contacts" in the account menu (organisation members), in "Your workspace" on the dashboard and at the top of the request inbox.

## Not built yet

Dialog, tabs, a reusable data table (the contact import preview is the one table pattern so far), a time-slot picker (nights are chosen in `NightCalendar`), a reusable file upload control (beyond `DocumentUploader` and the contact import field), a map search across the antimeridian. Specify each here before building it.
