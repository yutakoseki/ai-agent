function toHalfWidthDigits(input: string): string {
  // 全角数字 -> 半角数字
  return input.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function clampMonthDay(month: number, day: number): { month: number; day: number } | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
}

function toIsoDateOnlyUTC(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Dateが繰り上がっていないか簡易チェック
  if (d.getUTCFullYear() !== year) return null;
  if (d.getUTCMonth() !== month - 1) return null;
  if (d.getUTCDate() !== day) return null;
  return d.toISOString();
}

function chooseYear(now: Date, month: number, day: number): number {
  // 年が省略されている場合:
  // まず今年を採用。ただし「明らかに過去」(90日以上前) なら来年扱いにする。
  const thisYear = now.getUTCFullYear();
  const isoThis = toIsoDateOnlyUTC(thisYear, month, day);
  if (!isoThis) return thisYear;
  const dt = new Date(isoThis).getTime();
  const diffDays = (dt - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < -90) return thisYear + 1;
  return thisYear;
}

export function inferDueAtISO(params: { text?: string; now?: Date }): string | undefined {
  const raw = (params.text ?? "").trim();
  if (!raw) return undefined;
  const now = params.now ?? new Date();
  const text = toHalfWidthDigits(raw);

  // 代表的な相対表現（最低限）
  if (/(本日中|今日中)/.test(text)) {
    return toIsoDateOnlyUTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()) ?? undefined;
  }
  if (/(明日中|明日まで)/.test(text)) {
    const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return toIsoDateOnlyUTC(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()) ?? undefined;
  }

  // yyyy/mm/dd (期限ワードが近傍にあるものを優先)
  const ymdDeadline = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})[^\n\r]{0,12}(まで|までに|期限|締切|〆|〆切|〆切り)/g;
  let m: RegExpExecArray | null;
  while ((m = ymdDeadline.exec(text))) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const md = clampMonthDay(month, day);
    if (!md) continue;
    const iso = toIsoDateOnlyUTC(year, md.month, md.day);
    if (iso) return iso;
  }

  // mm/dd or m月d日 + (まで|期限|締切 ...)
  const mdDeadline =
    /(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})\s*(?:日)?\s*(?:[\(（]?[月火水木金土日](?:曜)?[\)）]?)?\s*(まで|までに|期限|締切|〆|〆切|〆切り)/g;
  while ((m = mdDeadline.exec(text))) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const md = clampMonthDay(month, day);
    if (!md) continue;
    const year = chooseYear(now, md.month, md.day);
    const iso = toIsoDateOnlyUTC(year, md.month, md.day);
    if (iso) return iso;
  }

  // 「1/31（金）までに、」みたいに句読点が挟まるケース（ワードが後ろに続く）
  const mdLoose =
    /(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})\s*(?:日)?\s*(?:[\(（]?[月火水木金土日](?:曜)?[\)）]?)[^\n\r]{0,12}?(まで|までに|期限|締切|〆|〆切|〆切り)/g;
  while ((m = mdLoose.exec(text))) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const md = clampMonthDay(month, day);
    if (!md) continue;
    const year = chooseYear(now, md.month, md.day);
    const iso = toIsoDateOnlyUTC(year, md.month, md.day);
    if (iso) return iso;
  }

  return undefined;
}


