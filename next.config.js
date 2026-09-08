/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the native/WASM DB drivers out of the bundler; load them at runtime.
  experimental: {
    serverComponentsExternalPackages: ['pg', '@electric-sql/pglite'],
  },
};
module.exports = nextConfig;
