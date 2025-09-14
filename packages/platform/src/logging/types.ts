export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  toolName?: string;
  durationMs?: number;
  retryCount?: number;
  [key: string]: unknown;
}

export interface LogEntry extends LogContext {
  level: LogLevel;
  ts: string;
  message: string;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  withContext(context: LogContext): Logger;
}