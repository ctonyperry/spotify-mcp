/**
 * Types for parity testing
 */

export interface TestCase {
  name: string;
  description: string;
  newServerCall: {
    toolName: string;
    args: Record<string, unknown>;
  };
  legacyServerCall: {
    toolName: string;
    args: Record<string, unknown>;
  };
  normalizer: (output: any) => any;
}

export interface ParityResult {
  caseName: string;
  status: 'MATCH' | 'PARTIAL' | 'MISMATCH';
  newOutput: any;
  legacyOutput: any;
  normalizedNew: any;
  normalizedLegacy: any;
  diff?: string;
  error?: string;
}

export interface ParityReport {
  summary: {
    total: number;
    matches: number;
    partial: number;
    mismatches: number;
  };
  results: ParityResult[];
  timestamp: string;
}

export interface ServerInstance {
  callTool(toolName: string, args: Record<string, unknown>): Promise<any>;
  listTools(): Promise<any>;
  shutdown(): Promise<void>;
}