// JWT生成・検証ユーティリティ

import { SignJWT, jwtVerify } from "jose";
import type { Session } from "@shared/auth";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-for-dev-only"
);

export async function createAccessToken(session: Session): Promise<string> {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";

  return new SignJWT({
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    email: session.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function createRefreshToken(userId: string): Promise<string> {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      role: payload.role as Session["role"],
      email: payload.email as string,
      expiresAt: new Date((payload.exp || 0) * 1000),
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.userId as string;
  } catch {
    return null;
  }
}
