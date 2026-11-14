# Layout, shape, elevation and motion

## Spacing

A 4px base unit, using Tailwind's spacing scale (`1` = 4px).

| Step | Pixels | Typical use |
| --- | --- | --- |
| `1.5` | 6 | Label to control |
| `2`, `3` | 8, 12 | Inside compact components |
| `4` | 16 | Between form fields, page gutter on phones |
| `6` | 24 | Card padding, grid gaps |
| `8`, `10` | 32, 40 | Between blocks in a section, page gutter from tablet |
| `14`, `20` | 56, 80 | Between page sections, on phones and from tablet |

Prefer `gap` on a flex or grid parent over margins on children.

## Page grid

- `Container`: 1200px maximum, 16px side gutter on phones, 32px from `md`.
- Listing grids: 1 column, 2 from `sm`, 3 from `lg`, 24px gap.
- Rows (`ListingRail`, `PhotoTileRow`): cards of a fixed width that scroll sideways with snapping; the row bleeds to the screen edge on phones.
- Section bands: a full-width `soft` or `tint` background with `line` borders above and below and a `Container` inside. Alternate with white; never two bands in a row.
- Detail pages: content plus a 384px sticky side panel from `lg`; one column below.

## Breakpoints

Tailwind defaults, mobile first: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Design the phone layout first; most visitors in the launch market are on phones.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6px | Tags on photos, checkboxes |
| `rounded-md` | 10px | Buttons, inputs |
| `rounded-lg` | 14px | Cards |
| `rounded-xl` | 20px | The hero panel, feature panels, the search bar, the main photo of a listing |
| `rounded-full` | pill | Badges, chips |

Nested radii step down one size from their container.

## Elevation

Borders do most of the separating; shadows only signal that something floats.

| Token | Use |
| --- | --- |
| `shadow-xs` | Resting cards |
| `shadow-sm` | The search bar, feature panels |
| `shadow-md` | Hovered cards |
| `shadow-lg` | The hero panel, menus and dialogs |

## Motion

| Token | Value | Use |
| --- | --- | --- |
| fast | 120ms | Colour and border changes |
| base | 200ms | Shadows, small movements |
| slow | 320ms | Panels and dialogs entering |
| enter | 600ms | Content entering the screen (a section, a card, a row of tiles) |
| emphasis | 800ms | A drawn rule, one item that should be noticed |

Easing is `ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`). Animate `opacity`, `transform`, colour and shadow only. `prefers-reduced-motion` switches all transitions off globally.

The site moves a good deal, in two layers. Hover, focus and the first paint of a page are CSS (transitions and the `enter-rise`, `enter-settle`, `link-sweep`, `sheen` and `wobble-once` utilities in `globals.css`). Entrances as the page is scrolled, counting numbers, opening answers and the hero's parallax are GSAP (with its ScrollTrigger plugin for the parallax), used only through the components in `src/components/motion`. The rules that keep it safe are in `design/components/README.md`, "Motion": the server HTML is always fully visible, reduced motion means no movement, and what is largest on the screen when a page opens is never hidden. Distances are small (12 to 20px), items of a group follow each other by 30 to 100ms, and nothing loops.
