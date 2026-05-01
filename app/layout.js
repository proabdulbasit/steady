import "./globals.css";

export const metadata = {
  title: "Steady — Straight-talking AI co-pilot for small business owners",
  description:
    "Steady gives restaurants, pawnshops, auto shops and other real businesses direct, no-fluff answers and a clear next move. Light or dark, on every device.",
};

import Providers from "./providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
