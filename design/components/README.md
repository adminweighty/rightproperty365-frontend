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
- **The bar is one row at every width and never wraps or scrolls sideways.** The logo is the one part that may shrink: 24px tall on phones, 32px from `sm`. Do not add items to the bar; add them to the navigation list, which moves into the menu on small screens. The one exception is the signed-in `NotificationBell`, a 44px icon link just before the session control.
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
- Signed in: a secondary button, 44px tall, that opens a menu with the person's email, "Dashboard" (always first), "Your account", "Complete your profile" (while an onboarding application is not submitted or has changes requested), "Notifications", "Notification preferences", "Your requests", "Your appointments", "Your applications", "Saved properties", "Request inbox", "Appointments received" and "Your listings" (professional accounts and owners only), "Applications received", "Application forms" and "Contacts" (organisation members) and "Sign out". From `sm` the button shows the person's first name; on phones it is the account icon alone, with the name kept for screen readers ("Account menu for Tendai"), so the header fits a 320px screen.
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
- **Sections:** Basics (category, property type limited to the category, for sale or to rent, title, summary, description), Price (amount, currency, what it is charged per), Location, Details (bedrooms, bathrooms, floor and land area, features as 44px checkbox rows), Short stay (guests at most, shortest stay, a link to the calendar; only for the short-stay category), Photos (`PhotoManager`), Video tour, Applications (`ListingApplications`), History. Every drop-down is a `SearchableSelect` fed by the API's reference data (`lib/api/server/listing-editor.ts`).
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

## Reviews of service providers (`reviews/*`, `lib/reviews.ts`, `admin/review-moderation.tsx`)

Reviews (API 0.36.4) appear on a service provider's profile and card, on a finished maintenance request, on `/account/reviews`, `/agent/reviews` and `/admin/reviews`.

- **Stars are decoration; the words are the content.** `StarRow` draws five stars (warning colour filled, `line-strong` empty, halves to the nearest half) with `aria-hidden`. `RatingSummaryLine` adds the figure ("4.5") and the count ("(12 reviews)") visibly, and "4.5 out of 5 from 12 reviews" for screen readers; it renders nothing without a published review. `ReviewStars` says "4 out of 5 stars". The average is the API's, one decimal, rounded half up (`formatAverage`).
- **`StarRatingInput`** is a `fieldset` with a `legend` and a `radiogroup` of five native radio buttons drawn as stars, each a 44px target: arrow keys move and choose, Tab enters and leaves the group, the focus ring is drawn round the star. The chosen value is said in words beside it ("4 out of 5 stars", polite live region). An error sits under the group and is named by `aria-describedby`.
- **`ReviewCard`**: stars, the public name (first name and initial, or the organisation's name, as the API sends it), the date, the text (`whitespace-pre-line`, breaks long words at 320px), then the provider's reply in a `tint` panel with a primary left rule ("Reply from …"). Slots for a status badge, extra lines, actions and a full-width footer.
- **Writing a review** (`ReviewComposer`): only where the eligibility endpoint offers a job or enquiry. A "Review Sample Plumbers" button opens the form in place: the job or enquiry (a `SearchableSelect` when there are several), the rating, the text with a live counter ("57 of 2000 characters", "12 of 2000 characters, at least 20"), and a line that says every review is checked before it is published and how the reviewer is named. The reviewer's own review then shows with its status badge ("Awaiting moderation", "Published", "Hidden", "Not published": the API's words), the moderator's reason, "Change your review" while it waits and "Delete it" (with `ConfirmDialog`). With `explain` (a maintenance request), the reason a review is not possible yet ("You can review the provider from 1 Dec 2026").
- **Report**: a quiet ghost button with a flag on each review, for anyone signed in ("Sign in to report" otherwise); it opens a native modal `<dialog>` (`FormDialog`) with a required reason and a counter. Afterwards the button is replaced by "Thank you. Our moderators will look at this review."
- **Provider's reply** (`/agent/reviews`, "About your business"): one reply per review, Principals and Managers only. After posting, `ReplyCountdown` says until when it can be changed and how long is left ("6 days 4 hours left"), redrawn every minute and every second in the last minute; when the time is up the button goes and the line says so. A reply removed by a moderator says so, with the reason. "Written by you" lists the organisation's own reviews.
- **Moderation** (`/admin/reviews`, Super Administrators, Content Administrators and Moderators): queues New, Reported and All as `ChipNav` with counts, a Status filter (`SearchableSelect`, not on New), then each review with what it is about, who wrote it (the platform always knows), the last decision, the open reports and their reasons, a Reason field and the actions the API allows: Publish (or "Keep published" for a reported one), Hide, Reject, Remove the reply. Every action asks in a `ConfirmDialog` that says what will happen; all but publishing need a reason, checked before the dialog opens.
- **Public pages stay the same for everyone.** The first page of published reviews is in the cached profile HTML; later pages, Report and the form are read in the browser.

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

The customer activity hub: "Requests", "Appointments", "Hourly bookings", "Applications" and "Saved" as one row of links at the top of `/account/requests`, `/account/appointments`, `/account/venue-bookings`, `/account/applications` and `/account/saved`. Drawn with `ChipNav` (named "Your activity"); the current page is filled and has `aria-current="page"`. Each page names itself, so the row reads nothing from the address and is part of the static shell.

"My tenancy" (`/account/tenancies`) joins the end of the row only when `GET /v1/me/tenancies` returns at least one tenancy for the signed-in person (asked once per person per visit in the browser; a failure is not remembered; never for an administrator session). On its own page it is always shown, as the current link. The rest of the row renders first and does not move.

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

## Questionnaires and applications (`applications/*`, `forms/*`, `lib/questionnaires.ts`, API 0.32.0)

Application forms an organisation designs (FR-017), attached to a listing that takes applications (FR-019), answered by a signed-in customer with private documents (FR-015), and read by the receiving organisation. Rules that are not the API's, or that the web repeats so people see a problem before sending (`visible_if`, the per-question answer checks, the submit check, the allowed transitions, the form-definition checks, file types and sizes, status words and tones), are pure functions in `lib/questionnaires.ts`, checked by `npm test` (`scripts/questionnaires.test.mjs`). The API stays the authority on every one of them, and its message is what is shown. Every page is `noindex, nofollow`, read in the browser with the session, and reflows at 320px.

`lib/api/applications.ts` follows the contract's response shapes (`{ form }`, `{ application }`, lists as `{ items }`, a flat intake object, `status_counts` as a map) and reads each answer through a normaliser that also takes a bare object and fills in what is missing.

### OrganisationShell (`applications/organisation-shell.tsx`)

Forms and received applications live under an organisation. `?org=` in the address, else the first organisation; with several, an "Organisation" `SearchableSelect`, as on the contact book. One line names the organisation and the person's role. States: loading, error with "Try again", "… belong to an organisation" for someone with none (a direct owner), signed out, no access. The content is keyed by organisation.

### Question and FormSections (`applications/form-renderer.tsx`)

A form as the applicant fills it in, and the builder's preview: the same component, so both show the same thing.

