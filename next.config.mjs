import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Settings live in .env.example (git-ignored). Next.js doesn't read that file on its own,
// so load it here. Blank values are skipped, and real env vars (e.g. Railway's) win.
const envFile = fileURLToPath(new URL(".env.example", import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || !m[2] || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The parent folder has its own package-lock.json; pin the root to this project.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};
export default nextConfig;
