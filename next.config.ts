import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Only apply Web Worker configuration for client-side builds
    if (!isServer) {
      // Ensure Web Workers are properly handled
      config.output.globalObject = 'self';

      // Enable WebAssembly support
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }

    return config;
  },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Headers for proper MIME types
  async headers() {
    return [
      {
        source: '/stockfish-local.worker.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
