# Logo

The official logo pack has not been added yet. The app currently renders a provisional wordmark from `src/components/layout/logo.tsx`.

When the ZIP of logo designs arrives:

1. Extract it here, keeping the original files in `source/`.
2. Export optimised SVGs for: full logo, mark only, and single-colour versions for light and dark backgrounds.
3. Replace the provisional `Logo` component and `src/app/favicon.ico` with the official artwork.
4. Take the brand colours from the logo and update `palette` in `../../tokens/tokens.json`, then run `npm run tokens` and fix any contrast failures.
5. Record clear-space, minimum size and misuse rules in this file.
