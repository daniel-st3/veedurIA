import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "plotly.js/dist/plotly": "plotly.js-dist-min",
    };
    return config;
  },
};

export default nextConfig;
