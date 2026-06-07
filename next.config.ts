import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/*": ["./photos/**/*"],
  },
};

export default nextConfig;
