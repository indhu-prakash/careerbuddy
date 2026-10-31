import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load the resume parsers from node_modules at runtime instead of bundling them
  // (pdf-parse ships pdf.js, which breaks when webpack bundles it).
  serverExternalPackages: ["pdf-parse", "mammoth"],
  // Hide the Next.js dev badge in the bottom-left corner.
  devIndicators: false,
};

export default nextConfig;
