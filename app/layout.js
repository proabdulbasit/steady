export const metadata = {
  title: "Steady",
  description: "Straight-talking AI co-pilot for small business owners",
};

import Providers from "./providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
