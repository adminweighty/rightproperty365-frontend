# Typography

## Typefaces

| Role | Family | Tailwind | Used for |
| --- | --- | --- | --- |
| Display and text | Inter (variable) | `font-display`, `font-sans` | Everything |
| Mono | Geist Mono | `font-mono` | References, codes, token names |

Inter is the brand typeface: the logo wordmark is Inter Display Bold. The brand direction is sans-serif only, so there is no serif anywhere in the product.

Fonts are self-hosted at build time by `next/font`, so no request leaves for a font CDN at runtime. Each has a system fallback stack in `tokens.json`.

Hierarchy comes from weight and size, not from a second typeface. `h1` to `h3` are weight 700 with -0.02em tracking (set globally). Small headings inside components use weight 600 with normal tracking. Prices are weight 700; buttons and navigation are weight 600.

## Scale

The scale is Tailwind's default, in rem so it respects the reader's browser setting.

| Class | Size | Use |
| --- | --- | --- |
| `text-5xl` | 48px | Home hero on desktop, the "Find a property professional" title |
| `text-4xl` | 36px | Page title, detail price |
| `text-3xl` | 30px | Section title, hero on phones |
| `text-2xl` | 24px | Sub-section, card price |
| `text-xl` | 20px | Card heading |
| `text-lg` | 18px | Lead paragraph |
| `text-base` | 16px | Body, inputs |
| `text-sm` | 14px | Supporting text, labels, buttons |
| `text-xs` | 12px | Badges and the tags on photos only |

## Rules

- Inputs are `text-base` (16px) so iOS does not zoom on focus.
- Body copy uses `leading-relaxed` and a maximum measure of about 65 characters (`max-w-prose`).
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty` (set globally).
- Figures that people compare (prices, counts) use `tabular-nums`.
- Sentence case everywhere, including buttons and headings. No all-caps.
- Heading levels follow document structure, not appearance. Pick the level for meaning, then the size class for looks.
