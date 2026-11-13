# Typography

## Typefaces

| Role | Family | Tailwind | Used for |
| --- | --- | --- | --- |
| Display | Fraunces (variable serif) | `font-display` | `h1` to `h3`, prices |
| Text | Geist Sans | `font-sans` | Everything else |
| Mono | Geist Mono | `font-mono` | References, codes, token names |

Fonts are self-hosted at build time by `next/font`, so no request leaves for a font CDN at runtime. Each has a system fallback stack in `tokens.json`.

The serif display face against a quiet sans gives the product an editorial, trustworthy tone without ornament. Headings are weight 500 with slight negative tracking; never bold a serif heading.

## Scale

The scale is Tailwind's default, in rem so it respects the reader's browser setting.

| Class | Size | Use |
| --- | --- | --- |
| `text-6xl` | 60px | Home hero on desktop |
| `text-4xl` | 36px | Page title, hero on mobile, detail price |
| `text-3xl` | 30px | Section title |
| `text-2xl` | 24px | Sub-section, card price |
| `text-xl` | 20px | Card heading |
| `text-lg` | 18px | Lead paragraph |
| `text-base` | 16px | Body, inputs |
| `text-sm` | 14px | Supporting text, labels, buttons |
| `text-xs` | 12px | Badges only |

## Rules

- Inputs are `text-base` (16px) so iOS does not zoom on focus.
- Body copy uses `leading-relaxed` and a maximum measure of about 65 characters (`max-w-prose`).
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty` (set globally).
- Figures that people compare (prices, counts) use `tabular-nums`.
- Small headings inside components (card titles, footer columns) switch to `font-sans` with normal tracking. The serif is for moments of emphasis.
- Sentence case everywhere, including buttons and headings. No all-caps.
- Heading levels follow document structure, not appearance. Pick the level for meaning, then the size class for looks.
