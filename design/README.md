# RightProperty365 design system

The shared visual and interaction language for the RightProperty365 web app, and the reference for the mobile apps. Everything the UI uses for colour, type, shape and motion is defined here first and consumed by code second.

> **Status: provisional.** The palette and wordmark were chosen before the official logo pack was available. When the logo files arrive, put them in [`assets/logo`](assets/logo/README.md), then adjust the `palette` block in [`tokens/tokens.json`](tokens/tokens.json). No component code needs to change.

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

1. **Calm over loud.** Warm neutral surfaces, one brand colour, one accent. Colour carries meaning (action, status), never decoration.
2. **Content first.** Property, price and place are the interface. Chrome stays thin: hairline borders, the lightest shadow that still separates layers.
3. **Plain language.** Say what happened and what happens next. Never claim more than the system knows (a request is "received", not "delivered").
4. **Accessible by default.** WCAG 2.2 AA is a build requirement. Contrast is checked by script, focus is always visible, targets are at least 44px on touch layouts.
5. **One system, many markets.** Nothing in a component assumes a currency, language direction, address format or time zone.
6. **Tokens, not values.** A hex code or pixel radius in a component is a bug.

## How tokens reach the UI

```
tokens.json ──(npm run tokens)──▶ tokens.css (--rp-*) ──▶ globals.css @theme ──▶ Tailwind utilities
```

- `globals.css` removes Tailwind's default colour palette, so only semantic names compile: `bg-surface`, `text-muted`, `border-line`, `bg-primary`.
- Light and dark themes are both defined. Dark follows the operating system, or can be forced with `data-theme="dark"` on `<html>`.
- Spacing and type sizes use Tailwind's default scales, documented in [foundations](foundations/layout.md).

## Changing the system

1. Edit `tokens/tokens.json`.
2. Run `npm run tokens`. Fix any contrast failure it reports.
3. Check `/design-system` in light and dark.
4. Update the relevant document in this folder in the same commit.

New components get a section in [`components/README.md`](components/README.md) before they are used on a second screen.
