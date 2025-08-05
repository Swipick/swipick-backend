import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['localhost'],
  },
  // Disable static optimization for pages with dynamic imports
  staticPageGenerationTimeout: 60,
};

export default nextConfig;
