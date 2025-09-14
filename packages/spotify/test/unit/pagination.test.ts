import { describe, it, expect } from 'vitest';
import {
  normalizePaginationParams,
  buildPaginationQuery,
  extractPaginationInfo,
  paginateAll,
  collectAllPages,
  createPage,
  validatePageOrder,
  sortItems,
  chunk,
  processBatches,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../src/pagination.js';
import type { Page, PageParams } from '../../src/types.js';

describe('pagination', () => {
  describe('normalizePaginationParams', () => {
    it('should use defaults when no params provided', () => {
      const result = normalizePaginationParams();
      expect(result).toEqual({ limit: DEFAULT_PAGE_LIMIT, offset: 0 });
    });

    it('should use provided params', () => {
      const result = normalizePaginationParams({ limit: 10, offset: 20 });
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it('should cap limit at maximum', () => {
      const result = normalizePaginationParams({ limit: 100 });
      expect(result.limit).toBe(MAX_PAGE_LIMIT);
    });

    it('should ensure offset is non-negative', () => {
      const result = normalizePaginationParams({ offset: -10 });
      expect(result.offset).toBe(0);
    });

    it('should handle undefined limit and offset separately', () => {
      const result1 = normalizePaginationParams({ limit: 15 });
      expect(result1).toEqual({ limit: 15, offset: 0 });

      const result2 = normalizePaginationParams({ offset: 30 });
      expect(result2).toEqual({ limit: DEFAULT_PAGE_LIMIT, offset: 30 });
    });
  });

  describe('buildPaginationQuery', () => {
    it('should build query with default params', () => {
      const query = buildPaginationQuery();
      expect(query.get('limit')).toBe(DEFAULT_PAGE_LIMIT.toString());
      expect(query.get('offset')).toBe('0');
    });

    it('should build query with custom params', () => {
      const query = buildPaginationQuery({ limit: 25, offset: 50 });
      expect(query.get('limit')).toBe('25');
      expect(query.get('offset')).toBe('50');
    });

    it('should normalize params before building query', () => {
      const query = buildPaginationQuery({ limit: 100, offset: -5 });
      expect(query.get('limit')).toBe(MAX_PAGE_LIMIT.toString());
      expect(query.get('offset')).toBe('0');
    });
  });

  describe('extractPaginationInfo', () => {
    it('should extract pagination info from response', () => {
      const response = {
        href: 'https://api.spotify.com/v1/test',
        limit: 20,
        next: 'https://api.spotify.com/v1/test?offset=20',
        offset: 0,
        previous: null,
        total: 100,
        items: ['item1', 'item2'],
      };

      const result = extractPaginationInfo(response);
      expect(result).toEqual({
        href: response.href,
        limit: response.limit,
        next: response.next,
        offset: response.offset,
        previous: response.previous,
        total: response.total,
        items: response.items,
      });
    });
  });

  describe('paginateAll', () => {
    it('should iterate through all pages', async () => {
      const pages = [
        { items: ['item1', 'item2'], next: 'page2', limit: 2, offset: 0, total: 5 },
        { items: ['item3', 'item4'], next: 'page3', limit: 2, offset: 2, total: 5 },
        { items: ['item5'], next: null, limit: 2, offset: 4, total: 5 },
      ];

      let pageIndex = 0;
      const fetchPage = async (params: PageParams): Promise<Page<string>> => {
        const page = pages[pageIndex++];
        return {
          ...page,
          href: 'test',
          previous: null,
        };
      };

      const items: string[] = [];
      for await (const item of paginateAll(fetchPage)) {
        items.push(item);
      }

      expect(items).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);
    });

    it('should stop when next is null', async () => {
      const fetchPage = async (): Promise<Page<string>> => ({
        href: 'test',
        limit: 10,
        next: null,
        offset: 0,
        previous: null,
        total: 2,
        items: ['item1', 'item2'],
      });

      const items: string[] = [];
      for await (const item of paginateAll(fetchPage)) {
        items.push(item);
      }

      expect(items).toEqual(['item1', 'item2']);
    });

    it('should stop when items length is less than limit', async () => {
      const fetchPage = async (): Promise<Page<string>> => ({
        href: 'test',
        limit: 10,
        next: 'nextPage',
        offset: 0,
        previous: null,
        total: 5,
        items: ['item1', 'item2'], // Less than limit
      });

      const items: string[] = [];
      for await (const item of paginateAll(fetchPage)) {
        items.push(item);
      }

      expect(items).toEqual(['item1', 'item2']);
    });
  });

  describe('collectAllPages', () => {
    it('should collect all items from all pages', async () => {
      const pages = [
        { items: ['item1', 'item2'], next: 'page2', limit: 2, offset: 0, total: 4 },
        { items: ['item3', 'item4'], next: null, limit: 2, offset: 2, total: 4 },
      ];

      let pageIndex = 0;
      const fetchPage = async (): Promise<Page<string>> => {
        const page = pages[pageIndex++];
        return {
          ...page,
          href: 'test',
          previous: null,
        };
      };

      const items = await collectAllPages(fetchPage);
      expect(items).toEqual(['item1', 'item2', 'item3', 'item4']);
    });

    it('should respect maxItems limit', async () => {
      const fetchPage = async (): Promise<Page<string>> => ({
        href: 'test',
        limit: 10,
        next: 'nextPage',
        offset: 0,
        previous: null,
        total: 100,
        items: Array.from({ length: 10 }, (_, i) => `item${i + 1}`),
      });

      const items = await collectAllPages(fetchPage, undefined, 5);
      expect(items).toHaveLength(5);
      expect(items).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);
    });
  });

  describe('createPage', () => {
    it('should create page with proper pagination links', () => {
      const items = ['item1', 'item2', 'item3'];
      const params = { limit: 2, offset: 0 };
      const total = 10;
      const baseUrl = 'https://api.spotify.com/v1/test';

      const page = createPage(items, params, total, baseUrl);

      expect(page.items).toEqual(items);
      expect(page.limit).toBe(2);
      expect(page.offset).toBe(0);
      expect(page.total).toBe(10);
      expect(page.next).toContain('offset=2');
      expect(page.previous).toBeNull();
    });

    it('should create page with previous link', () => {
      const items = ['item3', 'item4'];
      const params = { limit: 2, offset: 2 };
      const total = 10;
      const baseUrl = 'https://api.spotify.com/v1/test';

      const page = createPage(items, params, total, baseUrl);

      expect(page.next).toContain('offset=4');
      expect(page.previous).toContain('offset=0');
    });

    it('should not create next link when at end', () => {
      const items = ['item9', 'item10'];
      const params = { limit: 2, offset: 8 };
      const total = 10;
      const baseUrl = 'https://api.spotify.com/v1/test';

      const page = createPage(items, params, total, baseUrl);

      expect(page.next).toBeNull();
      expect(page.previous).toContain('offset=6');
    });
  });

  describe('validatePageOrder', () => {
    it('should return true for correctly ordered items', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const isValid = validatePageOrder(items, item => item.id, 'asc');
      expect(isValid).toBe(true);
    });

    it('should return true for correctly ordered items in descending order', () => {
      const items = [{ id: 3 }, { id: 2 }, { id: 1 }];
      const isValid = validatePageOrder(items, item => item.id, 'desc');
      expect(isValid).toBe(true);
    });

    it('should return false for incorrectly ordered items', () => {
      const items = [{ id: 1 }, { id: 3 }, { id: 2 }];
      const isValid = validatePageOrder(items, item => item.id, 'asc');
      expect(isValid).toBe(false);
    });

    it('should return true for single item', () => {
      const items = [{ id: 1 }];
      const isValid = validatePageOrder(items, item => item.id);
      expect(isValid).toBe(true);
    });

    it('should return true for empty array', () => {
      const items: { id: number }[] = [];
      const isValid = validatePageOrder(items, item => item.id);
      expect(isValid).toBe(true);
    });
  });

  describe('sortItems', () => {
    it('should sort items in ascending order', () => {
      const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];
      const sorted = sortItems(items, item => item.name, 'asc');
      expect(sorted.map(item => item.name)).toEqual(['a', 'b', 'c']);
    });

    it('should sort items in descending order', () => {
      const items = [{ name: 'a' }, { name: 'c' }, { name: 'b' }];
      const sorted = sortItems(items, item => item.name, 'desc');
      expect(sorted.map(item => item.name)).toEqual(['c', 'b', 'a']);
    });

    it('should not mutate original array', () => {
      const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];
      const original = [...items];
      sortItems(items, item => item.name);
      expect(items).toEqual(original);
    });

    it('should sort by numeric values', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const sorted = sortItems(items, item => item.value);
      expect(sorted.map(item => item.value)).toEqual([1, 2, 3]);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunk(array, 3);
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty array', () => {
      const chunks = chunk([], 3);
      expect(chunks).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      const chunks = chunk([1, 2], 5);
      expect(chunks).toEqual([[1, 2]]);
    });

    it('should handle chunk size of 1', () => {
      const chunks = chunk([1, 2, 3], 1);
      expect(chunks).toEqual([[1], [2], [3]]);
    });
  });

  describe('processBatches', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (batch: number[]): Promise<string[]> => {
        return batch.map(n => `processed-${n}`);
      };

      const results = await processBatches(items, 2, processor);
      expect(results).toEqual([
        'processed-1',
        'processed-2',
        'processed-3',
        'processed-4',
        'processed-5',
      ]);
    });

    it('should add delay between batches when specified', async () => {
      const items = [1, 2, 3, 4];
      const startTime = Date.now();
      const processor = async (batch: number[]): Promise<number[]> => batch;

      await processBatches(items, 2, processor, 100);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(100); // At least one delay between batches
    });

    it('should handle empty items array', async () => {
      const processor = async (batch: number[]): Promise<string[]> => [];
      const results = await processBatches([], 2, processor);
      expect(results).toEqual([]);
    });

    it('should handle single batch', async () => {
      const items = [1, 2];
      const processor = async (batch: number[]): Promise<string[]> => {
        return batch.map(n => `result-${n}`);
      };

      const results = await processBatches(items, 5, processor, 100);
      expect(results).toEqual(['result-1', 'result-2']);
    });
  });
});