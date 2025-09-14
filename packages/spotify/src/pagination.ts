import type { Page, PageParams } from './types.js';

/**
 * Default pagination parameters
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

/**
 * Validates and normalizes pagination parameters
 */
export function normalizePaginationParams(params?: PageParams): Required<PageParams> {
  const limit = Math.min(params?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const offset = Math.max(params?.offset ?? 0, 0);

  return { limit, offset };
}

/**
 * Builds query string parameters for pagination
 */
export function buildPaginationQuery(params?: PageParams): URLSearchParams {
  const normalized = normalizePaginationParams(params);
  const query = new URLSearchParams();

  query.set('limit', normalized.limit.toString());
  query.set('offset', normalized.offset.toString());

  return query;
}

/**
 * Extracts pagination info from Spotify API response
 */
export function extractPaginationInfo<T>(response: any): Page<T> {
  return {
    href: response.href,
    limit: response.limit,
    next: response.next,
    offset: response.offset,
    previous: response.previous,
    total: response.total,
    items: response.items,
  };
}

/**
 * Helper for iterating through all pages of a paginated endpoint
 */
export async function* paginateAll<T>(
  fetchPage: (params: PageParams) => Promise<Page<T>>,
  initialParams?: PageParams
): AsyncGenerator<T, void, unknown> {
  let currentParams = normalizePaginationParams(initialParams);
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage(currentParams);

    // Yield all items from current page
    for (const item of page.items) {
      yield item;
    }

    // Check if there are more pages
    hasMore = page.next !== null && page.items.length === page.limit;

    if (hasMore) {
      currentParams = {
        limit: page.limit,
        offset: page.offset + page.limit,
      };
    }
  }
}

/**
 * Collects all items from a paginated endpoint into an array
 */
export async function collectAllPages<T>(
  fetchPage: (params: PageParams) => Promise<Page<T>>,
  initialParams?: PageParams,
  maxItems?: number
): Promise<T[]> {
  const items: T[] = [];
  let collected = 0;

  for await (const item of paginateAll(fetchPage, initialParams)) {
    items.push(item);
    collected++;

    if (maxItems && collected >= maxItems) {
      break;
    }
  }

  return items;
}

/**
 * Creates a paginated response with consistent item ordering
 */
export function createPage<T>(
  items: T[],
  params: PageParams,
  total: number,
  baseUrl: string
): Page<T> {
  const { limit, offset } = normalizePaginationParams(params);

  // Build URLs for pagination links
  const buildUrl = (newOffset: number) => {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', newOffset.toString());
    return url.toString();
  };

  const href = buildUrl(offset);
  const next = offset + limit < total ? buildUrl(offset + limit) : null;
  const previous = offset > 0 ? buildUrl(Math.max(0, offset - limit)) : null;

  return {
    href,
    limit,
    next,
    offset,
    previous,
    total,
    items,
  };
}

/**
 * Validates that items in a page are properly ordered
 */
export function validatePageOrder<T>(
  items: T[],
  keyExtractor: (item: T) => string | number,
  expectedOrder: 'asc' | 'desc' = 'asc'
): boolean {
  if (items.length <= 1) return true;

  for (let i = 1; i < items.length; i++) {
    const prev = keyExtractor(items[i - 1]);
    const curr = keyExtractor(items[i]);

    if (expectedOrder === 'asc' && prev > curr) {
      return false;
    }
    if (expectedOrder === 'desc' && prev < curr) {
      return false;
    }
  }

  return true;
}

/**
 * Sorts items for deterministic ordering
 */
export function sortItems<T>(
  items: T[],
  keyExtractor: (item: T) => string | number,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aKey = keyExtractor(a);
    const bKey = keyExtractor(b);

    if (aKey < bKey) return order === 'asc' ? -1 : 1;
    if (aKey > bKey) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Processes items in batches with rate limiting consideration
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  delayMs: number = 0
): Promise<R[]> {
  const batches = chunk(items, batchSize);
  const results: R[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResults = await processor(batch);
    results.push(...batchResults);

    // Add delay between batches if specified
    if (delayMs > 0 && i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}