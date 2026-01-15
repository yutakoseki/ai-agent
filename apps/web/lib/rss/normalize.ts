export function normalizeUrl(input: string): string {
  const parsed = new URL(input);
  parsed.hash = "";

  const params = new URLSearchParams(parsed.search);
  for (const key of Array.from(params.keys())) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || lower === "ref" || lower === "fbclid") {
      params.delete(key);
    }
  }

  if (Array.from(params.keys()).length) {
    const sorted = Array.from(params.keys()).sort();
    const next = new URLSearchParams();
    for (const key of sorted) {
      for (const value of params.getAll(key)) {
        next.append(key, value);
      }
    }
    parsed.search = next.toString();
  } else {
    parsed.search = "";
  }

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}
