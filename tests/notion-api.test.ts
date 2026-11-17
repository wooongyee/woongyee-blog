import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedPosts } from '@/lib/notion/api';
import { blogConfig } from '@/blog.config';
import type { PostMeta } from '@/lib/notion/types';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  retrieveDatabase: vi.fn(),
  upload: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(function () {
    return {
      dataSources: { query: mocks.query },
      databases: { retrieve: mocks.retrieveDatabase },
    };
  }),
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mocks.upload } },
}));

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

vi.mock('@/blog.config', async (importOriginal) => {
  const { blogConfig } = await importOriginal<typeof import('@/blog.config')>();
  return {
    blogConfig: {
      ...blogConfig,
      notion: { ...blogConfig.notion, apiKey: 'test-key', databaseId: 'database-id' },
    },
  };
});

function makePage(
  index: number,
  fields: Partial<Pick<PostMeta, 'tags' | 'category' | 'featured'>> = {}
) {
  return {
    object: 'page',
    id: `page-${index}`,
    cover: null,
    properties: {
      Title: { type: 'title', title: [{ plain_text: `Post ${index}` }] },
      Slug: { type: 'rich_text', rich_text: [{ plain_text: `post-${index}` }] },
      Status: { type: 'select', select: { name: 'Published' } },
      PublishDate: { type: 'date', date: { start: '2026-01-01' } },
      Tags: {
        type: 'multi_select',
        multi_select: (fields.tags ?? ['default']).map((name) => ({ name })),
      },
      Category: { type: 'select', select: { name: fields.category ?? 'Default' } },
      Featured: { type: 'checkbox', checkbox: fields.featured ?? false },
    },
  };
}

function makePages(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => makePage(start + index));
}

function response(results: unknown[], nextCursor: string | null = null) {
  return { results, has_more: nextCursor !== null, next_cursor: nextCursor };
}

beforeEach(() => {
  mocks.query.mockReset();
  mocks.retrieveDatabase.mockResolvedValue({ data_sources: [{ id: 'data-source-id', name: 'Blog' }] });
  mocks.upload.mockReset();
  mocks.fetch.mockReset().mockRejectedValue(new Error('Unexpected external request'));
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getPublishedPosts pagination', () => {
  it('returns all 201 posts in order across three pages', async () => {
    mocks.query
      .mockResolvedValueOnce(response(makePages(1, 100), 'cursor-2'))
      .mockResolvedValueOnce(response(makePages(101, 100), 'cursor-3'))
      .mockResolvedValueOnce(response(makePages(201, 1)));

    const posts = await getPublishedPosts();

    expect(posts.map((post) => post.id)).toEqual(
      Array.from({ length: 201 }, (_, index) => `page-${index + 1}`)
    );
    expect(mocks.query).toHaveBeenCalledTimes(3);
    for (const [index, cursor] of [undefined, 'cursor-2', 'cursor-3'].entries()) {
      expect(mocks.query).toHaveBeenNthCalledWith(index + 1, {
        data_source_id: 'data-source-id',
        filter: {
          property: blogConfig.notion.propertyMapping.status,
          select: { equals: blogConfig.notion.publishedStatus },
        },
        sorts: [{ property: blogConfig.notion.propertyMapping.publishDate, direction: 'descending' }],
        page_size: 100,
        start_cursor: cursor,
      });
    }
  });

  it.each([1, 5, 100])('stops after reaching a limit of %i', async (limit) => {
    mocks.query.mockResolvedValueOnce(response(makePages(1, limit), 'unused-cursor'));

    expect(await getPublishedPosts({ limit })).toHaveLength(limit);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ page_size: limit }));
  });

  it('caps requests at 100 and requests only the remaining limit on the next page', async () => {
    mocks.query
      .mockResolvedValueOnce(response(makePages(1, 100), 'cursor-2'))
      .mockResolvedValueOnce(response(makePages(101, 25), 'unused-cursor'));

    const posts = await getPublishedPosts({ limit: 125 });

    expect(posts).toHaveLength(125);
    expect(posts.at(-1)?.id).toBe('page-125');
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenNthCalledWith(1, expect.objectContaining({ page_size: 100 }));
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page_size: 25, start_cursor: 'cursor-2',
    }));
  });

  it('continues through short or empty pages while a next cursor exists', async () => {
    mocks.query
      .mockResolvedValueOnce(response(makePages(1, 2), 'cursor-2'))
      .mockResolvedValueOnce(response([], 'cursor-3'))
      .mockResolvedValueOnce(response(makePages(3, 3)));

    expect(await getPublishedPosts({ limit: 5 })).toHaveLength(5);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page_size: 3, start_cursor: 'cursor-2',
    }));
    expect(mocks.query).toHaveBeenNthCalledWith(3, expect.objectContaining({
      page_size: 3, start_cursor: 'cursor-3',
    }));
  });

  it('returns no posts without querying when the limit is zero', async () => {
    expect(await getPublishedPosts({ limit: 0 })).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns an empty list for an empty final page', async () => {
    mocks.query.mockResolvedValueOnce(response([]));

    expect(await getPublishedPosts()).toEqual([]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    { has_more: false, next_cursor: 'unused-cursor' },
    { has_more: true, next_cursor: null },
  ])('stops when pagination cannot continue: %j', async (pagination) => {
    mocks.query.mockResolvedValueOnce({ results: [makePage(1)], ...pagination });

    expect(await getPublishedPosts()).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('applies filters to later pages and excludes data source results', async () => {
    mocks.query
      .mockResolvedValueOnce(response(makePages(1, 100), 'cursor-2'))
      .mockResolvedValueOnce(response([
        { object: 'data_source', id: 'other-data-source' },
        makePage(101, { tags: ['target'], category: 'Target', featured: true }),
        makePage(102, { tags: ['target'], category: 'Target', featured: false }),
        makePage(103, { tags: ['target'], category: 'Other', featured: true }),
        makePage(104, { tags: ['other'], category: 'Target', featured: true }),
      ]));

    const posts = await getPublishedPosts({ tag: 'target', category: 'Target', featured: true });

    expect(posts.map((post) => post.id)).toEqual(['page-101']);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it('reports a later page failure instead of returning a truncated list', async () => {
    mocks.query
      .mockResolvedValueOnce(response(makePages(1, 100), 'cursor-2'))
      .mockRejectedValueOnce(new Error('Notion request failed'));

    await expect(getPublishedPosts()).rejects.toThrow('Failed to fetch published posts from Notion');
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
