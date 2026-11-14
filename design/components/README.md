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
- Order under the photo: price, the facts line, title, location. Price comes first and is the most prominent text (24px, weight 700).
- The facts line (`ListingFacts`) is bedrooms, bathrooms and area on one line: an indigo icon, the value in `ink` weight 600, the unit in `muted`. Missing values are left out rather than shown as a dash.
- **A short stay** leads the facts line with how many it sleeps ("Sleeps 8") and ends it with its shortest stay ("2 nights minimum") in place of the area. Its price says "per night".
- Tags on the photo, top left: the status tag (the deal type, "For sale" or "To rent") in `primary` with white text, then "New" on white, then "Featured" in `brand-accent` with `brand-deep` text. Tags are text on a solid fill, never text on the photo itself. Sponsored placements must be labelled.
- The whole card is one link, made by stretching the title link. There are no nested interactive elements inside it. On hover and keyboard focus it gains the `frame-brand` outline and a deeper shadow.
- `ListingPrice` always shows the listing's own ISO currency code ("GBP 185", "MUR 8,500"), because countries and currencies are mixed across the platform.

- A listing without a photo shows a neutral frame that says "No photo yet", never a placeholder picture.
- The place on a card is short: suburb and city ("Borrowdale, Harare"). The listing page adds the region, unless it has the city's name, and the country.
- **A place line is built from what the listing names** (`lib/places.ts`). The suburb and the region can be missing, and a city can be free text typed by the lister (a country with no reference places): a card without a suburb shows city and country ("Grand Baie, Mauritius"), and a listing that names no place has no place line. Never print an empty part, "null" or a doubled comma. A free-text place is plain text: it has no code, so it is never a link or a filter.
- Deal, suburb, city and price come from the API. What a rental is charged per ("per month", "per night") is the label of the API's `price_periods` set, passed in as `periods`. The card has no text of its own apart from "Featured", "New", "Sleeps" and "nights minimum".
- On results found with stay dates or guests, the link to a short stay carries them (`?check_in=…&check_out=…&guests=…`), so its request form starts from them. The listing's canonical address stays the plain one.

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
- The loading state is the same frame with the same heading and a block the height of the search, so nothing moves when the page arrives. There is no slideshow and nothing auto-plays.
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
- The numbers are rendered by the server and do not animate. Only show a count the API returns.

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
- Props: `first`, `last`, `today`, `kindOf(night)`, `canPick(day)`, `selected`, `ends` (what the two ends are called), `onPick(day)`, `showKinds` (write "Booked" and "Blocked" in the cells) and `legend`.

## StayCalendar (`availability/stay-calendar.tsx`)

"Availability" on a short-stay listing, under the features.

- Before the grid, in words: the shortest stay and how many it sleeps, the next available night, "Updated 14 November 2026." (or "The host has not updated the calendar yet."), and the time zone the dates are in ("Central Africa Time (Africa/Harare)"). Then: "This is the host's own calendar. … Choosing dates does not book or hold them."
- The grid is a `NightCalendar` over the booking window (today and the next year) with two kinds of night: available and not available. Why a night is not available is never public.
- Choosing a night sets the first night; choosing a later day sets the day of leaving, which may itself be taken (someone else arrives then) as long as every night before it is free. Anything else starts again. The choice fills in the request form (`StayProvider` shares it), a status line says it in words ("17–20 Nov 2026 · 3 nights chosen.") with a link to the form, and "Clear dates" undoes it.
- The calendar is read with the page (cached with the listing, so a change by the host can take a minute to show) and again in the browser when the API refuses a request because a night was taken.

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
- Five columns from `lg`: the logo with one sentence, then "Property", "Professionals" and "Account" link columns and "Countries with listings". Two columns from `sm`, one on phones. Each link column is a `nav` named by its heading; links are 44px tall on phones.
- "Professionals" lists every kind the API returns, by its label (Real Estate Agencies, Estate Agents, Solicitors and so on), then "Find a professional". If they cannot be loaded it shows that one link.
- "Countries with listings" links the six countries with the most listings to their result pages (`/listings?country=GB`), then "All countries". The API knows every country (249); the footer names only those with something to show. If they cannot be loaded it shows that one link.
- Under the logo's sentence, "Get the app": the two app-store links (`AppLinks`).
- Under the columns, a row of links in a `nav` named "Help and legal": Frequently asked questions, then Privacy Policy, Terms and Conditions, Refund Policy, End User Licence Agreement, from `src/lib/legal.ts`. One per line and 44px tall on phones; one wrapping row from `sm`.
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

