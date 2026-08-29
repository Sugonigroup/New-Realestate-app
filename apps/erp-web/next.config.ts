import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API is the source of truth; the app is presentation-only (03 ADR-03).
  outputFileTracingIncludes: {},
};

export default nextConfig;
