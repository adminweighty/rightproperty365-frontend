import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SavedListingsProvider } from "@/components/listings/saved-listings-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TestSiteBanner } from "@/components/layout/test-site-banner";
import { SiteMotion } from "@/components/motion/site-motion";
import { env } from "@/lib/env";
import "./globals.css";

// Inter is the brand typeface (logo kit v4.1); it serves headings and body.
const sans = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "RightProperty365 | Property for sale and to rent",
    template: "%s | RightProperty365",
  },
  description:
    "Search property for sale and to rent from verified agents and owners. Send an enquiry and track it until the agent replies.",
  manifest: "/site.webmanifest",
  applicationName: "RightProperty365",
  // Public pages are indexable by default. Private pages set
  // `robots: { index: false }`, which replaces this whole object.
  robots: { index: true, follow: true, "max-image-preview": "large" },
  // A page that sets `openGraph` replaces this object (metadata merges
  // shallowly), so pages repeat `type` and set their own title and url.
  openGraph: { type: "website", siteName: "RightProperty365", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

// The site is white for everyone, whatever theme the operating system uses
// (design/foundations/color.md). The value is the `bg.page` token.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Logos and every request the page makes go to the API: open that connection early. */}
        <link rel="preconnect" href={env.apiUrl} />
      </head>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          {/* The saved hearts are read in the browser, so cached pages stay the same for everyone. */}
          <SavedListingsProvider>
            <TestSiteBanner />
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <SiteMotion />
            {/* First-party listing measurement: a client island that renders nothing (src/lib/analytics). */}
            <AnalyticsRoot />
          </SavedListingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
