# RightProperty365 design system

The shared visual and interaction language for the RightProperty365 web app, and the reference for the mobile apps. Everything the UI uses for colour, type, shape and motion is defined here first and consumed by code second.

> **Brand source:** the approved Blue, White and Turquoise logo kit v4.1 in [`assets/logo`](assets/logo/README.md). Indigo `#1900AC` is the brand colour, turquoise `#21DDBA` the accent, and Inter the typeface.

## What is in this folder

| Path | Contents |
| --- | --- |
| [`tokens/tokens.json`](tokens/tokens.json) | The single source of truth for colour, font families, radius, shadow and motion. |
| [`tokens/tokens.css`](tokens/tokens.css) | Generated CSS custom properties (`--rp-*`). Imported by `src/app/globals.css`. Never edit by hand. |
| [`tokens/build.mjs`](tokens/build.mjs) | Generates `tokens.css` and fails if any colour pair misses its WCAG contrast minimum. |
| [`foundations/`](foundations) | Colour, typography, and layout (spacing, radius, elevation, motion, breakpoints). |
| [`components/`](components/README.md) | Specification for each UI component: purpose, variants, states, accessibility. |
| [`guidelines/`](guidelines) | UX principles, accessibility rules, and content and voice. |
| [`assets/`](assets) | Logo files and other brand assets. |

A live rendering of the tokens and components is served by the app at `/design-system`.

## Principles

1. **White and photo-led.** The site is white, bright and spacious, in the manner of the large property portals. Photographs of property carry the visual weight; headings are confident, bold Inter with generous space around them.
2. **Logo colours as accents.** Indigo and turquoise appear as thin rules, underlines, small icons, badges, links and the primary button. Never as a large filled area.
3. **Content first.** Property, price and place are the interface. Chrome stays thin: hairline borders, the lightest shadow that still separates layers.
4. **Plain language.** Say what happened and what happens next. Never claim more than the system knows (a request is "received", not "delivered").
5. **Accessible by default.** WCAG 2.2 AA is a build requirement. Contrast is checked by script, focus is always visible, targets are at least 44px on touch layouts.
6. **One system, many markets.** Nothing in a component assumes a currency, language direction, address format or time zone.
7. **Tokens, not values.** A hex code or pixel radius in a component is a bug.

## How tokens reach the UI

```
tokens.json ──(npm run tokens)──▶ tokens.css (--rp-*) ──▶ globals.css @theme ──▶ Tailwind utilities
```

- `globals.css` removes Tailwind's default colour palette, so only semantic names compile: `bg-surface`, `text-muted`, `border-line`, `bg-primary`.
- The site is light for everyone, whatever theme the operating system uses. A dark theme is defined and contrast-checked, but applies only with `data-theme="dark"` on `<html>`; nothing sets it today. See [colour](foundations/color.md).
- Spacing and type sizes use Tailwind's default scales, documented in [foundations](foundations/layout.md).

## Changing the system

1. Edit `tokens/tokens.json`.
2. Run `npm run tokens`. Fix any contrast failure it reports.
3. Check `/design-system`. For a change to the dark tokens, set `data-theme="dark"` on `<html>` in the browser's inspector.
4. Update the relevant document in this folder in the same commit.

New components get a section in [`components/README.md`](components/README.md) before they are used on a second screen.
