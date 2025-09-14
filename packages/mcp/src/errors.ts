/**
 * MCP Error Mapping - Convert domain/adapter errors to MCP-safe errors
 */

import { DomainError, ValidationError } from '@spotify-mcp/core';
import { HttpError, AuthError, RateLimitError } from '@spotify-mcp/platform';

export interface MCPError {
  code: string;
  message: string;
  retryAfterMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Convert domain and adapter errors to MCP-safe error shapes
 */
export function mapToMCPError(error: unknown): MCPError {
  // Domain errors
  if (error instanceof ValidationError) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: { validationErrors: error.details },
    };
  }

  if (error instanceof DomainError) {
    return {
      code: 'DOMAIN_ERROR',
      message: error.message,
      details: error.details ? { context: error.details } : undefined,
    };
  }

  // Platform/adapter errors
  if (error instanceof AuthError) {
    return {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      retryAfterMs: 60000, // Retry after 1 minute
    };
  }

  if (error instanceof RateLimitError) {
    return {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      retryAfterMs: error.retryAfterMs || 60000,
    };
  }

  if (error instanceof HttpError) {
    // Map specific HTTP status codes
    switch (error.status) {
      case 401:
      case 403:
        return {
          code: 'AUTH_ERROR',
          message: 'Authentication required',
          retryAfterMs: 60000,
        };
      case 429:
        return {
          code: 'RATE_LIMIT',
          message: 'Too many requests',
          retryAfterMs: error.retryAfterMs || 60000,
        };
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters',
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        };
      default:
        return {
          code: 'HTTP_ERROR',
          message: `HTTP ${error.status}`,
        };
    }
  }

  // Generic fallback (never include raw errors or secrets)
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * Create a user-friendly error message for MCP responses
 */
export function formatMCPErrorMessage(mcpError: MCPError): string {
  const baseMessage = mcpError.message;

  if (mcpError.retryAfterMs) {
    const seconds = Math.ceil(mcpError.retryAfterMs / 1000);
    return `${baseMessage}. Retry after ${seconds} seconds.`;
  }

  return baseMessage;
}