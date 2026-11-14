/**
 * Where the RightProperty365 mobile apps are downloaded. Everything that
 * links to an app store reads from here (the footer's "Get the app" block
 * and the FAQ), so replacing the three addresses below is the whole change
 * when the apps are published.
 *
 * PLACEHOLDERS: the apps are not in the stores yet, so each address is the
 * store's home page and `placeholder` is true. While any link is a
 * placeholder, the site says the apps are being prepared for the stores.
 *
 * AT LAUNCH: set `url` to the app's own store page and `placeholder` to
 * false for each store. The "being prepared" sentence then disappears.
 */
export type AppLink = {
  store: "appStore" | "playStore" | "appGallery";
  /** The link text, shown beside the store's mark. The stores' badge artwork is not used yet (README, "Mobile app links"). */
  label: string;
  url: string;
  /** True while `url` is the store's home page and not the app's page. */
  placeholder: boolean;
};

export const appLinks: AppLink[] = [
  {
    store: "appStore",
    label: "Download on the App Store",
    // PLACEHOLDER: replace with https://apps.apple.com/app/<name>/id<number>
    url: "https://apps.apple.com/",
    placeholder: true,
  },
  {
    store: "playStore",
    label: "Get it on Google Play",
    // PLACEHOLDER: replace with https://play.google.com/store/apps/details?id=<package>
    url: "https://play.google.com/store",
    placeholder: true,
  },
  {
    store: "appGallery",
    label: "Explore it on AppGallery",
    // PLACEHOLDER: replace with https://appgallery.huawei.com/app/C<number>
    url: "https://appgallery.huawei.com/",
    placeholder: true,
  },
];

/** True while at least one store link does not yet point at the app. */
export const appLinksArePlaceholders = appLinks.some((link) => link.placeholder);

/** Said next to the links while they are placeholders. */
export const APP_LINKS_PLACEHOLDER_NOTE =
  "The apps are being prepared for the stores. These links will go to the app pages once they are published.";
