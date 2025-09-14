/**
 * Request Context - Provides requestId, logging, and timing for MCP handlers
 */

import { Logger } from '@spotify-mcp/platform';
import { randomUUID } from 'crypto';

export interface MCPContext {
  requestId: string;
  logger: Logger;
  toolName: string;
  startTime: number;
}

/**
 * Create a new MCP request context
 */
export function createMCPContext(
  baseLogger: Logger,
  toolName: string,
  requestId?: string
): MCPContext {
  const id = requestId || randomUUID();
  const logger = baseLogger.child({ requestId: id, toolName });

  return {
    requestId: id,
    logger,
    toolName,
    startTime: Date.now(),
  };
}

/**
 * Log completion metrics for an MCP request
 */
export function logMCPCompletion(
  context: MCPContext,
  result: 'success' | 'error',
  itemCount?: number
): void {
  const durationMs = Date.now() - context.startTime;

  const logData = {
    toolName: context.toolName,
    requestId: context.requestId,
    durationMs,
    result,
    ...(itemCount !== undefined && { itemCount }),
  };

  if (result === 'success') {
    context.logger.info('MCP request completed', logData);
  } else {
    context.logger.error('MCP request failed', logData);
  }
}

/**
 * Wrap an MCP handler with context and error handling
 */
export async function withMCPContext<TInput, TOutput>(
  baseLogger: Logger,
  toolName: string,
  handler: (context: MCPContext, input: TInput) => Promise<TOutput>,
  input: TInput,
  requestId?: string
): Promise<TOutput> {
  const context = createMCPContext(baseLogger, toolName, requestId);

  try {
    context.logger.debug('MCP request started', {
      toolName,
      requestId: context.requestId,
    });

    const result = await handler(context, input);

    logMCPCompletion(context, 'success');
    return result;

  } catch (error) {
    logMCPCompletion(context, 'error');
    context.logger.error('MCP handler error', {
      toolName,
      requestId: context.requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}