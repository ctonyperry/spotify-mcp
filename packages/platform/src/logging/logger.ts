import { type LogLevel, type LogContext, type LogEntry, type Logger } from './types.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function maskSensitiveFields(context: LogContext): LogContext {
  const masked = { ...context };
  
  // Mask sensitive fields
  const sensitiveKeys = [
    'token', 'accessToken', 'refreshToken', 'secret', 'password', 
    'key', 'authorization', 'client_secret'
  ];
  
  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      masked[key] = '[REDACTED]';
    }
  }
  
  return masked;
}

export class StructuredLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel = 'info',
    private readonly baseContext: LogContext = {}
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const mergedContext = { ...this.baseContext, ...context };
    const maskedContext = maskSensitiveFields(mergedContext);

    const entry: LogEntry = {
      level,
      ts: new Date().toISOString(),
      message,
      ...maskedContext,
    };

    // Use stderr for structured logs to avoid interfering with MCP JSON communication
    console.error(JSON.stringify(entry));
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  withContext(context: LogContext): Logger {
    return new StructuredLogger(this.minLevel, { ...this.baseContext, ...context });
  }
}

export function createLogger(level: LogLevel = 'info'): Logger {
  return new StructuredLogger(level);
}