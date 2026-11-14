import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @danlang/core ships raw TypeScript (no build step), so Next compiles it.
  transpilePackages: ["@danlang/core"],
  // The Next.js badge would cover the timeline.
  devIndicators: false,
};

export default nextConfig;
