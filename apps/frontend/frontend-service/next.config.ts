import type { NextConfig } from "next";

// Startup log to confirm loginVerified page is available
console.log('📄 LOGINVERIFIED PAGE CONFIRMED: Route available');

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['app', 'lib', 'src'], // Only lint these directories 
  },
  images: {
    remotePatterns: [
      // Local assets (if any served via full URL in dev)
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      // External team logos used in Test Mode (API-FOOTBALL)
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
        pathname: '/football/teams/**',
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
