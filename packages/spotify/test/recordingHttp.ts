import * as fs from 'fs/promises';
import * as path from 'path';
import type { HttpLike } from '../src/types.js';

export interface CassetteRecord {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
  timestamp: string;
}

export interface Cassette {
  name: string;
  records: CassetteRecord[];
  version: string;
}

export class RecordingHttpClient implements HttpLike {
  private cassette: Cassette | null = null;
  private recordIndex = 0;
  private isRecording = false;

  constructor(
    private readonly realHttpClient: HttpLike,
    private readonly cassettesDir: string
  ) {}

  async loadCassette(name: string): Promise<void> {
    const cassettePath = path.join(this.cassettesDir, `${name}.json`);

    // Check if we're in recording mode
    this.isRecording = process.env.RECORD === '1';

    if (this.isRecording) {
      // In recording mode, start with empty cassette
      this.cassette = {
        name,
        records: [],
        version: '1.0.0',
      };
      this.recordIndex = 0;
    } else {
      // In replay mode, load existing cassette
      try {
        const content = await fs.readFile(cassettePath, 'utf-8');
        this.cassette = JSON.parse(content);
        this.recordIndex = 0;
      } catch (error) {
        throw new Error(
          `Failed to load cassette ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  async saveCassette(): Promise<void> {
    if (!this.cassette || !this.isRecording) {
      return;
    }

    const cassettePath = path.join(this.cassettesDir, `${this.cassette.name}.json`);

    // Ensure directory exists
    await fs.mkdir(this.cassettesDir, { recursive: true });

    // Save cassette with pretty formatting
    await fs.writeFile(cassettePath, JSON.stringify(this.cassette, null, 2));
  }

  async fetchJSON<T = unknown>(url: string, options: any = {}): Promise<T> {
    if (!this.cassette) {
      throw new Error('No cassette loaded. Call loadCassette() first.');
    }

    const method = options.method || 'GET';
    const headers = this.sanitizeHeaders(options.headers || {});
    const body = options.body;

    if (this.isRecording) {
      // Make real request and record it
      try {
        const response = await this.realHttpClient.fetchJSON<T>(url, options);

        // Create record
        const record: CassetteRecord = {
          request: {
            url: this.sanitizeUrl(url),
            method,
            headers,
            body,
          },
          response: {
            status: 200, // Assume success if no error thrown
            headers: {},
            body: response,
          },
          timestamp: new Date().toISOString(),
        };

        this.cassette.records.push(record);
        return response;
      } catch (error) {
        // Record the error response
        const record: CassetteRecord = {
          request: {
            url: this.sanitizeUrl(url),
            method,
            headers,
            body,
          },
          response: {
            status: error instanceof Error && 'status' in error ? (error as any).status : 500,
            headers: {},
            body: { error: error instanceof Error ? error.message : String(error) },
          },
          timestamp: new Date().toISOString(),
        };

        this.cassette.records.push(record);
        throw error;
      }
    } else {
      // Replay mode - find matching record
      const record = this.findMatchingRecord(url, method, headers);

      if (!record) {
        throw new Error(
          `No matching record found for ${method} ${this.sanitizeUrl(url)}. ` +
          `Available records: ${this.cassette.records.length}`
        );
      }

      // Simulate the response
      if (record.response.status >= 400) {
        const error = new Error(record.response.body.error || 'HTTP Error');
        (error as any).status = record.response.status;
        throw error;
      }

      return record.response.body as T;
    }
  }

  private findMatchingRecord(url: string, method: string, headers: Record<string, string>): CassetteRecord | null {
    if (!this.cassette) return null;

    const sanitizedUrl = this.sanitizeUrl(url);
    const sanitizedHeaders = this.sanitizeHeaders(headers);

    // Find exact match first
    for (let i = this.recordIndex; i < this.cassette.records.length; i++) {
      const record = this.cassette.records[i];

      if (
        record.request.url === sanitizedUrl &&
        record.request.method === method
      ) {
        // Found match, advance index
        this.recordIndex = i + 1;
        return record;
      }
    }

    // If no exact match found, look for URL and method match (less strict)
    for (let i = 0; i < this.cassette.records.length; i++) {
      const record = this.cassette.records[i];

      if (
        record.request.url === sanitizedUrl &&
        record.request.method === method
      ) {
        return record;
      }
    }

    return null;
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Remove sensitive query parameters
      const sensitiveParams = ['access_token', 'api_key', 'token'];
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive headers
      if (lowerKey === 'authorization' || lowerKey === 'cookie' || lowerKey === 'set-cookie') {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  setHooks?(hooks: any): void {
    // Delegate to real client if it supports hooks
    if (this.realHttpClient.setHooks) {
      this.realHttpClient.setHooks(hooks);
    }
  }
}

export function createRecordingHttpClient(
  realHttpClient: HttpLike,
  cassettesDir: string = './test/fixtures/cassettes'
): RecordingHttpClient {
  return new RecordingHttpClient(realHttpClient, cassettesDir);
}

/**
 * Test helper to set up recording/replay for a test
 */
export async function withCassette<T>(
  name: string,
  httpClient: RecordingHttpClient,
  testFn: () => Promise<T>
): Promise<T> {
  await httpClient.loadCassette(name);

  try {
    const result = await testFn();

    // Save cassette after successful test if recording
    if (process.env.RECORD === '1') {
      await httpClient.saveCassette();
    }

    return result;
  } catch (error) {
    // Save cassette even if test fails during recording
    if (process.env.RECORD === '1') {
      await httpClient.saveCassette();
    }
    throw error;
  }
}