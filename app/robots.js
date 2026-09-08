export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
        ],
      },
    ],
    sitemap: "https://worksteady.app/sitemap.xml",
    host: "https://worksteady.app",
  };
}
