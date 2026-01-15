import { createHmac, randomBytes } from "crypto";

export function percentEncode(input: string): string {
  return encodeURIComponent(input)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function createNonce(): string {
  return randomBytes(16).toString("hex");
}

export function buildSignature(
  params: Record<string, string>,
  method: string,
  baseUrl: string,
  signingKey: string
): string {
  const sorted = Object.entries(params).sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });
  const parameterString = sorted
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(parameterString),
  ].join("&");
  return createHmac("sha1", signingKey).update(baseString).digest("base64");
}

export function buildOAuthHeader(params: Record<string, string>): string {
  const header = Object.entries(params)
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}
