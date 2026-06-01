import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.3.119", "localhost", "127.0.0.1"],
  async redirects() {
    return [{ source: "/demo", destination: "/", permanent: false }];
  },
  async rewrites() {
    const api =
      process.env.API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${api}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
