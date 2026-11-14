import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @danlang/core ships raw TypeScript (no build step), so Next compiles it.
  transpilePackages: ["@danlang/core"],
};

export default nextConfig;
