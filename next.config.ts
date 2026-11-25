import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { dirs: ["src"] },
  images: { qualities: [75, 80, 95] },
  async headers() {
    // Keep the Google popup compatibility policy in production; in local dev,
    // omitting COOP avoids noisy GSI postMessage warnings on http://localhost.
    return process.env.NODE_ENV === "production"
      ? [
          {
            source: "/:path*",
            headers: [
              { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
            ],
          },
        ]
      : [];
  },
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
