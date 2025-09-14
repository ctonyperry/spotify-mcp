import { describe, it, expect } from 'vitest';
import { requestId } from '../../utils/ids.js';

describe('Request ID generation', () => {
  it('should generate UUID v4 format', () => {
    const id = requestId();
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    
    for (let i = 0; i < 1000; i++) {
      const id = requestId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it('should have correct length and format', () => {
    const id = requestId();
    
    expect(id).toHaveLength(36); // 32 hex chars + 4 hyphens
    expect(id.split('-')).toHaveLength(5);
    expect(id.charAt(14)).toBe('4'); // Version 4
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19)); // Variant bits
  });
});