import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs resolve their worker relative to the installed package.
  // Bundling them into .next/server/chunks breaks that worker path in dev.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
