export type SignatureIdentity = {
  company?: string;
  person?: string;
};

function normalizeLine(s: string): string {
  return s.replace(/\r/g, "").trim();
}

function isSeparatorLine(s: string): boolean {
  const t = s.replace(/\s/g, "");
  if (!t) return false;
  // "――――――" / "------" / "____" / "===="
  return (
    /^[―—ー\-_=]{6,}$/.test(t) ||
    /^[\u2015\u2014\u2500\u30fc\-_=]{6,}$/.test(t) ||
    /^―{4,}$/.test(t) ||
    /^ー{6,}$/.test(t)
  );
}

function looksLikeEmailOrPhone(s: string): boolean {
  return /@/.test(s) || /(tel|phone|電話|fax)/i.test(s) || /\d{2,4}-\d{2,4}-\d{3,4}/.test(s);
}

function pickCompany(lines: string[]): string | undefined {
  const candidates = lines.filter(Boolean).filter((l) => !looksLikeEmailOrPhone(l));
  const companyLine =
    candidates.find((l) => /(株式会社|有限会社|合同会社|inc\.?|llc|ltd\.?|corp\.?|company|co\.)/i.test(l)) ??
    candidates.find((l) => /[一-龥]{2,}(?:会社|法人|グループ)/.test(l));
  return companyLine?.replace(/\s+/g, " ").trim() || undefined;
}

function pickPerson(lines: string[]): string | undefined {
  const candidates = lines
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((l) => !looksLikeEmailOrPhone(l));

  for (const l of candidates) {
    // "経理部 佐藤 健一" / "佐藤 健一"
    const cleaned = l
      .replace(/^[^一-龥]*?/g, "")
      .replace(/(部|課|室|担当|役員|マネージャー|Mgr\.?)\s*/g, " ")
      .trim();
    // 部署名などが前に付く場合があるので「最後に出てくる氏名っぽい2語」を取る
    const matches = Array.from(cleaned.matchAll(/([一-龥]{1,4})\s*([一-龥]{1,4})/g));
    const m = matches.length ? matches[matches.length - 1] : null;
    if (!m) continue;
    const last = String(m[1]).trim();
    const first = String(m[2]).trim();
    const name = `${last} ${first}`.trim();
    if (name.length >= 3) return name;
  }
  return undefined;
}

export function inferSignatureIdentity(bodyText?: string): SignatureIdentity | null {
  const raw = (bodyText ?? "").trim();
  if (!raw) return null;

  const allLines = raw.split("\n").map(normalizeLine);
  // 末尾の方が署名である可能性が高いので、最後の40行だけ見る
  const tail = allLines.slice(Math.max(0, allLines.length - 40));

  // 署名区切りを探す
  let startIdx = -1;
  for (let i = tail.length - 1; i >= 0; i--) {
    if (isSeparatorLine(tail[i])) {
      startIdx = i + 1;
      break;
    }
  }

  const slice = (startIdx >= 0 ? tail.slice(startIdx) : tail.slice(-12))
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const company = pickCompany(slice);
  const person = pickPerson(slice);

  if (!company && !person) return null;
  return { company, person };
}

export function formatSignatureCounterparty(identity: SignatureIdentity | null): string | undefined {
  if (!identity) return undefined;
  const company = identity.company?.trim();
  const person = identity.person?.trim();
  if (company && person) return `${company} ${person}`.trim();
  return company || person || undefined;
}


