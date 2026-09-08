import { permanentRedirect } from "next/navigation";
import { normalizeSlug } from "../../../lib/blog-server";

export default async function LegacyBlogPostRoute({ params }) {
  const { slug } = await params;
  permanentRedirect(`/${encodeURIComponent(normalizeSlug(slug))}`);
}
