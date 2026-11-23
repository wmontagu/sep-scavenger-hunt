import { fileURLToPath } from "node:url";

// Settings: copy .env.example to .env.local (Next.js loads it automatically; it is git-ignored).
// On Railway / Vercel set the same variables in the host's dashboard instead.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the tracing root to this project (a parent folder may have its own lockfile).
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  // content/*.json is read from disk at runtime; make sure serverless hosts (Vercel) ship it.
  outputFileTracingIncludes: { "/**/*": ["./content/**/*"] },
};
export default nextConfig;
