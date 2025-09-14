import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, StructuredLogger } from '../../logging/logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should create logger with default level', () => {
    const logger = createLogger();
    expect(logger).toBeInstanceOf(StructuredLogger);
  });

  it('should respect log level filtering', () => {
    const logger = createLogger('warn');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleSpy).toHaveBeenCalledTimes(2); // Only warn and error
  });

  it('should output structured JSON logs', () => {
    const logger = createLogger('debug');
    
    logger.info('test message', { requestId: 'req-123', toolName: 'test-tool' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"level":"info"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"test message"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"req-123"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"toolName":"test-tool"')
    );
  });

  it('should include timestamp in ISO format', () => {
    const logger = createLogger();
    
    logger.info('test message');

    const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
    const logEntry = JSON.parse(logOutput);
    
    expect(logEntry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should create child logger with context', () => {
    const logger = createLogger();
    const childLogger = logger.withContext({ requestId: 'req-123', toolName: 'test' });
    
    childLogger.info('child message', { durationMs: 100 });

    const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
    const logEntry = JSON.parse(logOutput);
    
    expect(logEntry.requestId).toBe('req-123');
    expect(logEntry.toolName).toBe('test');
    expect(logEntry.durationMs).toBe(100);
  });

  it('should mask sensitive fields in logs', () => {
    const logger = createLogger();
    
    logger.info('auth info', {
      accessToken: 'secret-token-123',
      refreshToken: 'secret-refresh-456',
      client_secret: 'very-secret',
      password: 'my-password',
      normalField: 'normal-value'
    });

    const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
    const logEntry = JSON.parse(logOutput);
    
    expect(logEntry.accessToken).toBe('[REDACTED]');
    expect(logEntry.refreshToken).toBe('[REDACTED]');
    expect(logEntry.client_secret).toBe('[REDACTED]');
    expect(logEntry.password).toBe('[REDACTED]');
    expect(logEntry.normalField).toBe('normal-value');
  });

  it('should merge context correctly in child loggers', () => {
    const logger = createLogger();
    const childLogger = logger.withContext({ requestId: 'req-123', shared: 'base' });
    
    childLogger.info('test', { shared: 'override', extra: 'value' });

    const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
    const logEntry = JSON.parse(logOutput);
    
    expect(logEntry.requestId).toBe('req-123');
    expect(logEntry.shared).toBe('override'); // Context should be overrideable
    expect(logEntry.extra).toBe('value');
  });

  it('should handle all log levels', () => {
    const logger = createLogger('debug');
    
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    expect(consoleSpy).toHaveBeenCalledTimes(4);
    
    const levels = consoleSpy.mock.calls.map(call => {
      const logEntry = JSON.parse(call[0] as string);
      return logEntry.level;
    });
    
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });
});