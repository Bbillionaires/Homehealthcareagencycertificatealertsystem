/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@compliance/shared"],
  // Employee photos / credential documents will be served from a Railway
  // bucket's presigned URLs (Phase 6) -- add that hostname to
  // images.remotePatterns once one is provisioned.
};

export default nextConfig;
