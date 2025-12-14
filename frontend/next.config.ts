import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude test files from build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude test files and dev dependencies from client bundle
      config.module.rules.push({
        test: /\.(test|spec)\.(js|jsx|ts|tsx|mjs)$/,
        loader: 'ignore-loader',
      });
    }
    return config;
  },
  
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
