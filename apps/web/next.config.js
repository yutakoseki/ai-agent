/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildSafeEnv() {
  // NOTE:
  // Amplify(Web Compute) で server runtime に環境変数が降りてこないケースがあり、
  // サーバ側の `process.env.*` が undefined になって API が落ちることがある。
  // Cognitoの region/userPoolId/clientId は秘匿情報ではないため、ビルド時に埋め込んで安定化させる。
  const pairs = [
    ["COGNITO_REGION", process.env.COGNITO_REGION],
    ["COGNITO_USER_POOL_ID", process.env.COGNITO_USER_POOL_ID],
    ["COGNITO_CLIENT_ID", process.env.COGNITO_CLIENT_ID],
    ["COGNITO_AUTH_FLOW", process.env.COGNITO_AUTH_FLOW],
  ];
  return Object.fromEntries(pairs.filter(([, v]) => typeof v === "string" && v.length > 0));
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: buildSafeEnv(),
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
