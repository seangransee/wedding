import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1536, 1600, 1920, 2048],
    imageSizes: [128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [68, 75],
  },
  outputFileTracingIncludes: {
    "/*": ["./photos/**/*"],
  },
};

export default nextConfig;
