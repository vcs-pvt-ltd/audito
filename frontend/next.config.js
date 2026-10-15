/** @type {import('next').NextConfig} */

// The Audito Auditor Android app is built from the same pages into its own
// folder (android-web/, Capacitor's webDir), so the website export in out/ is
// never replaced by the app bundle. See scripts/android/build-web.mjs.
const isAndroidBuild = process.env.NEXT_PUBLIC_APP_TARGET === 'android';

const nextConfig = {
  reactStrictMode: true,
  output: process.env.NODE_ENV === 'production' ? 'export' : 'standalone',
  ...(isAndroidBuild ? { distDir: 'android-web' } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
