import { describe, it, expect, vi } from 'vitest';
import { nowMs, sleep } from '../../utils/time.js';

describe('Time utilities', () => {
  describe('nowMs', () => {
    it('should return current timestamp', () => {
      const before = Date.now();
      const now = nowMs();
      const after = Date.now();
      
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
      expect(typeof now).toBe('number');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = nowMs();
      await sleep(50);
      const end = nowMs();
      
      const elapsed = end - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some variance
      expect(elapsed).toBeLessThan(100); // But not too much
    });

    it('should resolve with void', async () => {
      const result = await sleep(1);
      expect(result).toBeUndefined();
    });

    it('should work with 0ms delay', async () => {
      const start = nowMs();
      await sleep(0);
      const end = nowMs();
      
      expect(end - start).toBeLessThan(50); // More generous threshold
    });
  });
});