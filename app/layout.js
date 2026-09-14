import Script from "next/script";
import "./globals.css";
import { GTM_ID, GTM_INLINE_SCRIPT, hreflangAlternates } from "../lib/seo";

const siteDescription =
  "Straight-talking AI guidance and practical next moves for people running real small businesses.";

export const metadata = {
  metadataBase: new URL("https://worksteady.app"),
  title: {
    default: "WorkSteady — Straight-talking AI for small business owners",
    template: "%s | WorkSteady",
  },
  description: siteDescription,
  applicationName: "WorkSteady",
  authors: [{ name: "WorkSteady" }],
  creator: "WorkSteady",
  publisher: "WorkSteady",
  verification: {
    google: "Voum7juu4mnUgw5Lmi2sb3Bj-jOEHkZfxIooPhgqPBA",
  },
  alternates: hreflangAlternates("/"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "WorkSteady",
    title: "WorkSteady — Straight-talking AI for small business owners",
    description: siteDescription,
    images: [
      {
        url: "/hero-owner-v2.jpg",
        width: 1536,
        height: 1280,
        alt: "A small business owner using WorkSteady for practical guidance.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkSteady — Straight-talking AI for small business owners",
    description: siteDescription,
    images: ["/hero-owner-v2.jpg"],
  },
};

import Providers from "./providers";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://worksteady.app/#organization",
  name: "WorkSteady",
  alternateName: "Steady",
  url: "https://worksteady.app/",
  description: siteDescription,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://worksteady.app/#website",
  name: "WorkSteady",
  url: "https://worksteady.app/",
  description: siteDescription,
  publisher: { "@id": "https://worksteady.app/#organization" },
  inLanguage: "en-US",
};

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-US" data-theme="light" suppressHydrationWarning>
      <body>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Script id="gtm-base" strategy="afterInteractive">
          {GTM_INLINE_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
