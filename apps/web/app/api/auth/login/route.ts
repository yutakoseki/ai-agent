// ログインAPI

import { NextRequest, NextResponse } from 'next/server';
import type { LoginRequest, LoginResponse } from '@shared/auth';
import { AppError } from '@shared/error';
import { createAccessToken, getAccessTokenExpiresInSeconds } from '@/lib/auth/jwt';
import { setSessionCookie } from '@/lib/auth/session';
import { handleError } from '@/lib/middleware/error';
import { requireCsrf } from '@/lib/middleware/csrf';
import { consumeRateLimit } from '@/lib/middleware/rateLimit';
import { loginWithCognito, verifyCognitoIdToken } from '@/lib/auth/cognito';
import { findUserByUserId } from '@/lib/repos/userRepo';
import { buildRequestContext, logRequestEnd, logRequestStart } from '@/lib/observability';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);
  const csrfError = requireCsrf(request, context.traceId);
  if (csrfError) return csrfError;

  logRequestStart(request, context, 'POST /api/auth/login');
  let response: NextResponse | undefined;
  let actorUserId: string | undefined;
  let actorTenantId: string | undefined;

  try {
    const body: LoginRequest = await request.json();

    const rateLimitResult = consumeRateLimit({
      key: `auth_login:${context.clientIp ?? 'unknown'}:${body.email?.toLowerCase() ?? 'unknown'}`,
      windowMs: 60_000,
      limit: 5,
      traceId: context.traceId,
      label: 'auth_login',
    });
    if (rateLimitResult.response) {
      response = rateLimitResult.response;
      return response;
    }

    // バリデーション
    if (!body.email || !body.password) {
      throw new AppError('BAD_REQUEST', 'メールアドレスとパスワードは必須です');
    }

    const cognitoTokens = await loginWithCognito(body.email, body.password);
    const idToken = cognitoTokens.idToken;
    const payload = await verifyCognitoIdToken(idToken);
    const userId = payload.sub;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'ユーザー情報が取得できません');
    }

    const user = await findUserByUserId(userId);
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'ユーザーが見つかりません');
    }
    actorUserId = user.id;
    actorTenantId = user.tenantId;

    // セッション作成
    const expiresInSeconds = getAccessTokenExpiresInSeconds();
    const session = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };

    // トークン生成
    const accessToken = await createAccessToken(session);
    const refreshToken = cognitoTokens.refreshToken;
    if (!refreshToken) {
      throw new AppError('INTERNAL_ERROR', 'リフレッシュトークンが取得できません');
    }

    // レスポンス
    const loginResponse: LoginResponse = {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: {
        accessToken,
        refreshToken,
        expiresIn: expiresInSeconds,
      },
    };

    // Cookieにセッション設定
    const setCookie = setSessionCookie(accessToken, expiresInSeconds);

    response = NextResponse.json(loginResponse, {
      status: 200,
      headers: {
        'Set-Cookie': setCookie,
        'X-Trace-Id': context.traceId,
      },
    });

    writeAuditLog({
      action: 'auth.login',
      result: 'success',
      actorUserId,
      tenantId: actorTenantId,
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      target: { email: user.email },
      metadata: { path: '/api/auth/login', method: 'POST' },
    });

    return response;
  } catch (error) {
    response = handleError(error, context.traceId, 'POST /api/auth/login');

    writeAuditLog({
      action: 'auth.login',
      result: 'failure',
      actorUserId,
      tenantId: actorTenantId,
      traceId: context.traceId,
      ip: context.clientIp,
      userAgent: context.userAgent,
      metadata: { path: '/api/auth/login', method: 'POST' },
      reason: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return response;
  } finally {
    logRequestEnd(context, response?.status ?? 500, 'POST /api/auth/login', {
      userId: actorUserId,
      tenantId: actorTenantId,
    });
  }
}