- The roles, their groups, their titles and their one-line descriptions are a prop (`groups`) from the API's `account_roles` reference set, in the API's order. Today that is five groups: Property Seekers, Real Estate Professionals, Real Estate Businesses, Property Owners, Other property businesses.
- Each row is the role's title (weight 500) with its description under it in `muted` 14px. Role names are titles, as the API sends them (content and voice, "Role names").
- One outer `fieldset` with the question as its `legend` and the hint "Choose all that apply", then one nested `fieldset` per group with the group's label as its `legend`.
- Native checkboxes named `roles`. Each label row is at least 44px tall and the whole row is the target. The Prospective Buyer role (`CONSUMER`) is ticked by default.
- At least one is required. The error ("Choose at least one option.", or the API's `roles` message) appears under the groups and is linked to the outer fieldset with `aria-describedby`.
- A role the API marks `requires_verification` says "Needs verification" beside its title (on its own line on phones), and a note under the groups explains that those roles are confirmed after we verify the person or their organisation. Choosing one records a request; it grants no access by itself.
- If the roles cannot be loaded the form is replaced by an `ErrorState`: an account cannot be created without choosing a role.
- Platform administrator roles never appear here. The API also rejects them, so this list is not the safeguard.
- On the account page each chosen role is shown with a status badge: "Active" (`success`), or the status of its onboarding application in the API's words ("Pending Verification", "Under Review", "Changes Requested", "Rejected"), separate from organisation memberships and staff access. A role with an application links to it, and an approved role links to its public profile when it has one.
- A membership shows the organisation's name, its kind from the `organisation_kinds` reference set ("Law Firm", "Real Estate Agency") and the membership's `role_label` from the API as a badge ("Principal", "Agency Principal"). Staff access shows the platform role's title ("Super Administrator").

## Administrator sign-in and landing (`admin/admin-sign-in-form.tsx`, `admin/admin-home.tsx`)

Platform administrators sign in at `/admin/sign-in`, a separate page from the customer sign-in, and land on `/admin`.

- The page uses `AuthShell` with the heading "Administrator sign in". It has no "create an account" link, no role picker and no email password reset; a line of text says to ask a super administrator.
- It is not linked from the header, footer or customer sign-in, is `noindex, nofollow`, and is not in the sitemap. Administrators are given the address.
- Every failed attempt shows the same message, "That email and password do not match.", whether the address is unknown, the password is wrong, or the account is not an administrator. The customer sign-in shows the same message for an administrator account.
- `/admin` states: loading skeleton; signed out (redirects to `/admin/sign-in`); signed in without an administrator session (the "You do not have access" state, which says the area is for Platform Administrators, with links to the account page and the main sign-in); administrator (name, a "Verifications" card with the number of applications waiting and a link to the review queue, platform roles with their market, and an honest list of what is not built yet). `AdminGate` (`admin/admin-gate.tsx`) gives every admin page the same states.
- For an administrator session the account menu shows "Administration" in place of "Your account", and signing out returns to `/admin/sign-in`.

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
- Signed out: a primary "Sign in" button, 44px tall, at every width. From `lg` the "For professionals" link sits beside it; it leads to the landing page's section for professionals, whose button goes to registration. Below `lg` that link is in the menu panel.
- Signed in: a secondary button, 44px tall, that opens a menu with the person's email, "Your account", "Complete your profile" (while an onboarding application is not submitted or has changes requested), "Request inbox" (professional accounts only) and "Sign out". From `sm` the button shows the person's first name; on phones it is the account icon alone, with the name kept for screen readers ("Account menu for Tendai"), so the header fits a 320px screen.
- The button has `aria-expanded` and `aria-controls`. The menu closes on Escape, on an outside click, and when an item is chosen. Items are 44px tall.

## RequireAuth (`auth/require-auth.tsx`)

Wraps content that depends on the session and renders one of four states: loading skeleton, "Sign in to continue" (with a link that returns to the page), "You do not have access to this page", or the content.

- It decides what to show. It is not a security boundary: the API authorises every request.
- A feature a role cannot use is absent from navigation; this state covers people who arrive by URL.

## RequestInbox (`agent/request-inbox.tsx`)

The list of customer requests routed to the signed-in person: an Estate Agent's own listings, everything in the organisation for its principal or a manager, or an individual owner's own listings. It is shown to organisation members (a Real Estate Agency, a Law Firm and so on), Landlords and Property Sellers (Vendors) (`canUseInbox`); the API decides which requests each may read.

- Two sections, each with its own `h2`, count and states: "Property requests" (about listings) and "Business enquiries" (sent from a public profile). Landlords and Property Sellers (Vendors) see only the first, because business enquiries go to organisations.
- A public profile never shows a phone number or email address. The enquiry form is the only way to reach a business, and the customer's details appear only in this inbox.
- Each request is a card: type and status badges, received time in the viewer's time zone, customer name and listing, the message, then contact links and the reference. The listing's title comes with the request from the API; when it does not, the card says "about a listing". Request type and contact method labels come from the API's reference data.
- A request to stay shows its stay above the message: "Asks to stay 8–11 Dec 2026 · 3 nights · 3 guests". It is a request: the nights are not blocked until the lister marks them in the availability calendar.
- States: loading skeleton, error with "Try again", empty ("No requests yet"), and the list with a count.
- Contact details appear only here, behind sign-in. They must never be put in a notification preview or a URL.

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

- `ProfileCard`: avatar with initials (round for a person, square for a business), name, one line under it, tagline, then city, listing count, "Verified" and "Sponsored" badges. The line under the name is the agent's specialism when the API sends one ("Sales Agent", "Lettings Agent"), otherwise the profile's role line or trade, followed by the agency for an agent.
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
- **Categories** are `section`s with an `h2`. **Each question is a native `<details>`**: the `<summary>` holds the question as an `h3` and a chevron that turns when open, is at least 48px tall, the whole row is the target, and it takes the global focus outline. It opens with a click, Enter or Space and needs no JavaScript. Every answer is in the HTML.
- A question's `id` is its address: `/faq#why-no-phone-numbers`. With JavaScript the question named in the address is opened on load and when the hash changes; without it the browser scrolls to the closed question. Do not change an id once published.
- **"Search the questions"** (with JavaScript only; its space is reserved so nothing moves): a search field that filters the questions as you type, by the words of the question, its answer and its category, ignoring case and accents. A polite `role="status"` says how many match ("3 questions match."). With none: a dashed empty state, "No questions match", with the support address. Categories with no match are hidden.
- **Answers** are 2 to 4 sentences, at most `max-w-prose` wide, with underlined links to the page that does the thing. Answer from what is built today: never offer a feature that does not exist, and never give a time we cannot keep (verification says "we email you when a decision is made").
- Linked from the footer, the landing page's "How it works" heading ("Questions and answers"), the enquiry receipts ("What happens next?" goes to `/faq#what-happens-after-enquiry`) and `/legal`. It is not in the header bar, which has no room for another item.

## AppLinks (`layout/app-links.tsx`, `lib/app-links.ts`)

The links to the mobile app in the Apple App Store and Google Play: in the footer under "Get the app", and in the FAQ's "Where do I get the app?".

- Two secondary buttons in words, "Download on the App Store" and "Get it on Google Play". **The stores' badge artwork and logos are not used**; they have their own usage rules. Each opens in a new tab (`rel="noopener"`) and says "(opens in a new tab)" to screen readers.
- The addresses are in `src/lib/app-links.ts` and nowhere else. **Today they are placeholders** (each store's home page, `placeholder: true`). While any is a placeholder, one sentence under the links says the apps are being prepared for the stores and the links will go to the app pages once they are published. Set the real addresses and `placeholder: false` and the sentence disappears, in the footer and in the FAQ.

## ApiBoundary (`components/api-boundary.tsx`)

Wraps every public component that reads the API through `load()`.

- In a build made with the API it renders its children directly, so their content is ordinary HTML in the page and is visible without JavaScript. In a build made without the API it is a `<Suspense>` with the given fallback.
- Do not wrap API-backed public content in a plain `<Suspense>`: React moves the finished content of a boundary into a hidden element and reveals it with a script, so a visitor without JavaScript sees only the fallback.
- A page whose content also reads `params` or `searchParams` exports `instant = false`. See README, "Builds and the API".
- The fallback still matters: it is what a build without the API stores and shows first. Match the content's size.

## Not built yet

Dialog, toast, tabs, data table, a time-slot picker (nights are chosen in `NightCalendar`), file upload, map, YouTube embed. Specify each here before building it.
