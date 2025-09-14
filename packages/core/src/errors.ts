/**
 * Domain error hierarchy for the core services
 */

export interface ErrorMeta {
  [key: string]: any;
}

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly meta?: ErrorMeta,
    cause?: Error
  ) {
    super(message);
    this.name = 'DomainError';
    this.cause = cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      meta: this.meta,
      stack: this.stack,
    };
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, meta?: ErrorMeta, cause?: Error) {
    super(message, 'VALIDATION_ERROR', meta, cause);
    this.name = 'ValidationError';
  }
}

export class RuleViolation extends DomainError {
  constructor(
    message: string,
    public readonly rule: string,
    public readonly violatingItems?: any[],
    meta?: ErrorMeta,
    cause?: Error
  ) {
    super(message, 'RULE_VIOLATION', { ...meta, rule, violatingItems }, cause);
    this.name = 'RuleViolation';
  }
}

export class PlanningError extends DomainError {
  constructor(message: string, meta?: ErrorMeta, cause?: Error) {
    super(message, 'PLANNING_ERROR', meta, cause);
    this.name = 'PlanningError';
  }
}

export class IdempotencyError extends DomainError {
  constructor(message: string, meta?: ErrorMeta, cause?: Error) {
    super(message, 'IDEMPOTENCY_ERROR', meta, cause);
    this.name = 'IdempotencyError';
  }
}

export class ConstraintError extends DomainError {
  constructor(
    message: string,
    public readonly constraint: string,
    public readonly violatingValue?: any,
    meta?: ErrorMeta,
    cause?: Error
  ) {
    super(message, 'CONSTRAINT_ERROR', { ...meta, constraint, violatingValue }, cause);
    this.name = 'ConstraintError';
  }
}

export class SelectionError extends DomainError {
  constructor(message: string, meta?: ErrorMeta, cause?: Error) {
    super(message, 'SELECTION_ERROR', meta, cause);
    this.name = 'SelectionError';
  }
}

/**
 * Error aggregator for collecting multiple validation errors
 */
export class AggregateError extends DomainError {
  constructor(
    message: string,
    public readonly errors: DomainError[],
    meta?: ErrorMeta
  ) {
    super(message, 'AGGREGATE_ERROR', { ...meta, errorCount: errors.length });
    this.name = 'AggregateError';
  }

  static from(errors: DomainError[], message?: string): AggregateError {
    const defaultMessage = `Multiple errors occurred: ${errors.length} error(s)`;
    return new AggregateError(message || defaultMessage, errors);
  }
}

/**
 * Utility functions for error handling
 */

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isRuleViolation(error: unknown): error is RuleViolation {
  return error instanceof RuleViolation;
}

export function isPlanningError(error: unknown): error is PlanningError {
  return error instanceof PlanningError;
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Collect and validate multiple operations, returning either all results or all errors
 */
export function collectResults<T, E extends DomainError>(
  operations: Array<{ success: boolean; value?: T; error?: E }>
): { success: true; values: T[] } | { success: false; errors: E[] } {
  const values: T[] = [];
  const errors: E[] = [];

  for (const op of operations) {
    if (op.success && op.value !== undefined) {
      values.push(op.value);
    } else if (!op.success && op.error) {
      errors.push(op.error);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, values };
}

/**
 * Safe wrapper for domain operations that may throw
 */
export function safeOperation<T>(
  operation: () => T,
  errorMapper?: (error: unknown) => DomainError
): { success: true; value: T } | { success: false; error: DomainError } {
  try {
    const value = operation();
    return { success: true, value };
  } catch (error) {
    const domainError = errorMapper ? errorMapper(error) :
      isDomainError(error) ? error :
      new DomainError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, 'UNEXPECTED_ERROR');

    return { success: false, error: domainError };
  }
}