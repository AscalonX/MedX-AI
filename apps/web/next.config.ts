import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@medx/shared"],
  output: "standalone",
};

export default nextConfig;
