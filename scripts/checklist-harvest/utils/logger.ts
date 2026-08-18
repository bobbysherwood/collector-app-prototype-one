export interface LogEvent {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  event: string;
  run_id?: string;
  catalog_id?: string;
  brand?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface LoggerOptions {
  verbose?: boolean;
  jsonLogs?: boolean;
  runId?: string;
}

export class Logger {
  constructor(private options: LoggerOptions = {}) {}

  private emit(level: LogEvent["level"], event: string, fields: Partial<LogEvent> = {}) {
    const payload: LogEvent = {
      ts: new Date().toISOString(),
      level,
      event,
      run_id: this.options.runId,
      ...fields,
    };

    if (level === "debug" && !this.options.verbose) return;

    if (this.options.jsonLogs) {
      console.log(JSON.stringify(payload));
      return;
    }

    const prefix = `[${level.toUpperCase()}] ${event}`;
    const msg = fields.message ? `: ${fields.message}` : "";
    const extra = fields.catalog_id ? ` (${fields.catalog_id})` : "";
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${prefix}${extra}${msg}`);
  }

  info(event: string, fields?: Partial<LogEvent>) {
    this.emit("info", event, fields);
  }

  warn(event: string, fields?: Partial<LogEvent>) {
    this.emit("warn", event, fields);
  }

  error(event: string, fields?: Partial<LogEvent>) {
    this.emit("error", event, fields);
  }

  debug(event: string, fields?: Partial<LogEvent>) {
    this.emit("debug", event, fields);
  }
}
