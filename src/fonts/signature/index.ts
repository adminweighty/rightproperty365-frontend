import localFont from "next/font/local";

/*
 * The three typed-signature styles, the same font files the API draws the
 * signed PDF with (vendored in both repositories, each with its SIL Open Font
 * License 1.1 text): Great Vibes, Kaushan Script and Allura, from Google
 * Fonts. They are served with the site's own assets, from no other origin.
 *
 * A letter a font does not have is shown in the browser's own italic; the
 * API draws such a name in Go Italic.
 */

export const greatVibes = localFont({
  src: "./GreatVibes-Regular.ttf",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const kaushanScript = localFont({
  src: "./KaushanScript-Regular.ttf",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const allura = localFont({
  src: "./Allura-Regular.ttf",
  display: "swap",
  fallback: ["Georgia", "serif"],
});
