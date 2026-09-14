import { hreflangAlternates } from "../../lib/seo";

export const metadata = {
  title: "Terms",
  alternates: hreflangAlternates("/terms"),
};

export default function TermsLayout({ children }) {
  return children;
}
