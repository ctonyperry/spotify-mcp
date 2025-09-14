import type { Logger } from '../logging/types.js';

export interface HttpOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryJitter?: boolean;
}

export interface HttpHooks {
  beforeRequest?(url: string, options: HttpOptions, requestId: string): void | Promise<void>;
  afterRequest?(url: string, response: Response, requestId: string, durationMs: number): void | Promise<void>;
  onRetry?(url: string, error: Error, attempt: number, requestId: string): void | Promise<void>;
}

export interface HttpClient {
  fetchJSON<T = unknown>(url: string, options?: HttpOptions): Promise<T>;
  setHooks(hooks: HttpHooks): void;
}