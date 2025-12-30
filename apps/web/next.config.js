/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  trailingSlash: true,
  experimental: {
    // Amplify の SSR スキャナが期待する "standalone 標準レイアウト" を得るため、
    // monorepo ルートではなくアプリ自身を tracing root にする
    outputFileTracingRoot: __dirname,
  },
};

export default nextConfig;
