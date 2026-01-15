import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@shared/error";
import { requireAuth } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { createOAuthState, verifyOAuthState } from "@/lib/mail/oauthState";
import { decryptSecret, encryptSecret } from "@/lib/mail/tokenVault";
import { getXAccountByUser, saveXAccessToken, saveXAuthRequest } from "@/lib/repos/xAccountRepo";
import { buildXAuthorizeUrl, exchangeXAccessToken, requestXRequestToken } from "@/lib/x-posts/oauth";

export const runtime = "nodejs";

const REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const oauthToken = request.nextUrl.searchParams.get("oauth_token");
    const oauthVerifier = request.nextUrl.searchParams.get("oauth_verifier");
    const denied = request.nextUrl.searchParams.get("denied");
    const stateParam = request.nextUrl.searchParams.get("state");

    if (denied) {
      throw new AppError("BAD_REQUEST", "X連携がキャンセルされました");
    }

    if (!oauthToken || !oauthVerifier) {
      const { context, response } = await requireAuth(request);
      if (response) return response;

      const redirectParam = request.nextUrl.searchParams.get("redirect") ?? undefined;
      const redirect = redirectParam && redirectParam.startsWith("/") ? redirectParam : undefined;
      const state = await createOAuthState({
        tenantId: context.session.tenantId,
        userId: context.session.userId,
        provider: "x",
        redirect,
      });

      const callbackUrl = `${request.nextUrl.origin}/api/auth/x?state=${encodeURIComponent(
        state
      )}`;
      const requestToken = await requestXRequestToken({
        callbackUrl,
        traceId: context.traceId,
      });
      await saveXAuthRequest({
        tenantId: context.session.tenantId,
        userId: context.session.userId,
        requestToken: requestToken.oauthToken,
        requestTokenSecretEnc: encryptSecret(requestToken.oauthTokenSecret),
        requestTokenExpiresAt: new Date(Date.now() + REQUEST_TOKEN_TTL_MS).toISOString(),
      });

      return NextResponse.redirect(buildXAuthorizeUrl(requestToken.oauthToken));
    }

    if (!stateParam) {
      throw new AppError("BAD_REQUEST", "stateが不正です");
    }

    const state = await verifyOAuthState(stateParam);
    if (!state || state.provider !== "x") {
      throw new AppError("BAD_REQUEST", "stateが不正です");
    }

    const account = await getXAccountByUser({
      tenantId: state.tenantId,
      userId: state.userId,
    });
    if (!account?.requestToken || account.requestToken !== oauthToken) {
      throw new AppError("BAD_REQUEST", "Xの認証状態が不正です");
    }
    if (account.requestTokenExpiresAt) {
      const expiresAt = new Date(account.requestTokenExpiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
        throw new AppError("BAD_REQUEST", "Xの認証が期限切れです");
      }
    }
    if (!account.requestTokenSecretEnc) {
      throw new AppError("BAD_REQUEST", "Xの認証情報が不足しています");
    }

    const requestTokenSecret = decryptSecret(account.requestTokenSecretEnc);
    const access = await exchangeXAccessToken({
      oauthToken,
      oauthVerifier,
      requestTokenSecret,
    });

    await saveXAccessToken({
      tenantId: state.tenantId,
      userId: state.userId,
      accessTokenEnc: encryptSecret(access.accessToken),
      accessTokenSecretEnc: encryptSecret(access.accessTokenSecret),
      xUserId: access.userId,
      screenName: access.screenName,
    });

    const redirectPath = state.redirect ?? "/rss";
    return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}`);
  } catch (error) {
    return handleError(error, undefined, "GET /api/auth/x");
  }
}
