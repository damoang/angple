import type { WikiPageSummary, WikiCategory, WikiTag, WikiSearchResult, PaginatedResult } from '$lib/server/wiki';
export type SpecialPageData =
    | { type: 'RecentChanges'; pages: WikiPageSummary[] }
    | { type: 'AllPages'; result: PaginatedResult<WikiPageSummary>; sort: string }
    | { type: 'Categories'; categories: WikiCategory[] }
    | {
          type: 'Category';
          category: WikiCategory | null;
          categoryId: number;
          result: PaginatedResult<WikiPageSummary>;
      }
    | { type: 'Tags'; tags: WikiTag[] }
    | { type: 'Tag'; tag: WikiTag | null; tagId: number; result: PaginatedResult<WikiPageSummary> }
    | { type: 'Search'; query: string; result: PaginatedResult<WikiSearchResult> }
    | { type: 'NewPage' }
    | { type: 'Unknown'; name: string };

