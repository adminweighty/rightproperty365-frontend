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
| `16` | 64 | Between page sections |
| `24` | 96 | Hero padding on desktop |

Prefer `gap` on a flex or grid parent over margins on children.

## Page grid

- `Container`: 1200px maximum, 16px side gutter on phones, 32px from `md`.
- Listing grids: 1 column, 2 from `sm`, 3 from `lg`, 24px gap.
- Detail pages: content plus a 384px sticky side panel from `lg`; one column below.

## Breakpoints

Tailwind defaults, mobile first: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Design the phone layout first; most visitors in the launch market are on phones.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6px | Small chips, checkboxes |
| `rounded-md` | 10px | Buttons, inputs |
| `rounded-lg` | 14px | Cards |
| `rounded-xl` | 20px | Hero media, feature panels, search bar |
| `rounded-full` | pill | Badges |

Nested radii step down one size from their container.

## Elevation

Borders do most of the separating; shadows only signal that something floats.

| Token | Use |
| --- | --- |
| `shadow-xs` | Resting cards |
| `shadow-sm` | Sticky header once scrolled, small popovers |
| `shadow-md` | Hovered cards, the search bar |
| `shadow-lg` | Dialogs and menus |

## Motion

| Token | Value | Use |
| --- | --- | --- |
| fast | 120ms | Colour and border changes |
| base | 200ms | Shadows, small movements |
| slow | 320ms | Panels and dialogs entering |

Easing is `ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`). Animate `opacity`, `transform`, colour and shadow only. `prefers-reduced-motion` switches all transitions off globally.
