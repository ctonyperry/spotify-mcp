export interface ErrorMeta {
  [key: string]: unknown;
}

export abstract class BaseError extends Error {
  public readonly timestamp: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
    public readonly meta?: ErrorMeta
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for V8 (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      meta: this.meta,
      cause: this.cause?.message,
    };
  }
}