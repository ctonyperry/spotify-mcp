import { describe, it, expect } from 'vitest';
import { normalizeString, normalizeArtistName } from '../../src/util/normalize.js';

describe('Core Utilities', () => {
  it('should normalize strings', () => {
    expect(normalizeString('Hello World')).toBe('hello world');
    expect(normalizeString('  TEST  ')).toBe('test');
  });

  it('should normalize artist names', () => {
    expect(normalizeArtistName('The Beatles')).toBe('beatles');
    expect(normalizeArtistName('Artist Jr')).toBe('artist');
  });
});