import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Stub out the optional canvas native addon that pdfjs-dist tries to require
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
