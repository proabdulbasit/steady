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

    return privateRoutes.map((route) => ({
      source: `/${route}/:path*`,
      headers: [
        {
          key: "X-Robots-Tag",
          value: "noindex, nofollow, noarchive",
        },
      ],
    }));
  },
};

module.exports = nextConfig;

