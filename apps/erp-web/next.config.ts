import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API is the source of truth; the app is presentation-only (03 ADR-03).
  outputFileTracingIncludes: {},
  allowedDevOrigins: [".monkeycode-ai.live"],
  async rewrites() {
    const api = process.env.CORE_API_URL ?? "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${api}/v1/:path*` }];
  },
};

export default nextConfig;
