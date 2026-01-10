import { SignJWT, jwtVerify } from "jose";

export type OAuthState = {
  tenantId: string;
  userId: string;
  provider: "gmail" | "outlook";
  redirect?: string;
};

const STATE_SECRET = new TextEncoder().encode(
  process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || "dev-only"
);

export async function createOAuthState(payload: OAuthState): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(STATE_SECRET);
}

export async function verifyOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, STATE_SECRET);
    return {
      tenantId: String(payload.tenantId),
      userId: String(payload.userId),
      provider: payload.provider as OAuthState["provider"],
      redirect: payload.redirect ? String(payload.redirect) : undefined,
    };
  } catch {
    return null;
  }
}

