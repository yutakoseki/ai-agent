import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AppError } from "@shared/error";

type CognitoAuthFlow = "USER_PASSWORD_AUTH" | "ADMIN_USER_PASSWORD_AUTH";

type CognitoTokens = {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret?: string;
  authFlow: CognitoAuthFlow;
  issuer: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const clientCache = new Map<string, CognitoIdentityProviderClient>();

function getConfig(): CognitoConfig {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET || undefined;
  const rawAuthFlow = process.env.COGNITO_AUTH_FLOW;
  const authFlow: CognitoAuthFlow =
    rawAuthFlow === "ADMIN_USER_PASSWORD_AUTH"
      ? "ADMIN_USER_PASSWORD_AUTH"
      : "USER_PASSWORD_AUTH";

  if (!region || !userPoolId || !clientId) {
    throw new AppError("INTERNAL_ERROR", "Cognito設定が不足しています");
  }

  return {
    region,
    userPoolId,
    clientId,
    clientSecret,
    authFlow,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}

function getClient(region: string): CognitoIdentityProviderClient {
  const existing = clientCache.get(region);
  if (existing) return existing;
  const client = new CognitoIdentityProviderClient({ region });
  clientCache.set(region, client);
  return client;
}

function getJwks(issuer: string) {
  const existing = jwksCache.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwksCache.set(issuer, jwks);
  return jwks;
}

function buildSecretHash(
  username: string | undefined,
  clientId: string,
  clientSecret?: string
): string | undefined {
  if (!clientSecret || !username) return undefined;
  return createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

function mapCognitoError(error: unknown, message: string): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    if (
      name === "NotAuthorizedException" ||
      name === "UserNotFoundException"
    ) {
      return new AppError("UNAUTHORIZED", message);
    }
    if (name === "PasswordResetRequiredException") {
      return new AppError("UNAUTHORIZED", "パスワードの再設定が必要です");
    }
  }
  return new AppError("INTERNAL_ERROR", "認証に失敗しました");
}

function mapCognitoProvisionError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    if (name === "UsernameExistsException") {
      return new AppError("BAD_REQUEST", "このメールアドレスは既に使用されています");
    }
    if (name === "InvalidPasswordException") {
      return new AppError("BAD_REQUEST", "パスワードが要件を満たしていません");
    }
    if (name === "InvalidParameterException") {
      return new AppError("BAD_REQUEST", "入力内容が正しくありません");
    }
  }
  return new AppError("INTERNAL_ERROR", "ユーザー作成に失敗しました");
}

export async function loginWithCognito(
  username: string,
  password: string
): Promise<CognitoTokens> {
  const config = getConfig();
  const client = getClient(config.region);
  const secretHash = buildSecretHash(username, config.clientId, config.clientSecret);

  const authParameters: Record<string, string> = {
    USERNAME: username,
    PASSWORD: password,
  };
  if (secretHash) {
    authParameters.SECRET_HASH = secretHash;
  }

  try {
    if (config.authFlow === "ADMIN_USER_PASSWORD_AUTH") {
      const command = new AdminInitiateAuthCommand({
        UserPoolId: config.userPoolId,
        ClientId: config.clientId,
        AuthFlow: config.authFlow,
        AuthParameters: authParameters,
      });
      const result = await client.send(command);
      if (!result.AuthenticationResult?.IdToken) {
        throw new AppError("UNAUTHORIZED", "認証に失敗しました");
      }
      return {
        idToken: result.AuthenticationResult.IdToken,
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      };
    }

    const command = new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: config.authFlow,
      AuthParameters: authParameters,
    });
    const result = await client.send(command);
    if (!result.AuthenticationResult?.IdToken) {
      throw new AppError("UNAUTHORIZED", "認証に失敗しました");
    }
    return {
      idToken: result.AuthenticationResult.IdToken,
      accessToken: result.AuthenticationResult.AccessToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
    };
  } catch (error) {
    throw mapCognitoError(error, "メールアドレスまたはパスワードが正しくありません");
  }
}

export async function createCognitoUser(
  email: string,
  password: string,
  name?: string
): Promise<{ sub: string }> {
  const config = getConfig();
  const client = getClient(config.region);
  let createdUsername: string | null = null;

  try {
    const attributes = [
      { Name: "email", Value: email },
      { Name: "email_verified", Value: "true" },
    ];
    if (name) {
      attributes.push({ Name: "name", Value: name });
    }

    const createResult = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: config.userPoolId,
        Username: email,
        UserAttributes: attributes,
        MessageAction: "SUPPRESS",
      })
    );
    createdUsername = email;

    const sub = createResult.User?.Attributes?.find(
      (attribute) => attribute.Name === "sub"
    )?.Value;
    if (!sub) {
      throw new AppError("INTERNAL_ERROR", "CognitoユーザーIDが取得できません");
    }

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: config.userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      })
    );

    return { sub };
  } catch (error) {
    if (createdUsername) {
      try {
        await client.send(
          new AdminDeleteUserCommand({
            UserPoolId: config.userPoolId,
            Username: createdUsername,
          })
        );
      } catch {
        // cleanup failure should not hide the original error
      }
    }
    throw mapCognitoProvisionError(error);
  }
}

export async function deleteCognitoUser(email: string): Promise<void> {
  const config = getConfig();
  const client = getClient(config.region);

  try {
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: config.userPoolId,
        Username: email,
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("INTERNAL_ERROR", "Cognitoユーザー削除に失敗しました");
  }
}

export async function refreshWithCognito(
  refreshToken: string,
  username?: string
): Promise<CognitoTokens> {
  const config = getConfig();
  const client = getClient(config.region);
  const secretHash = buildSecretHash(username, config.clientId, config.clientSecret);

  if (config.clientSecret && !secretHash) {
    throw new AppError("BAD_REQUEST", "メールアドレスが必要です");
  }

  const authParameters: Record<string, string> = {
    REFRESH_TOKEN: refreshToken,
  };
  if (secretHash) {
    authParameters.SECRET_HASH = secretHash;
  }
  if (username) {
    authParameters.USERNAME = username;
  }

  try {
    const command = new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: authParameters,
    });
    const result = await client.send(command);
    if (!result.AuthenticationResult?.IdToken) {
      throw new AppError("UNAUTHORIZED", "リフレッシュトークンが無効です");
    }
    return {
      idToken: result.AuthenticationResult.IdToken,
      accessToken: result.AuthenticationResult.AccessToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
    };
  } catch (error) {
    throw mapCognitoError(error, "リフレッシュトークンが無効です");
  }
}

export async function verifyCognitoIdToken(
  idToken: string
): Promise<JWTPayload> {
  const config = getConfig();
  const jwks = getJwks(config.issuer);

  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
    });

    if (payload.token_use !== "id") {
      throw new AppError("UNAUTHORIZED", "不正なトークンです");
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("UNAUTHORIZED", "不正なトークンです");
  }
}
