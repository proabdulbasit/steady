import { hreflangAlternates } from "../../lib/seo";

export const metadata = {
  title: "Privacy",
  alternates: hreflangAlternates("/privacy"),
};

export default function PrivacyLayout({ children }) {
  return children;
}
