/** @type {import('next').NextConfig} */
const nextConfig = {
  // typedRoutes moved out of experimental in Next.js 16
  typedRoutes: true,
  // Allow remote product images from Unsplash (mock data) and any future CDN.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "**.s3.**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.storage.yandexcloud.net" }
    ],
    formats: ["image/avif", "image/webp"]
  },
  // Production hardening
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Reduce bundle: only ship the icons we use
    optimizePackageImports: ["lucide-react"]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
        ]
      }
    ];
  }
};

export default nextConfig;