- Each section is a `Card` with its title as a heading and its introduction. A section whose questions are all hidden is left out.
- **Controls by type:** short answer (`Input`, 200 characters unless the question says less), long answer (`Textarea`), number (a text box with `inputMode="decimal"`, so "1." and "1,200" stay as typed), date (`type="date"` with the question's earliest and latest day), one choice (radio rows up to 5 choices, a `SearchableSelect` above that; "Clear the answer" on an optional one), several choices (checkbox rows), file (`FileQuestion`). Rows are 44px with the `tint` fill when chosen.
- Every control has its visible label; optional questions say "(optional)". The hint says the limits in words ("From 0 to 100000.", "Choose up to 2.", "1 December 2026 or later."). Errors replace the hint, with `aria-invalid` and `aria-describedby`. Radio and checkbox groups are a `fieldset` with the question as `legend`.
- **Conditional questions.** `visible_if` (`{ field, equals }` or `{ field, in }`) is evaluated on every answer, in a chain: a question that depends on a hidden question is hidden too. A hidden question is never required, and its answer is dropped when the application is sent. With several choices, `equals` matches when that value is among the choices.

### FileQuestion (`applications/file-question.tsx`)

- The rules in words ("PDF, JPEG or PNG, up to 10 MB each. Up to 2 files. Only the advertiser's team can open them."), the attached files (a link to the applicant's own file route in a new tab, the size, "Remove"), and "Choose a file" / "Choose files" (a real button over a hidden file input).
- Files are checked before anything is sent: the question's types (from the platform allowlist: PDF, JPEG, PNG, WebP, HEIC, Word .docx) and 10 MB; files beyond the question's limit (at most 5) are refused in place. The rest upload one by one, each with a row: "Waiting", "Uploading… 45%" with a progress bar, or "Not added" and the reason with a danger border. A polite live region says each start and result. An uploaded file is attached to the answer and saved at once; "Remove" deletes it (`DELETE …/files/<id>`) and says so in the live region.

### AnswersView (`applications/answers-view.tsx`)

The answers in the layout of the exact form version the application was made on: its sections and question wording, never today's version. Each answered question is a `dt`/`dd` pair; choices in words, dates as "30 November 2026", "Not answered" in `muted`. Files are links in a new tab ("(opens in a new tab)" for screen readers). The organisation's view adds a `details` "2 questions were not asked" listing each hidden question with its condition ("Asked only when “Do you have pets?” is Yes."), so a hidden question is never mistaken for a skipped one.

### Form builder (`forms/form-list.tsx`, `forms/form-editor.tsx`, `/agent/forms`, `/agent/forms/new`, `/agent/forms/<id>`)

OWNER and MANAGER design forms; an AGENT reads them (an info `Alert` says so and every control is read-only).

- **List:** status links (All, Drafts, Published, Retired), "New form" (primary). Each form is a card: its name, country, number of questions and retention; then its versions as rows ("Version 2", the status badge, applications made on it when the API says, "Edit" or "View" named with the form and version).
- **New form:** name, country (`SearchableSelect` of every country, starting on the organisation's market), purpose, privacy notice and retention (30 to 3650 days), checked in place before sending. "Create the form" opens the builder.
- A version with submissions (`locked`) or an AGENT (`can_edit: false`) is read-only.
- **Builder** (a draft): "Build" and "Preview" as two toggle buttons (`aria-pressed`). From `lg`, a sticky side panel; on phones it comes first:
  - "Saving" (a polite status: "Changes not saved yet…", "Saving…", "All changes saved. Saved at 14:02.", or the API's message with "Try saving again"). Saving is automatic: the whole definition a moment after typing stops (`PATCH`), one save at a time. Leaving with unsaved changes asks first.
  - "Before you publish" / "Ready to publish": the API's checks, run in the browser (a name, a country, a purpose, a privacy notice, retention 30 to 3650, at least one question, keys unique and valid, `visible_if` only on an earlier question with an answer chosen, choices need 2, file types from the allowlist, 1 to 5 files, minimum not above maximum). Each is a button that opens the question and moves focus to its control.
  - The API's **sensitive-data warnings** (FR-018) as a `warning-soft` panel with a 4px `warning` bar ("Check the sensitive questions"), with one line that a warning does not stop a publish.
  - "Actions": "Publish this version" (saves, then the checks; then a `ConfirmDialog` that says the version cannot change and repeats the warnings; after it, a success `Alert` with the warnings the publish returned), "Make a new version" (published or retired: a draft copy opens; when it is published it replaces the old version on every listing that uses it, and the old one is retired), "Retire this version" (danger, confirmed).
  - "Versions": every version of the form, the current one marked `aria-current`.
- **About this form:** name, country, purpose, privacy notice, "Keep answers for, in days", "Stop taking applications on" (optional; the form expires at the end of that day).
- **Sections:** "Section 2 of 3" with Up, Down and Remove (icon buttons, 44px, named "Move Household up"; removing a section with questions asks first), title, introduction, its questions, and "New question" (a `SearchableSelect` of the kinds) with "Add the question", which opens the new question and focuses its label.
- **Each question** is a row: its number, label, kind, Required / Optional and Conditional badges; "Move … up" and "Move … down" (Alt+Up and Alt+Down anywhere in the row do the same), "Edit" / "Close" (`aria-expanded`), "Remove". Focus stays on the move button and the new place is announced ("Pets moved to position 2 of 5 in Household."). Settings: question, kind of answer (`SearchableSelect`; a change keeps the key, label and condition), help text, key (made from the label until it is edited; a new key keeps the conditions that named the old one), section (move to another), "Applicants must answer it", then by kind: shortest and longest answer (short answers 200 by default, at most 500; long 5,000, at most 10,000); smallest and largest value; earliest and latest day (`min_date`, `max_date`); choices (each with words and a value, Up, Down, Remove, "Add a choice"); fewest and most choices; file types (checkboxes from the allowlist) and most files (1 to 5). "When to ask it": "Always" or "Only after “…”" (a `SearchableSelect` of the earlier choice questions), then "… when the answer is" as checkboxes: one value is `equals`, several are `in`. Removing a question that others depend on makes them always asked, and says so.
- **Read-only** (published, retired, or an AGENT): each section lists its questions with their kind, badges and choices, and the Preview works.

### ListingApplications (`agent/listing-applications.tsx`, in `ListingEditor`)

"Applications", after Video tour. "Now:" with the intake badge (Open, Paused, Closed, No application form) and its closing time; "Application form" (a `SearchableSelect` of the organisation's published, unexpired forms for the listing's country, plus the attached one); "Taking applications" (a `SearchableSelect`: Open, Paused, Closed, or No application form, which detaches it); when Open was set but the API reads it as Closed, the reason (the closing time passed, the form expired or was retired); "Stop taking applications at" (optional `datetime-local` in the person's time zone, in the future). "Save the application settings" (secondary) saves apart from the listing's autosave (`PUT …/applications-intake`), because opening intake reaches the public page at once; the result is a polite `Alert`. A link to the listing's applications. Short stays say they do not take applications; a direct owner's listing says forms belong to an organisation; no published form links to Application forms. Whoever may edit the listing may change it, also while the listing is in review.

### ApplyButton (`listings/apply-button.tsx`) and the listing page

On a listing with `applications`, the side panel starts with "Apply": when open, one line on what it means (the form's name, documents only the advertiser sees, the closing time in UTC, because the page is cached for everyone) and the primary "Apply for this property", full width; when not open, "The advertiser is not taking applications for this property at the moment." The button is a client island: the server renders the link to `/apply/<slug>`, and for a signed-out visitor the browser points it at `/sign-in?next=/apply/<slug>`. The page stays the same for everyone.

### ApplyFlow (`applications/apply-flow.tsx`, `/apply/<slug>`)

- Signed in only (`RequireAuth`; signed out, "Sign in" returns here). Back link to the listing, "Application", the form's name as `h1`, "For <listing> (<reference>)".
- **Preview first:** "Before you start" with why the advertiser asks, the privacy notice, how long it is kept, how many questions and which documents, and a line that only the advertiser's team sees it and other applicants never do. "Start your application" makes the draft (or the API returns the one already started); "Nothing is sent until you check your answers and choose to send them."
- **Answering:** a collapsed "Why the advertiser asks, and your privacy"; for More information needed, a warning `Alert` with the advertiser's message; a save line ("Your answers are saved as you go.", "Changes not saved yet…", "Saving…", "All changes saved at 14:02.", or "Not saved: … Try saving again"); the sections. A choice saves at once; typing a moment after it stops and when the field is left. An answer that breaks its question's rules is said under it once touched and is not sent. "Check your answers" (primary) and "Finish later".
- **Check:** the submit check (required shown questions and every answer's rules). Problems: a danger summary with a 4px bar (`role="alert"`, focus moves to it) listing each problem as a button that focuses its control, and each error under its question.
- **Review:** "Check your answers" with `AnswersView` of only what will be sent, "Send the application" ("Send it again" after a request for more), "Change your answers".
- **Sent:** "Application sent", "Keep this reference: RPA-APP-2026-000001", what happens next, "See your application" and "Back to the listing".
- **Closed, paused, expired:** an empty state titled "Applications are paused / closed / have ended for this property" with the API's message and what it means (a paused draft is kept), and "Back to the listing". Shown before starting when the listing says intake is not open, and whenever the API answers 409 `APPLICATIONS_CLOSED` (starting, saving or sending).
- Already sent: the status, reference and "See your application". No form: "This property does not take applications". Listing gone: "This listing is no longer available".

### My applications (`applications/my-applications.tsx`, `/account/applications`, `/account/applications/<id>`)

- `ActivityNav` "Applications". `h1` "Your applications", status links with counts (when the API sends them), a status line, cards (status badge, sent or started, the listing as the link, what the status means for the applicant, "Continue your application" for a draft or "Answer the request" for More information needed, the reference), `Pagination`. Empty: "You have not applied for a property yet" with "Find a property to rent".
- **Detail:** status and reference, the listing as `h1` (a link while public), what the status means, the advertiser's request for more information, "Continue" / "Answer the request" and "Withdraw the application" (danger, `ConfirmDialog` "Keep it" / "Yes, withdraw it"; afterwards a success `Alert` and focus on the `h1`). "What you sent" (`AnswersView` of the application's own version, with the form's name and version) and "History" (each status change in the API's words, with the advertiser's message). Answers deleted at the end of the retention period: one line says so; the record stays.
- The applicant's status words: Draft, Submitted, In review, More information needed, Shortlisted, Accepted, Not successful, Withdrawn (the API's `status_label` first). Never another applicant, a note or who reviews it.

### Received applications (`applications/received-applications.tsx`, `/agent/applications`, `/agent/applications/<id>`)

- **Inbox** (`OrganisationShell`): "Application forms" and "Your listings" links; status links with counts; a GET filter form that works without JavaScript (Search, Status and Listing as `SearchableSelect`s, the organisation as a hidden field, "Show"); a status line; cards (status badge, when sent, the applicant's name as the link, the listing, the reference); `Pagination`. Empty: "No applications yet" (with how to start taking them), "No applications match these filters" with "Clear filters", "There is no page 3".
- **Application:** status and reference, the applicant's name as `h1`, the listing and when sent, and a line that opening it and its files is recorded in the activity log (`APPLICATION_VIEWED`, `APPLICATION_FILE_VIEWED`). "Answers" in the submission version's layout with hidden questions listed apart; files open through the organisation's file route. Side column: "Contact" (email and phone links, 44px), "Status" (only the moves the API allows from where it is: Start the review, Shortlist, Accept, Decline as radio rows, an optional note, "Change the status"; Accept and Decline are final and confirmed; a 409 `INVALID_APPLICATION_TRANSITION` says it changed meanwhile and reads it again), "Ask for more information" (while allowed; required message the applicant sees and is emailed), "Notes" ("Only your team can see notes. The applicant never does."), "History".
- A 404 says who can open applications: the organisation's owner and managers and the agent assigned to the listing.

## Venues let by the hour (`venues/*`, `agent/hourly-settings.tsx`, `lib/venue-*.ts`, API 0.33.0)

Showrooms, venues, halls, studios and meeting rooms let by the hour (BR-007, FR-023 to FR-025). **Enquiry mode only**: a request waits for the host, nothing is held until the host confirms it, and no payment is taken or implied. Never write "booked" or "reserved" about a request and never show a pay button. Which property types can be let by the hour is the `hourly_bookable` flag of the `property_types` reference set; nothing in the app lists them. Hourly bookings are their own service type and never appear among viewings and consultations (FR-022).

The pure logic is in `lib/venue-time.ts` (wall clock and instants, slot and duration choices), `lib/venue-quote.ts` (quote rows), `lib/venue-settings.ts` (the settings form and its checks) and `lib/venue-bookings.ts` (statuses, allowed actions, the free cancellation window, refusals), tested by `npm test`. Their normalisers follow the contract's response shapes and tolerate older or partial answers.

- **Time zones.** Every time is shown in the venue's IANA zone, and the zone is named: "Saturday 5 December 2026, 10:00 to 14:00 (Africa/Harare time)". When the viewer's own clock reads differently at that moment, a second line says "That is 08:00 to 12:00 your time (Europe/London)." Slots are built on UTC instants, so a day when the clocks change has as many hours as it really has; a clock time that happens twice is labelled with its offset ("01:00 (UTC+01:00)").
- **Money** is the API's exact decimal string with its currency code ("USD 1,230.00"); digits are only grouped, never recomputed. A quote that mixes currencies is not shown.

### Hourly booking section (`agent/hourly-settings.tsx`, in `ListingEditor`)

"Hourly booking", after Video tour and before Applications, only for an eligible property type (from the reference flag; where the reference data has no flag, the API's `eligible` decides). Saved with its own secondary button, "Save the hourly booking settings" (a full `PUT …/hourly`), apart from the listing's autosave, because these are operational settings that reach the public page at once and are not reviewed.

- A status badge (Taking requests / Switched off), the zone the times are in, when it was last saved; "Take hourly booking requests" (checkbox).
- Rate per hour; Currency (a `SearchableSelect` of the market's currencies, from the API's `currencies`); "Bookings are made in blocks of" (15 min, 30 min, 1 h); Cleaning time between bookings (none to 4 h, every 15 min); Shortest and Longest booking (multiples of the block; changing the block rounds them up); Bookings at the same time; Deposit (optional, "payable to the host if confirmed").
- **Opening hours editor**: one row per weekday, Monday first. Each range is two `SearchableSelect`s ("Opens", "Closes", on the block's grid; closing may be 24:00) and a 44px Remove button named with the day and times. "Open on Monday" / "Add hours on Monday" adds a range after the last. A day with no range reads "Closed". Each range is checked in place: a real time, closing after opening, on the grid, and not overlapping another range of its day ("It overlaps 08:00 to 12:00 on Monday.").
- **Dates with other hours**: date, "Closed all day", or Opens and Closes, and an optional note customers see; "Add a date".
- **Fees and taxes**: name customers see, code (TAX for a tax), how it is charged (Percentage of the subtotal, Fixed amount per booking, Amount per hour), amount, first and last day it applies. Two charges with one code and overlapping dates are refused.
- **Cancellation and notice**: the policy text, free cancellation hours, notice needed (lead time) and how far ahead (1 to 365 days).
- The whole form is checked before sending, with the API's own field paths (`opening_hours[2]`, `fees[0].amount`), so the API's errors land in the same places. A failed check is a danger `Alert` counting the problems and focus moves to the first. Read-only for anyone who may not edit the listing.

### Book by the hour (`venues/book-by-the-hour.tsx`, on the listing page)

A client island in the main column after the features: the page stays cached and the same for everyone. Signed out or in, the free times are read in the browser (`GET /v1/venues/{id}/availability`, 62 days at a time; "Show later dates" reads the next span up to the horizon). Hourly booking switched off (404) shows nothing.

- Before the grid: the rate ("USD 50.00 per hour"), shortest and longest booking and the block, the deposit, and the zone the times are in.
- **Time-slot picker** (`SlotPicker`, `venues/slot-picker.tsx`): a `NightCalendar` where only days with a free start can be chosen (others are struck through and `aria-disabled`), a native date field doing the same (a closed day says why, with the exception's note), then "Start time" and "How long" as `SearchableSelect`s built from the answer: a start is offered when the shortest booking fits inside one open range and overlaps no booked range (the API's booked ranges already hold the cleaning buffers); lengths run from the shortest to the longest that fits and is free ("2 h 30 min, until 12:30"). Starts before `bookable_from` are not offered.
- A complete choice is quoted at once (`POST …/quotes`): "Your estimate" with the time (and the visitor's own), each line in the API's words, "Estimated total", the deposit apart ("Deposit, payable to the host if confirmed") and the API's no-payment notice, then how long the estimate is held. A refused time is a warning `Alert` with the reason in words (closed, already booked, too close to another booking, too soon, too far ahead), and the free times are read again.
- The cancellation policy in a `details`. Signed in: People attending (optional), Message to the host (optional, 1,000 characters), the privacy consent, one line that this is a request and not a booking, and "Send booking request". Signed out: "Sign in to send a booking request", which returns to the listing with the chosen time in the address (`book_date`, `book_start`, `book_minutes`, read only in the browser).
- The receipt (focused, `role="status"`): "Booking request sent. Keep this reference: VB-…", the time, **the time is not held until the host confirms it**, and "See your hourly bookings". An expired estimate is quoted again and the visitor sends again.

### VenueBookingCard and the lists (`venues/venue-booking-card.tsx`, `venues/venue-booking-lists.tsx`)

- **Card**: "Hourly booking" and status badges (the API's `status_label`), the reference; the time as the heading with its length; the viewer's own time when it differs; what the status means for this viewer; a proposed time as a highlighted line saying who proposed it; the venue (linked), the estimate and deposit, people attending, the message, the reason when cancelled or declined; "The estimate, line by line" and "Cancellation policy" as `details`; the actions; "History" (a `details` that reads the single booking the first time it is opened: each event, who, when in the venue's zone, and the time it was for).
- **Actions come from the API's `actions`** (the state machine otherwise). Every one except Accept opens a step in place with "Keep as it is"; buttons are 44px. A 409 is explained: `SLOT_TAKEN` is "Another booking for this time was confirmed first. Propose another time to this customer, or decline the request." (the customer reads that the time cannot be accepted); `SLOT_UNAVAILABLE` gives the reason; `INVALID_BOOKING_TRANSITION` says the booking changed and reads the list again.
- **`/account/venue-bookings`** ("Hourly bookings" in `ActivityNav`): "Upcoming and waiting" and "Past and cancelled" as a `ChipNav`. Accept the new time (a host's proposal) and Cancel (reason optional). The cancel step says whether it is inside the free window and until when ("Free cancellation: you are inside the free window, which ends …" in success text, or "The free cancellation window ended …. The host's policy applies." in warning text), then the policy.
- **`/agent/venue-bookings`** (Principal and Managers of an organisation, the assigned agent, and approved Landlords and Property Sellers (Vendors) for their own listings, at `/v1/me/hosted-venue-bookings`): "Bookings for" (a `SearchableSelect` when there is more than one: each organisation and "Your own listings"), "List" and "Day view" as two toggle buttons (`aria-pressed`, in the address with `view`, `date`, `scope`). The list has a filter form (Venue and Status as `SearchableSelect`s, From and To dates, "Show"). The day view has previous and next day (44px, labelled), the day field and "Today", then a schedule per venue in time order (time, the customer as a link to the card, status, people) above the full cards. Host actions: Confirm (or "Confirm the new time"), Propose another time (the `SlotPicker` for that venue, quoted before it is sent), Decline (reason required), Mark as completed and Customer did not arrive (after the end), Cancel (reason required). The customer's name and email appear only here. A 403 or `ORGANISATION_NOT_FOUND` is the "You cannot see hourly bookings here" state.
- States: loading skeleton, signed out (`RequireAuth`), error with "Try again", empty (with "Find a venue" for a customer with nothing waiting).
- Links: "Your hourly bookings" and "Hourly bookings received" in the account menu; "Hourly bookings received" on the account page.

## Books (`agent/books/*`, `lib/ledger.ts`, API 0.34.0)

An organisation's own books (FR-026 to FR-029, BR-012): a cashbook, not double-entry, private to the organisation and separate from its RightProperty365 subscription invoices. OWNER and MANAGER read, record, correct, reconcile, export and manage categories; an AGENT records and may reverse or correct only their own entries that are not reconciled; Agency Staff read. Every page is `noindex, nofollow`, read in the browser with the session, and reflows at 320px (tables scroll inside their own focusable `region`). The pure rules (type, method and status words, the amount check per currency, exact formatting, per-currency grouping and sums, filters in the address and the API query, chips, permissions, entry links, the form body, the tolerant readers of every answer) are in `lib/ledger.ts`, checked by `npm test` (`scripts/ledger.test.mjs`).

Two wording rules are absolute:

- **Status.** Exactly two badges: "Recorded by you, not verified" (`warning`) and "Marked reconciled by your team" (`success`). Any other status, the reserved `GATEWAY_CONFIRMED` included, shows the first. Never "verified", "confirmed", "paid" or anything bank- or gateway-like; reconciliation is explained as "someone in your team checked this entry against your own statement. RightProperty365 does not see your bank and verifies nothing."
- **Currencies.** Every amount carries its currency code ("USD 1,234.50", "JPY 1,500", "KWD 1,000.000"): the API's exact decimal, padded or trimmed to the currency's minor units, only grouped, never rounded. Amounts in different currencies are never added together: one table per currency, and every list and report says "Currencies are never added together".

Money in and out is never shown by colour alone: separate "Money in" and "Money out" columns, a "+" or "−" sign, "Money in: " / "Money out: " for screen readers, and `DirectionTag` (an arrow icon and the words).

### BooksShell and BooksBanner (`books/shared.tsx`)

As `ContactsShell`: `BackLink`, `h1`, then the info banner (a 4px `info` bar on `info-soft`, with a book icon): "Your organisation's own books. Separate from your RightProperty365 subscription invoices. Entries you record are marked 'Recorded by you, not verified'." Then the organisation from `?org=` (an "Organisation" `SearchableSelect` when there are several), the name and role line ("you can read the books but not record entries" for Agency Staff), and "Entries", "Reports" and (OWNER, MANAGER) "Categories" as a `ChipNav` named "Books sections". States: loading, error with "Try again", "The books belong to an organisation", signed out, no access. Content keyed by organisation.

### StatusBadge, DirectionTag, SignedAmount (`books/shared.tsx`)

`StatusBadge` takes the API's status and shows only the two wordings above. `SignedAmount` is "+USD 100.00" / "−USD 100.00" with the direction for screen readers. `DirectionTag` is the arrow and "Money in" / "Money out".

### ContactPicker (`books/shared.tsx`)

A `fieldset` named "Contact (optional)": "Chosen: Rudo Moyo" or "No contact chosen.", "Find in your contact book" (search field, Enter searches without sending the form) with "Search" (secondary), a polite line with the result count, then a "Contact" `SearchableSelect` of the matches with "No contact" first. Works inside a GET form (`name`). Used by the entry form, the entry filters and the statement report.

### TableRegion (`books/shared.tsx`)

The data-table pattern of the contact import, made reusable for the books: a focusable `role="region"` named "… scrolls sideways" that scrolls on its own; inside, a `table` with a caption (visible or `sr-only`), `scope="col"` headers, the entry as the row header, numbers right-aligned in `tabular-nums`. The page never scrolls sideways.

### Entry list (`books/entry-list.tsx`, `/agent/books`)

"Record an entry" (primary), "Record a transfer" and "Opening balance" for writers; "Export entries as CSV" for the OWNER and MANAGER (the current filters; a success `Alert` says it is recorded in the activity log). A GET filter form that works without JavaScript: Search, Currency, Type, Category, Method, Status (the two wordings), From and To (effective date), Listing, each a `SearchableSelect` or date field, the `ContactPicker`, and "Hide reversed entries and their reversals". "Filters in use" chips and "Clear all". A status line and "Amounts are shown in their own currency. Currencies are never added together." The table: Date, Entry (the description as the link, reference, contact, and the markers "Reversed", "Reversal", "Correction" with links "Reversed by the entry", "Reverses the entry", "Correction of the entry", "Corrected by the entry", "Other half of this transfer"), Type and category, Method (and branch), Money in, Money out, Status. A reversed entry's row is on `sunken`. `Pagination`. Empty: "No entries yet" (with "Record an opening balance"), "No entries match these filters", "There is no page 5 of these entries".

### EntryEditor (`books/entry-form.tsx`, `/agent/books/new`)

"Money in or out", "Transfer" and "Opening balance" as a `ChipNav` (`?kind=`). One form: Type (`SearchableSelect`; each type says its direction), Money in or out (text when the type fixes it; radio rows otherwise, "Money held (in credit)" / "Overdrawn (owed)" for an opening balance), Category (active categories, plus the current one marked "(no longer used)"), Method (From, for a transfer; To and To branch), Amount (`inputMode="decimal"`; the hint names the currency's decimals: "In JPY: a whole number, no decimal places."), Currency, Date, Reference, Description, Contact (`ContactPicker`), Listing, Branch, Notes. An info `Alert` explains transfers ("recorded as two linked entries") and opening balances ("one per currency, method and branch… reverse it and record it again"). Checked before sending with the words under each control; the API's field errors land in the same places; a danger summary with a 4px bar (`role="alert"`, focused) links to each control.

### Entry page (`books/entry-detail.tsx`, `/agent/books/<id>`)

- Head: type and status badges, markers, the description as `h1`, the signed amount with `DirectionTag`, the date, who recorded it and when. An info `Alert` on a reversed entry; the linked entries as a `nav` of 44px links.
- Main column: "Details" (`dl`), the correction form when open, "Attachments" (PDF, JPEG, PNG or WebP, 10 MB, checked before upload; a progress bar; each file with "Download <name>", downloaded through the API and audited), "Notes" (append-only, "Only your team can see notes."), "History" (made from the entry and its related entries: recorded, reconciled, reversed and corrected with the reason, payments against it, notes and attachments, each with who and when and a link to the linked entry; a line says the team's activity log holds the full audit). "Linked entries" lists each related entry ("Its reversal", "The entry it corrects", "Other half of this transfer", "A payment against it") with its date and signed amount.
- Side column: "Reconciliation" (the badge, what it means, who marked it and their note; for the OWNER and MANAGER a note and "Mark as reconciled" / "Mark as not reconciled"); "Correct" ("Correct the entry" opens the form pre-filled, with an info `Alert`: "The original entry stays in your books. Saving creates a reversal of the original entry and this corrected entry, linked to both."; a required "Why is it being corrected?"; afterwards the corrected entry opens); "Reverse" (a required "Why", then a `ConfirmDialog` "Keep it" / "Yes, reverse it"; afterwards the reversal opens). Opening balances and transfers are reversed, not corrected. When the person may do neither, one line says who can.
- Each change answers in a polite live region and reads the entry again, keeping it on screen meanwhile. A 404 is "We could not find that entry".

### Reports (`books/reports.tsx`, `/agent/books/reports`)

"Cashbook", "Categories", "Contact statement" and "Receivables ageing" as a `ChipNav` (`?report=`), the note "Each currency has its own table. Currencies are never added together, so there is no combined total.", and a period form (From, To; Currency and "Also show each method" for the cashbook; the `ContactPicker` for a statement), "Show the report". Export buttons (cashbook, categories, statement) only for the OWNER and MANAGER.

- **Cashbook:** per currency an `h3` and a table: Opening balance, the period's entries (Money in and Money out columns named with the currency), Totals for the period and Closing balance in its footer; with "each method" a second table per currency (Opening, Money in, Money out, Closing per method).
- **Categories:** per currency, each category's money in and out, and the total in that currency.
- **Contact statement:** per currency, brought forward, the entries, totals and balance.
- **Receivables ageing:** "Show" owed to you (receivables) or owed by you (payables). Per currency, 0 to 30, 31 to 60, 61 to 90 and Over 90 days and the total open, then a table of each open amount (due, entry, amount, paid so far, still open, age). Overdue tenancy rent is in the totals (API 0.36.1); a line under the buckets gives its part (`rent_outstanding`) and links to `/agent/arrears`, where it is listed by tenancy.

Cashbook and statement rows show the API's column figures and running balance: a reversal is a negative figure in the column of the entry it reverses, so the columns add up to the totals.

### Amounts owed and payments

"Owed to you (receivable)" and "Owed by you (payable)" are types of the entry form that record an amount owed: no method, and they never move a cashbook balance. On such an entry's page, "Record a payment against it" opens the form (`/agent/books/new?settles=<id>`) as money in or out against it, in its currency, with its category, contact and listing; an info `Alert` names what it settles.

### Options and the personal book

The form reads `GET …/ledger/options`: the types with their fixed direction and default category (choosing a type brings its category), the currencies' minor units for the amount check, and the categories by kind (IN, OUT or ANY: only those matching the direction are offered). When it cannot be read, the form falls back to the rules in `lib/ledger.ts`. Someone with no organisation who is an approved direct owner gets "Your own books" (the book id is their user id), offered only when the API answers for it. A 409 `LEDGER_OPENING_BALANCE_EXISTS` links to the opening balance already recorded.

### Categories (`books/categories.tsx`, `/agent/books/categories`)

OWNER and MANAGER: "Add a category" (Name, "Used for" `SearchableSelect`: money in and out, in, or out) and per category "Rename <name>" with "Save the name" and "Deactivate <name>" / "Use <name> again" (ghost). Each row has "In use" or "Deactivated", its direction and "Default" badges. Everyone else reads the list with an info `Alert`. A used category is never deleted; deactivating keeps it on the entries already recorded.

Links: "Books" in the account menu (professionals) and in "Your workspace" on the dashboard (organisation members).

## Notifications (`account/notification-*.tsx`, `account/notifications-provider.tsx`, `lib/notifications.ts`, API 0.35.0)

The in-app record of what happened on a person's requests, appointments, applications, listings, team and account. The website registers no device and sends no web push; push goes to the mobile app. Every rule that can be a pure function is in `lib/notifications.ts` and tested in `scripts/notifications.test.mjs`.

### NotificationsProvider (`account/notifications-provider.tsx`)

The client context behind the bell, inside `AuthProvider` in the root layout, like `SavedListingsProvider`.

- Reads `GET /v1/me/notifications/unread-count` in the browser once a customer-scope session is known (Property Seekers and professionals; never an administrator session), then every 60 s **while the tab is visible**. A hidden tab does not ask; showing it again asks at once when a read is due.
- After failures in a row it waits 2, 4, 8, then at most 15 minutes, or longer when a 429 sends `Retry-After` (`pollDelay`). A 401 or 403 stops it until the session changes (`stopsPolling`).
- `unread`, `status` ("off", "loading", "ready"), `setUnread(n)` (the list knows better after marking read; not announced) and `refresh()`.
- It renders one visually hidden `role="status"` (`aria-live="polite"`) region, always in the page. It speaks only when the count **goes up** from a count already known ("You have 4 unread notifications"); the first count of a page and a count going down say nothing (`unreadAnnouncement`).
- Nothing is read on the server: public pages stay cached and identical for everyone.

### NotificationBell (`account/notification-bell.tsx`)

In `SiteHeader`, just before `AccountMenu`.

- A link to `/account/notifications`, 44 by 44px, the lucide `Bell` at 20px in `ink`, `sunken` on hover. Not a popover: the list is one tap away and works the same with a keyboard and a screen reader.
- Its accessible name carries the count: "Notifications, 3 unread", "Notifications, 0 unread", or "Notifications" before the first answer (`bellLabel`). The badge is `aria-hidden` so the number is not read twice.
- The badge: a `primary` pill with `on-primary` text, 20px tall, with a 2px white ring, at the top right of the icon. "1" to "99", then "99+"; none at 0 (`unreadBadgeText`). The number says it, not the colour.
- Not rendered while the session loads, when signed out, or for an administrator session. It reads nothing from the address, so the layout stays prerendered.
- At 320px the bar holds the logo (shrunk), the bell, the account icon and the menu button, each 44px, with no sideways scroll.

### NotificationList (`account/notification-list.tsx`, `/account/notifications`)

`noindex, nofollow`; read in the browser with the session cookie; inside Suspense because it reads `?page` and `?unread=1`.

- Order: `h1` "Notifications" with a "Notification preferences" link beside it, one sentence on what is kept, a `ChipNav` named "Show" ("All", and "Unread" with its count), "Mark all as read" (secondary, only while something is unread), a status line ("12 notifications, 3 unread, page 1 of 2, newest first"), the list, `Pagination`.
- **Unread**: a `primary` "New" badge, a 4px `primary` bar on the left, a `tint` panel, a semibold title with "(unread)" for screen readers, and a ghost "Mark as read" button (with the title for screen readers; "Marking as read…" while it runs). **Read**: a neutral "Read" badge, a white panel, a regular title. The state is in words and weight, never colour alone.
- The time: relative words, then the absolute date and time ("2 hours ago · 19 Nov 2026, 14:05"), in a `time` element; the date alone after about a month (`relativeTime`).
- **Links**: the title is a link only when the API's `link` is a path on this site (`safeNotificationLink`: it starts with one `/`, with no `//`, scheme, backslash or control character). Anything else, an absolute URL included, is plain text and never followed. An API path with no page of its own here yet opens its list (`notificationHref`: `/account/appointments/{id}` opens "Your appointments", `/agent/enquiries/{id}` the inbox's business enquiries, `/account/hourly-bookings/{id}` "Your hourly bookings", `/account/subscriptions/{id}` "Subscription"). Following a link marks the notification read (sent with `keepalive`, so it finishes as the page changes).
- After "Mark as read" or "Mark all as read" the status line says what happened and the bell is updated. In the "Unread" view the item leaves the list, the page is read again and focus moves to the `h1`. A failure is an `Alert` under the item, or under the buttons.
- States: loading skeleton (also the Suspense fallback), signed out (`RequireAuth`), error with "Try again", empty ("You have no notifications yet"), nothing unread ("You have no unread notifications" with "See all notifications"), and a page past the end ("There is no page 3 of your notifications" with "Go to page 1").

### NotificationPreferences (`account/notification-preferences.tsx`, `/account/notification-preferences`)

`noindex, nofollow`.

- Order: `BackLink` "Notifications", `h1` "Notification preferences", one sentence, the note that in-app is always on, "Push notifications need the mobile app" (a `sunken` panel with `AppLinks`, rendered on the server), "You choose", "Always sent", then "Save preferences".
- Each type is a `fieldset` whose `legend` is the API's `label`, with three native checkboxes, each in a 44px label: "In-app (always on)" checked and disabled, "Email" and "Push".
- **Essential types** (account, security, contracts, invoices) sit under "Always sent": Email and Push are checked and disabled, with a lock icon and the reason (`essentialReason`: the API's own when it sends one; otherwise "Always on. Needed for your account's security." for `ACCOUNT` and `SECURITY`, "Always on. Invoices for your subscription are always sent." for `SUBSCRIPTION_INVOICE`, and "Always on. Needed for your account's security and contracts." for any other). The reason is linked to the controls with `aria-describedby`. They are never sent in a save.
- One "Save preferences" (primary, `lg`) sends only the types that changed (`changedPreferences`). Beside it a polite line counts unsaved changes. Success: "Your preferences are saved. They apply from the next notification we send." Nothing changed: an info `Alert`. A 400 applies nothing: a danger `Alert` says so and, when its `fields` (keyed by position, `items[0].push`) name a sent type, the API's words, without their code, sit under that type, whose panel gets a `danger` border (`preferenceErrorsByType`). The save sends `X-Client: web`, which the API records as the change's source.
- At 320px the checkboxes wrap under the type's name.

Links: "Notifications" and "Notification preferences" in the account menu and on the account page; the bell in the header.

## Properties and tenancies (`agent/property/*`, `account/my-tenancies.tsx`, `lib/tenancies.ts`, API 0.36.0)

Phase 2 part (a) (BR-019, FR-047): the properties a book manages, their units, and the tenancies on them. A book is an organisation, or an approved direct owner's own properties ("Your own properties", offered only when the API answers for it), as in the contact book and the books. OWNER, MANAGER and AGENT change; Agency Staff read (the API's `can` decides where it sends one). Every page is `noindex, nofollow`, read in the browser with the session, and reflows at 320px. The pure rules (frequency and due-day words, status words and tones, the date, unit and form checks, the request bodies, the API's field errors under their controls, filters in the address and the API query, who may do what, the status timeline, the tolerant readers of every answer) are in `lib/tenancies.ts`, checked by `npm test` (`scripts/tenancies.test.mjs`). Money is formatted by `formatLedgerAmount` (`lib/ledger.ts`): the API's exact decimal with its currency code, never rounded; the deposit is in the rent's currency, and currencies are never added together.

### ManagementShell and ManagementNav (`property/shared.tsx`)

As `BooksShell`: `BackLink`, `h1`, one line of intro, then the book from `?org=` (an "Organisation" `SearchableSelect` when there are several), the name and role line ("you can read the properties and tenancies but not change them" for Agency Staff), and on the list pages "Properties", "Tenancies" and "Arrears" as a `ChipNav` named "Property management sections". States: loading, error with "Try again", "Properties belong to an organisation or a landlord", signed out, no access. Content keyed by book.

### Property list (`property/property-list.tsx`, `/agent/properties`)

"Add a property" (primary) for writers; a GET search form (name or address) that works without JavaScript; a status line; cards with the name as the link, address and country, and badges: "3 units" or "Let as a whole", "1 of 3 units let" / "Let" / "Not let" (from `occupied_units` of `lettable_units`), "Linked to a listing". `Pagination`. Empty: "No properties yet", "No properties match that search", "There is no page 5 of these properties".

### New property and `PropertyDetailsFields` (`property/property-new.tsx`, `/agent/properties/new`)

Name, Address, Country (`SearchableSelect` of the API's countries, the organisation's market first chosen), Notes (optional), Listing (optional `SearchableSelect` of the person's listings, "No listing" first). Units: a list of fields, each with a 44px "Remove unit 2" button, and "Add a unit"; none means let as a whole. Checked before sending (names 200, addresses 500, labels 80 characters, labels unique ignoring case); the API's field errors land in the same places; a focused danger summary with a 4px bar links to each control. Success opens the property.

### Property page (`property/property-detail.tsx`, `/agent/properties/<id>`)

- Head: the name as `h1`, address and country, the linked listing, the occupancy badge.
- Main: "Units" (each with "Let" / "Not let" and, for writers, "Rename" (an inline field with "Save the name" / "Cancel") and "Remove" (a `ConfirmDialog`, "Keep it" / "Yes, remove it"; the API refuses a unit a draft or active tenancy uses and its message is shown in the dialog); "Add a unit" with its own field). Each change uses its unit route, answers in a polite live region and reads the property again. "Tenancies": this property's tenancies with status, unit, rent and dates, and "Start a tenancy" (opens the form with the property chosen).
- Side: "Details" (`PropertyDetailsFields`, "Save the details"); "Delete the property" (danger, behind a `ConfirmDialog`), or one line saying it cannot be deleted while a draft or active tenancy uses it.
- A 404 is "We could not find that property".

### Tenancy list (`property/tenancy-list.tsx`, `/agent/tenancies`)

"Start a tenancy" (primary) for writers; the statuses as a `ChipNav` ("All", Draft, Active, Ended, Terminated early) with the API's `status_counts` (they ignore the status filter, so every chip has its count); a GET filter form that works without JavaScript: Property (`SearchableSelect`, "All properties" first) and "Tenant or landlord" (the books' `ContactPicker`, submitted as `contact`), "Show tenancies", and "Clear filters". The API has no free-text search of tenancies. A status line, then a `TableRegion`: Tenants (the link, and the reference when there is one), Property (and unit), Rent ("USD 950.00 a month, due on the 1st of each month"), Dates (start, then "to …" or "No end date"), Status badge. `Pagination`. Empty: "No tenancies yet", "No tenancies match these filters", "There is no page 3 of these tenancies".

### ContactsPicker (`property/shared.tsx`)

`ContactPicker` for several contacts. A `fieldset` named by its legend ("Tenants", "Landlords (optional)"), the hint or error under the legend (linked with `aria-describedby`), then the contacts chosen as a list, each with a 44px "Remove tenant Rudo Moyo" button, or "No tenants chosen yet."; "Find in your contact book" (search field; Enter searches without sending the form) with "Search" (secondary); a polite line with the result count (or "No contacts match that search. Add a contact to your contact book first." with the link); then an "Add a tenant" `SearchableSelect` of the matches not yet chosen. Choosing one adds it at once and says so in the polite line.

### New tenancy (`property/tenancy-new.tsx`, `/agent/tenancies/new`)

Four cards. "Property": Property (`SearchableSelect`), then Unit (`SearchableSelect`, required when the property has units; "Let now" on a unit with an active tenancy) or one line saying the tenancy is for the whole property. "Parties": Tenants (1 to 10) and Landlords (0 to 10), each a `ContactsPicker`; nobody may be both. "Terms": Rent (`inputMode="decimal"`, the hint names the currency's decimals), Currency, How often (Weekly, Monthly, Quarterly, Annually), Due on (Monday to Sunday for weekly rent, 1st to 31st otherwise, "the last day in shorter months" from the 29th), Deposit (optional, in the rent's currency), Start date, End date (optional: a tenancy with none runs until notice is given; it must be on or after the start). "Lease and notes": Lease (optional `SearchableSelect` of the book's leases, "No lease" first) and Notes. Checked before sending in the words under each control; the API's field errors (`rent.amount`, `tenants[0]`…) land in the same places; a focused danger summary links to each. "Save as a draft" opens the tenancy.

### Tenancy page (`property/tenancy-detail.tsx`, `/agent/tenancies/<id>`)

- Head: the status badge (the API's `status_label`), the tenants' names as `h1`, the property (a link unless it was deleted), unit and rent in words, and one sentence on what the status means.
- Main: "Parties" (tenants and landlords, each a link to the contact; a contact deleted or merged since keeps its last name with "No longer in the contact book"), "Terms" (`dl`: rent, how often, due, deposit, starts, ends or agreed end, ended on and why, lease), "Notes" (when there are any), "Rent" (below), "Status timeline" (an `ol`: created, activated and ended, each with when and by whom, the day it ended and the reason; only steps the API dates; never invented), "Maintenance" and "Inspections" (below).
- Side: "Activate" for a draft ("Activate the tenancy", then a `ConfirmDialog` with the parties and terms, "Not yet" / "Yes, activate it"). A 409 `UNIT_OCCUPIED` closes the dialog and shows the API's message with a link to the tenancy that is active there. "End the tenancy" for an active one: End date and "Why is it ending?" (required, 500 characters), checked first, then a `ConfirmDialog` ("Keep it running" / "Yes, end it") that says when an end before the agreed date is recorded as terminated early. "Delete the draft" for a draft (danger, `ConfirmDialog`). After each, the tenancy is read again.
- A 404 is "We could not find that tenancy".

### Rent (`property/rent-section.tsx`, `property/rent-view.tsx`, `lib/rent.ts`, API 0.36.1)

Part (b): the schedule of dues the API generates on activation, receipts, waivers, the statement and arrears. Every amount carries its currency code; a tenancy has one currency (its rent's) but every total is still per currency and nothing adds two currencies. A payment is what the team recorded: its ledger entry reads "Recorded by you, not verified" (the ledger's `StatusBadge`), never a bank's confirmation, and the section says so in its first line. The pure rules (exact decimal sums and comparisons with `BigInt`, due status words, oldest-first allocation and the checks on a chosen one, the receipt and waive forms and bodies, the API's field errors under their controls, ageing buckets and grouping per currency, the statement query, the tolerant readers) are in `lib/rent.ts`, checked by `npm test` (`scripts/rent.test.mjs`).

- **Summary** per currency (the API's `summary`, or made from the dues): "Overdue" with how many due dates have passed unpaid, "Outstanding to date" (due so far, paid, waived), "Next due"; "Paid in advance" when there is any; the schedule's rule in the API's words and how far it runs.
- **Schedule**: a `TableRegion` (due date with its period, amount, paid, outstanding, status). The status is a badge in words, never colour alone: "Due", "Overdue", "Part paid", "Part paid, overdue", "Paid", "Waived" (the API's `overdue` flag decides), with the days overdue, or the waived amount, date, who and why. Writers get "Waive" on a due the API marks `can.waive`: a `ConfirmDialog` with "Why is it waived?" (required, 500 characters), "Keep it due" / "Yes, waive it". A due paid or waived meanwhile (409 `RENT_DUE_NOT_WAIVABLE`) closes the dialog and reads the schedule again.
- **Record a payment** (writers; active tenancies, and ended ones with rent open): Amount with the rent's currency fixed beside it (no currency choice: the API refuses another), How it was paid (`SearchableSelect`: Cash, Bank, Mobile money, Other), Received on (not in the future, not before the start), Reference (optional, 120), Paid by (`SearchableSelect`, only with several tenants), then "What it pays" as two radio cards: "Oldest first" (the default; a preview lists the due dates it will pay) or "Choose the due dates" (an amount per open due, with "Allocated USD 500.00 of USD 950.00" as it is typed). Checked before sending, exactly: each line a valid amount in the currency's decimals and at most that due's outstanding, together exactly the payment, and never more than the whole schedule's outstanding. The API's errors land under the same controls (`allocations[1].amount` under that due); 409 `RENT_DUE_CHANGED` reads the schedule again and says so. Success names the amount and links to the entry in the books.
- **Payments received**: a `TableRegion` (received on, from whom, amount, method, reference, the dues it paid, "In the books": "Open the entry", its ledger status, and "Open the reversal" once undone). "Undo" (the API's `can.reverse`) reverses the ledger entry: a `ConfirmDialog` explains that the entry stays in the books marked reversed, a reversal entry with the opposite sign is created beside it, the rent it paid shows as outstanding again, and a reversal cannot be undone; "Why is it being undone?" is required. An undone payment shows "Undone (reversed)" with its date and its amount struck through (and "Undone:" for screen readers). On a receipt's entry in the books, "Correct" is not offered (the API refuses it): an info alert says to reverse and record again, and links to the tenancy.
- **Statement**: From and To (default the start date to today), "Show the statement", "Download as CSV" and "Download as PDF" (the API's file name), then one block per currency: brought forward, rent charged, paid, balance at the end, waived, undone and overdue when any, and a `TableRegion` of the lines (date, what with the reference, owed more, paid or waived, running balance).
- States: a draft says the schedule is made on activation; loading; error with "Try again"; "No rent due dates yet"; "No payments recorded yet"; "Nothing in this period".

### Arrears (`property/arrears.tsx`, `/agent/arrears`)

"Arrears" joins "Properties" and "Tenancies" in the section links. Rent past its due date and still outstanding, one section per currency (never combined): the four buckets (0 to 30, 31 to 60, 61 to 90, Over 90 days) and the total, then a `TableRegion` with a row per tenancy, most overdue first: the tenants (a link to the tenancy), property and unit, each bucket ("—" when nothing), the total and the oldest due date with its days overdue. A line says the same figures feed the receivables report in the books, with a link. Empty: "No rent is overdue" with "See active tenancies".

### Inspections (`agent/inspections/*`, `property/inspections-section.tsx`, `account/my-inspections.tsx`, `lib/inspections.ts`, API 0.36.3)

Part (d): move-in, routine and move-out inspections of a property (a unit, a tenancy), with a checklist copied from a template, a finding per item, notes and photos, completion that freezes it, and a PDF report. "Inspections" joins the section links after "Maintenance", and the account menu and "Your workspace". OWNER, MANAGER and AGENT change; Agency Staff read (the API's `can` decides). The pure rules (type, status and finding words, the scheduled time on the inspector's clock sent as UTC, the checklist editor, completion readiness and what is missing, photo checks, what a save sends, the filters, the tolerant readers) are in `lib/inspections.ts`, checked by `npm test` (`scripts/inspections.test.mjs`).

- **List** (`/agent/inspections`): "Schedule inspection" (primary) for writers; "All", "Upcoming" (scheduled from today) and "Past" as a `ChipNav`; a GET filter form that works without JavaScript: Status, Type and Property (`SearchableSelect`s), "Show inspections", "Clear filters". A `TableRegion`: when (the link, in the viewer's time zone, with the reference), property with unit and tenants, type badge, status badge ("Overdue" too when an open one's time has passed), "12 of 32 items checked". `Pagination`. Empty: "No inspections yet", "No upcoming inspections match", "There is no page 3 of these inspections".
- **Schedule** (`/agent/inspections/new`, `?property=&unit=&tenancy=&type=` from a tenancy): "Where" (Property, Unit or "the whole property", Tenancy, drafts included: a move-in usually comes before activation) and "What and when" (Type with one sentence on it, Day, Time with "In your own time zone (Africa/Harare)", a line repeating the time chosen, Inspector (the organisation's members, "You" first), Checklist (the templates, with their areas and items counted)). The day and time are the inspector's clock, sent as UTC (`localToUtc`). Errors as the other forms (focused summary, messages under the controls).
- **Inspection page, open** (`/agent/inspections/<id>`): head with status, type, reference, "Move-in inspection, Tue 1 Dec 2026, 09:30", property, unit, template, tenancy link, inspector, and on a move-out the move-in it is compared with. Side (first on phones): "Progress" (`ProgressMeter`: "12 of 32 items checked", a bar, the counts per finding; the save state in a status line: "All changes saved at …", "Changes not saved yet", "Saving…", with "Save now"); "Complete inspection"; "Cancel the inspection" (a reason, then a `ConfirmDialog`). Main: one card per area (h2, "3 of 5 checked", 44px "Rename", "Move up", "Move down", "Remove area"), each item with its name ("Rename", "Remove"), on a move-out "At move-in: Needs attention. Cold tap drips slightly.", the finding as a segmented control of four radio buttons (OK, Attention, Damaged, N/A; two by two under 640px; the chosen one filled, with its full words for screen readers), "Clear the finding", Note (optional), and Photos (thumbnails read with the session, "Delete" behind a `ConfirmDialog`; "Add photos": images only, previews, a progress bar each, the type and size problems in words, 6 per item; a new item gets photos once it is saved). "Add an item to Kitchen" under each area, "Add an area" at the end. Removing an area or item asks first.
- **Saving.** Changes show at once and are saved 1.5 seconds after the last one, or with "Save now": the structure (`PUT .../checklist`) when areas or items were added, renamed, moved or removed, then only the findings and notes that changed (`PUT .../findings`). One save at a time. Leaving with unsaved changes asks first (closing the tab, and links within the site). Someone else's change (`409 INSPECTION_CHANGED`) offers "Save now" or "Reload the inspection"; an inspection completed or cancelled meanwhile offers the reload only.
- **Complete inspection.** One paragraph says completing **freezes** it (nothing can change after) and makes the report available (to the tenant too when a tenancy is linked, who is told). The items still without a finding are listed as links to them ("2 items still need a finding"); areas with no items are named. Summary (optional), "Signed off for the manager by" (the signed-in name, editable) and "Tenant's name" (optional, typed names). "Complete inspection" saves what is left, then a `ConfirmDialog` with the counts ("Not yet" / "Yes, complete it"). A `409 INSPECTION_INCOMPLETE` lists the items the API names.
- **Inspection page, completed or cancelled** (and for Agency Staff): "Report" (completed when and by whom, the counts per finding, the summary, the sign-off names, "Download report (PDF)" under the API's file name, "nothing on it can change"), or why it was cancelled; the checklist read-only (finding badges in words, notes, photos, the move-in finding on a move-out).
- **Tenancy page**: an "Inspections" card after "Maintenance": the tenancy's inspections (status, type, reference, when as the link, inspector, progress), "See all", and "Schedule inspection" with the property, unit, tenancy and the type that fits filled in (move-in until one is completed, move-out once the tenancy has ended, otherwise routine).
- **Tenant** (`/account/tenancies/<id>`): "Inspections", the completed ones only, read-only (above).
- States everywhere: loading, error with "Try again", empty, "We could not find that inspection". Every page is `noindex, nofollow` and reflows at 320px.

### My tenancy (`account/my-tenancies.tsx`, `/account/tenancies`, `/account/tenancies/<id>`)

The tenant's own tenancies, read-only: those where a tenant contact's email is the person's verified account email (never a draft). The list: `h1` "My tenancy", one sentence on how a tenancy appears here, cards with the status, "Managed by Sample Estates", the property and unit as the link, the address, the rent and dates. Empty: "You have no tenancies here" with how to get one to appear and "Check your email address". The page: status, managed by, the property and unit as `h1`, the address, the status in the tenant's words, then "Terms", "Parties" (names only: the API sends no ids, emails or phones), the timeline only when the API dates any step, "Rent" (read-only: the summary, "What is due", "Payments recorded" without ledger links or controls, and the statement with its CSV and PDF downloads; one line says the landlord or agent records payments and nothing is confirmed by a bank), "Maintenance", "Inspections" (the completed ones, read-only, each a native `<details>` with the summary, sign-off names, "Download report (PDF)" and the findings per area with notes, photos and, on a move-out, what was found at move-in) and one line on who to ask to correct it. States: loading, error with "Try again", signed out, "We could not find that tenancy".

Links: "Properties", "Tenancies", "Maintenance" and "Inspections" in the account menu (professionals) and in "Your workspace" on the dashboard (organisation members); "My tenancy" in `ActivityNav` when there is one.

## Not built yet

Dialog, tabs, a reusable data table component (the contact import preview and the books' `TableRegion` are the table patterns so far), a reusable file upload control (beyond `DocumentUploader`, `FileQuestion` and the contact import field), a map search across the antimeridian. Specify each here before building it.
