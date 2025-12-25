// セッション管理ユーティリティ

import { cookies } from "next/headers";
import { serialize, parse } from "cookie";
import type { Session } from "@types/auth";
import { verifyAccessToken } from "./jwt";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE !== "false";

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}

export function setSessionCookie(token: string, maxAge: number): string {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(): string {
  return serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
