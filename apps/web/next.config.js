/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // NOTE: Amplify(Web Compute)環境で /api/* に trailingSlash のリダイレクトが掛かると、
  // 末尾スラッシュ側(/api/.../)が Next のHTML 500 になる事象があるため無効化する。
  // クライアントは /api/...（末尾スラッシュ無し）を利用する。
  trailingSlash: false,
  experimental: {
    // Amplify の SSR スキャナが期待する "standalone 標準レイアウト" を得るため、
    // monorepo ルートではなくアプリ自身を tracing root にする
    outputFileTracingRoot: __dirname,
  },
};

export default nextConfig;
