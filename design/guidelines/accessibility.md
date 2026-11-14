# Accessibility

The target is WCAG 2.2 level AA on the website. This list is the working checklist for every pull request that changes the interface.

## Perceivable

- Text contrast is at least 4.5:1; large text, control borders, icons that carry meaning and focus indicators are at least 3:1. `npm run tokens` enforces the token pairs.
- Meaningful images have `alt` text that describes the property view ("Kitchen with island"). Decorative images and icons are `aria-hidden`.
- Nothing is conveyed by colour alone. Status has text; errors have text; links in body copy are underlined on hover and distinguishable by more than colour.
- The page works at 200% zoom and reflows at 320px wide with no horizontal scrolling.

## Operable

- Everything works with a keyboard, in a logical order, with a visible focus outline.
- The first focusable element on every page is "Skip to content".
- Touch targets are at least 44 by 44px on phone layouts (WCAG 2.2 requires 24px; we aim higher).
- No interaction depends on hover or on a drag gesture without an alternative.
- Motion respects `prefers-reduced-motion`. Nothing flashes or auto-plays; video starts only when the visitor presses play.

## Understandable

- `lang` is set on `<html>`, and on any passage in another language.
- Every form control has a visible `<label>`. Hints and errors are linked with `aria-describedby`; invalid controls have `aria-invalid`.
- Error messages name the field and the fix. A summary with `role="alert"` announces a failed submission.
- Navigation and component behaviour are consistent across pages.
- Authentication never relies on a memory or puzzle test alone.

## Robust

- Use native elements first: `button`, `a`, `select`, `input`, `dialog`. Reach for ARIA only when no element fits.
- One `h1` per page; heading levels are not skipped.
- Landmarks: `header`, `nav` (each with an `aria-label`), `main`, `footer`.
- Live changes (result counts, request received) use `role="status"`; failures use `role="alert"`.

## Testing before merge

1. Tab through the changed screen without a mouse.
2. Check it at 320px, at about 800px and at 200% zoom, signed in and signed out, and with the operating system set to dark (the site must stay white).
3. Run an automated checker (axe or Lighthouse) and fix every issue it reports.
4. For new components, test once with a screen reader (NVDA on Windows, VoiceOver on iOS, TalkBack on Android).

Automated checks find only some problems. Passing them is necessary, not sufficient.
