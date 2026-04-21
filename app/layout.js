export const metadata = {
  title: "Steady",
  description: "Straight-talking AI co-pilot for small business owners",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

