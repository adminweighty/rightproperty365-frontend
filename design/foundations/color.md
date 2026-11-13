# Colour

Components use **semantic** colours only. The raw palette exists so the semantic layer has something to point at; it is never referenced from component code.

## Palette

Taken from the approved logo kit v4.1. Do not substitute the brand indigo or turquoise.

| Family | Role | Steps |
| --- | --- | --- |
| Slate | Cool neutrals for surfaces, text and borders | 25 to 950 |
| Indigo | Brand and primary actions. `600` is the logo colour `#1900AC` | 50 to 900 |
| Turquoise | Accent. `500` is the logo's "365" colour `#21DDBA` | 50 to 900 |

Exact values are in [`tokens.json`](../tokens/tokens.json).

## Semantic colours

| Tailwind name | Token | Use |
| --- | --- | --- |
| `page` | `--rp-color-bg-page` | App background |
| `surface` | `--rp-color-bg-surface` | Cards, inputs, menus |
| `sunken` | `--rp-color-bg-sunken` | Bands, hover fills, footer |
| `inverse` / `on-inverse` | `--rp-color-bg-inverse`, `--rp-color-text-inverse` | High-emphasis panels |
| `brand`, `brand-deep`, `on-brand` | `--rp-color-brand-*` | The indigo hero and feature panels. Same in light and dark |
| `brand-accent` | `--rp-color-brand-accent` | Turquoise highlights on `brand` only |
| `brand-logo` | `--rp-color-brand-logo` | Logo colour: indigo in light, white in dark |
| `ink` | `--rp-color-text-ink` | Headings and body text |
| `muted` | `--rp-color-text-muted` | Secondary text |
| `subtle` | `--rp-color-text-subtle` | Placeholders, captions |
| `line` | `--rp-color-border-line` | Dividers and card borders |
| `line-strong` | `--rp-color-border-strong` | Secondary button borders |
| `control` | `--rp-color-border-control` | Input borders (3:1 minimum) |
| `primary`, `primary-hover`, `on-primary` | `--rp-color-primary-*` | Primary buttons |
| `primary-soft`, `primary-ink` | `--rp-color-primary-*` | Tinted backgrounds, links, icons |
| `accent`, `accent-soft`, `accent-ink` | `--rp-color-accent-*` | Highlights. Never for actions |
| `success`, `warning`, `danger`, `info` (+ `-soft`) | `--rp-color-<status>-*` | Status text on its soft background |
| `focus` | `--rp-color-focus` | Focus outline |

## Rules

- One primary action per view uses `bg-primary`. Everything else is secondary or ghost.
- Status colour always travels with text or an icon. Colour alone never carries meaning.
- `accent` (the base step) is decorative and does not meet text contrast on light surfaces. Use `accent-ink` for text.
- Turquoise text is allowed only on `brand` indigo (`text-brand-accent`), where it passes contrast. Use it for one highlighted phrase or small icons, not for body copy.
- `brand` is for large moments: the landing hero and one feature panel per page. Buttons and links use `primary`, which lightens in the dark theme so it stays legible.
- Text on a status tint uses the matching base colour: `bg-success-soft text-success`.
- Do not use opacity to make new colours, except `opacity-80` for secondary text on `inverse`.

## Contrast

`npm run tokens` checks these pairs in both themes and exits non-zero on a failure: body, muted and subtle text on page and surface (4.5:1), text on primary (4.5:1), each status on its tint (4.5:1), and control borders and focus rings on their backgrounds (3:1). Add a pair to `build.mjs` whenever a new foreground and background combination is introduced.
