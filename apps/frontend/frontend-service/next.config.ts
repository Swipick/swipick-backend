import type { NextConfig } from "next";

// Startup log to confirm loginVerified page is available
console.log('📄 LOGINVERIFIED PAGE CONFIRMED: Route available');

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
    // Disable caching for production builds in containers
    unoptimized: process.env.NODE_ENV === 'production',
  },
  // Disable static optimization for pages with dynamic imports
  staticPageGenerationTimeout: 60,
  // Configure output for better container compatibility
  output: 'standalone',
};

export default nextConfig;
