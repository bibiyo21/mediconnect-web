import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// In the sibling-checkout layout, @mediconnect/design-system is a symlink into ../shared. Let Turbopack follow it.
const sharedCheckout = resolve(process.cwd(), '../shared');
const turbopackAdditionalRoots = { sharedPackages: { path: sharedCheckout, ignoreIfMissing: true } };

/**
 * Public site (no patient data). Security headers on every response; a strict
 * Content-Security-Policy with nonces is added when the first third-party
 * script (analytics, maps) is introduced.
 */
export const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  experimental: { turbopackAdditionalRoots },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
