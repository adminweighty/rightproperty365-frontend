# Colour

The site is white. Photography carries the visual weight, and the two logo colours appear as thin accents: a rule, an underline, a small icon, a badge, the primary button, a link. They are never large filled areas.

Components use **semantic** colours only. The raw palette exists so the semantic layer has something to point at; it is never referenced from component code.

## Theme

- **Light is the default for everyone**, whatever theme the operating system uses. There is no `prefers-color-scheme` switch: `tokens.css` sets the light values on `:root` with `color-scheme: light`, and `src/app/layout.tsx` sends a white `theme-color`.
- **Dark is an explicit opt-in.** The dark values apply only with `data-theme="dark"` on `<html>`. Nothing in the app sets it today. The dark tokens are kept, and contrast-checked, so a theme switch can be added later without redesigning.

## Palette

Taken from the approved logo kit v4.1. Do not substitute the brand indigo or turquoise.

| Family | Role | Steps |
| --- | --- | --- |
| Slate | Cool neutrals for text, borders and the light section bands | 25 to 950 |
| Indigo | Brand and primary actions. `600` is the logo colour `#1900AC` | 25 to 900 |
| Turquoise | Accent. `500` is the logo's "365" colour `#21DDBA` | 50 to 900 |

Exact values are in [`tokens.json`](../tokens/tokens.json).

## Semantic colours

| Tailwind name | Token | Use |
| --- | --- | --- |
| `page` | `--rp-color-bg-page` | App background. White |
| `surface` | `--rp-color-bg-surface` | Cards, inputs, menus, the header. White |
| `soft` | `--rp-color-bg-soft` | A very light neutral band behind a section, and the footer |
| `tint` | `--rp-color-bg-tint` | A very light indigo band: one per page at most, and the banner of a profile |
| `sunken` | `--rp-color-bg-sunken` | Hover fills, loading skeletons, neutral badges, an empty photo frame |
| `inverse` / `on-inverse` | `--rp-color-bg-inverse`, `--rp-color-text-inverse` | Reserved for high-emphasis panels. Not used on public pages |
| `ink` | `--rp-color-text-ink` | Headings and body text |
| `muted` | `--rp-color-text-muted` | Secondary text |
| `subtle` | `--rp-color-text-subtle` | Placeholders, captions |
| `line` | `--rp-color-border-line` | Dividers and card borders |
| `line-strong` | `--rp-color-border-strong` | Secondary button and chip borders |
| `control` | `--rp-color-border-control` | Input borders (3:1 minimum) |
| `line-accent` | `--rp-color-border-accent` | Turquoise hairline: an underline or a ring. Decoration only |
| `primary`, `primary-hover`, `on-primary` | `--rp-color-primary-*` | Primary buttons, the status tag on a listing photo, the current page |
| `primary-soft`, `primary-ink` | `--rp-color-primary-*` | Tinted icon squares and avatars; links and small icons |
| `accent`, `accent-soft`, `accent-ink` | `--rp-color-accent-*` | Highlights such as the "Sponsored" badge. Never for actions |
| `brand`, `brand-deep`, `on-brand` | `--rp-color-brand-*` | The logo's indigo and the text that sits on it. For the logo-colour gradients and the reverse logo, not for panels |
| `brand-accent` | `--rp-color-brand-accent` | The logo's turquoise: the "365", the gradients, and the small "Featured" tag with `brand-deep` text |
| `brand-logo` | `--rp-color-brand-logo` | Logo colour: indigo (white in the opt-in dark theme) |
| `success`, `warning`, `danger`, `info` (+ `-soft`) | `--rp-color-<status>-*` | Status text on its soft background |
| `focus` | `--rp-color-focus` | Focus outline: the brand indigo, 2px with a 2px offset |

## Rules

- **White first.** A page is `page` white. At most every other section sits on a `soft` band, and at most one on `tint`. Cards are `surface` with a `line` border and the lightest shadow.
- **No large fills of indigo or turquoise.** No indigo hero, feature panel or footer. If a block of brand colour is wider than a button or taller than a badge, it is wrong.
- **Turquoise is not text.** It does not meet contrast on white. Use it for decoration only (`line-accent`, `rule-brand`, `mark-brand`); text and icons that carry meaning use `ink`, `muted` or `primary-ink`. The one exception is a small tag filled with `brand-accent`, whose text is `brand-deep`.
- One primary action per view uses `bg-primary`. Everything else is secondary or ghost.
- Links are `primary-ink` and underline on hover.
- Status colour always travels with text or an icon. Colour alone never carries meaning.
- Text on a status tint uses the matching base colour: `bg-success-soft text-success`.
- Text never sits directly on a photograph. Put it on a `surface` panel or tag over the photo.
- Do not use opacity to make new colours.

## Brand accents

The logo colours draw thin lines. These utilities are defined in `src/app/globals.css`:

| Class | Looks like | Use |
| --- | --- | --- |
| `rule-brand` | 3px indigo-to-turquoise bar | A short rule (48px) above a section heading and at the top of the hero panel; the full-width band along the top of the header and the footer |
| `frame-brand` | 1.5px indigo-to-turquoise outline that fades in on hover and keyboard focus | Interactive cards: listings, profiles, category and directory tiles |
| `frame-brand-on` | The same outline, always visible | Sponsored profiles |
| `mark-brand` | Turquoise underline behind a phrase | One phrase in the page's main heading |

- The outline is drawn on a pseudo-element, so adding it never changes an element's size or causes layout shift, and it follows the element's radius.
- Keep the 1px `border-line` under a `frame-brand`; the gradient replaces it only while hovered or focused.
- The gradient is decoration. It never carries meaning on its own: a sponsored profile also has a "Sponsored" badge.
- Navigation links in the header underline in `line-accent` on hover.

## Contrast

`npm run tokens` checks these pairs in both themes and exits non-zero on a failure: body, muted and subtle text on `page`, `surface`, `soft`, `tint` and `sunken` (4.5:1), link colour on the same backgrounds (4.5:1), text on primary (4.5:1), each status on its tint (4.5:1), and control borders and focus rings on their backgrounds (3:1). Add a pair to `build.mjs` whenever a new foreground and background combination is introduced.
