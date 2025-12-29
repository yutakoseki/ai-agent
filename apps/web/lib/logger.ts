type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

function normalizeLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (raw && raw in LEVEL_PRIORITY) return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function normalizeSampling(): number {
  const raw = process.env.LOG_SAMPLING_DEBUG;
  if (raw === undefined) return 1;
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return 1;
  return parsed;
}

function normalizePretty(): boolean {
  const raw = process.env.LOG_PRETTY;
  return raw === "true";
}

const currentLevel = normalizeLevel();
const debugSampling = normalizeSampling();
const pretty = normalizePretty();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function sample(level: LogLevel): boolean {
  if (level === "debug" || level === "trace") {
    return Math.random() < debugSampling;
  }
  return true;
}

function formatPayload(
  level: LogLevel,
  msg: string,
  meta: Record<string, unknown> = {}
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    msg,
  };

  const normalizedMeta = normalizeMeta(meta);

  // よく使うコンテキストはトップレベルにフラット化
  for (const key of ["traceId", "requestId", "jobId", "tenantId", "userId", "label", "durationMs"]) {
    const value = normalizedMeta[key];
    if (value !== undefined) {
      payload[key] = value;
      delete normalizedMeta[key];
    }
  }

  if (Object.keys(normalizedMeta).length > 0) {
    payload.meta = normalizedMeta;
  }

  return payload;
}

function normalizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      continue;
    }
    result[key] = value;
  }
  return result;
}

function log(
  level: LogLevel,
  msg: string,
  meta?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;
  if (!sample(level)) return;

  const payload = formatPayload(level, msg, meta);

  const writer =
    level === "fatal" || level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  if (pretty) {
    writer(JSON.stringify(payload, null, 2));
  } else {
    writer(payload);
  }
}

export const logger = {
  fatal: (msg: string, meta?: Record<string, unknown>) =>
    log("fatal", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) =>
    log("error", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    log("debug", msg, meta),
  trace: (msg: string, meta?: Record<string, unknown>) =>
    log("trace", msg, meta),
};

