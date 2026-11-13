# Logo

Approved kit: **Blue, White and Turquoise, v4.1**. The kit's own notes are in [`KIT_README.txt`](KIT_README.txt) and a preview is in [`preview-approved.png`](preview-approved.png).

| Brand value | |
| --- | --- |
| Indigo | `#1900AC` |
| Turquoise (the "365" only) | `#21DDBA` |
| White | `#FFFFFF` |
| Typeface | Inter Display Bold, outlined in the SVGs |

## Files

- [`svg/`](svg) holds every vector lockup: horizontal, stacked, wordmark and mark, each for white, transparent and blue backgrounds.
- [`guidelines/`](guidelines) holds the kit's brand tokens.
- The high-resolution PNG exports are not stored in the repository. Take them from the original kit ZIP when a raster file is needed.

## Where the app uses it

| Use | File |
| --- | --- |
| Header and footer logo | `src/components/layout/logo.tsx`, inlined from `svg/logo-horizontal-transparent.svg` so it can follow the theme |
| Favicon and app icons | `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/app-icon-*.png`, `public/site.webmanifest` |

## Which version to use

| Background | Version |
| --- | --- |
| White or light | Indigo mark and wordmark, turquoise "365" (`Logo` default) |
| Brand indigo | White mark and wordmark, turquoise "365" (`Logo tone="reverse"`) |
| Dark theme surfaces | White mark and wordmark, turquoise "365" (automatic) |
| One-colour print | `svg/logo-horizontal-all-white-on-blue.svg` |

## Rules

- Do not recolour the logo, replace the indigo, or add a door to the house. Only "365" is turquoise.
- Do not retype the wordmark in a font. Use the outlined paths.
- Keep clear space around the logo of at least the height of the window in the mark.
- Minimum height on screen is 24px for the horizontal logo. Below that, use the mark alone.
- Do not place the indigo logo on photographs or mid-tone colours. Use the reverse version on indigo or dark surfaces.
