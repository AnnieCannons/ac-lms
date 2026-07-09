import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom (pulled in by isomorphic-dompurify) transitively requires an
  // ESM-only package via require(), which breaks when webpack bundles it
  // into the server function. Keep it external so Node's own module
  // resolution loads it at runtime instead.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
};

export default nextConfig;
