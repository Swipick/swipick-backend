import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['localhost'],
  },
  // Disable static optimization for pages with dynamic imports
  staticPageGenerationTimeout: 60,
  // Configure Next.js to use src directory
  srcDir: true,
};

export default nextConfig;
