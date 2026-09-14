/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const securityHeaders = [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];

    const privateRoutes = [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "chat",
      "profile",
      "admin",
      "tools",
    ];

    const privateHeaders = privateRoutes.map((route) => ({
      source: `/${route}/:path*`,
      headers: [
        {
          key: "X-Robots-Tag",
          value: "noindex, nofollow, noarchive",
        },
      ],
    }));

    return [...securityHeaders, ...privateHeaders];
  },
};

module.exports = nextConfig;
