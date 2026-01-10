export type ParsedFrom = {
  name?: string;
  email?: string;
};

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function parseFromHeader(input: string | null | undefined): ParsedFrom {
  const raw = String(input ?? "").trim();
  if (!raw) return {};

  // e.g. Name <a@b.com>
  const m = raw.match(/^(.*)<([^>]+)>$/);
  if (m) {
    const name = stripQuotes(m[1].trim()).replace(/\s+/g, " ").trim();
    const email = m[2].trim();
    return { name: name || undefined, email: email || undefined };
  }

  // e.g. just email
  if (raw.includes("@") && !raw.includes(" ")) return { email: raw };

  // fallback: treat raw as name-ish
  return { name: stripQuotes(raw) || undefined };
}

export function formatFromForDisplay(input: string | null | undefined): string {
  const parsed = parseFromHeader(input);
  if (parsed.name) return parsed.name;
  if (parsed.email) return parsed.email;
  return "（不明）";
}


