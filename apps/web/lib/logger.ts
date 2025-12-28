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

const currentLevel = normalizeLevel();
const debugSampling = normalizeSampling();

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
  meta?: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    msg,
  };
  if (meta) {
    payload.meta = normalizeMeta(meta);
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

  if (level === "fatal" || level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
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

