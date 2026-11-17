import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractAndUploadImages } from '@/lib/notion/images';

const mocks = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), fetch: vi.fn() }));

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(function () {
    return { blocks: { children: { list: mocks.list } } };
  }),
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mocks.upload } },
}));

vi.mock('@/blog.config', async (importOriginal) => {
  const { blogConfig } = await importOriginal<typeof import('@/blog.config')>();
  return { blogConfig: { ...blogConfig, notion: { ...blogConfig.notion, apiKey: 'test-key' } } };
});

function paragraphs(prefix: string, count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    object: 'block', id: `${prefix}-${index}`, type: 'paragraph', has_children: false,
  }));
}

function image(id: string, type: 'file' | 'external' = 'file') {
  return {
    object: 'block', id, type: 'image', has_children: false,
    image: { type, [type]: { url: `https://notion.example/${id}.png` } },
  };
}

function response(results: unknown[], nextCursor: string | null = null) {
  return { results, has_more: nextCursor !== null, next_cursor: nextCursor };
}

beforeEach(() => {
  mocks.list.mockReset();
  mocks.upload.mockReset().mockResolvedValue({ secure_url: 'https://cloudinary.example/image.png' });
  mocks.fetch.mockReset().mockRejectedValue(new Error('Unexpected external request'));
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(mocks.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('extractAndUploadImages block pagination', () => {
  it('uploads images after the first 100 blocks and follows multiple cursors', async () => {
    mocks.list
      .mockResolvedValueOnce(response(paragraphs('root'), 'cursor-2'))
      .mockResolvedValueOnce(response([image('image-101')], 'cursor-3'))
      .mockResolvedValueOnce(response([image('image-102', 'external')]));

    const images = await extractAndUploadImages('page-id');

    expect(images).toEqual(['image-101', 'image-102'].map((blockId) => ({
      blockId,
      notionUrl: `https://notion.example/${blockId}.png`,
      cloudinaryUrl: 'https://cloudinary.example/image.png',
    })));
    expect(mocks.list).toHaveBeenCalledTimes(3);
    for (const [index, cursor] of [undefined, 'cursor-2', 'cursor-3'].entries()) {
      expect(mocks.list).toHaveBeenNthCalledWith(index + 1, {
        block_id: 'page-id', page_size: 100, start_cursor: cursor,
      });
    }
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    for (const [index, blockId] of ['image-101', 'image-102'].entries()) {
      expect(mocks.upload).toHaveBeenNthCalledWith(index + 1,
        `https://notion.example/${blockId}.png`,
        expect.objectContaining({ public_id: expect.stringContaining(`page-id/${blockId}_`) })
      );
    }
  });

  it('keeps parent and child cursors separate when containers occur on later pages', async () => {
    mocks.list.mockImplementation(async ({ block_id, start_cursor }) => {
      if (block_id === 'page-id' && !start_cursor) {
        return response(paragraphs('root'), 'root-next');
      }
      if (block_id === 'page-id' && start_cursor === 'root-next') {
        return response([{
          object: 'block', id: 'toggle-id', type: 'toggle', has_children: true,
        }], 'root-last');
      }
      if (block_id === 'page-id' && start_cursor === 'root-last') {
        return response([image('root-image', 'external')]);
      }
      if (block_id === 'toggle-id' && !start_cursor) {
        return response(paragraphs('child'), 'child-next');
      }
      if (block_id === 'toggle-id' && start_cursor === 'child-next') {
        return response([image('nested-image')]);
      }
      throw new Error(`Unexpected block request: ${block_id}/${start_cursor}`);
    });

    const images = await extractAndUploadImages('page-id');

    expect(images.map((entry) => entry.blockId)).toEqual(['nested-image', 'root-image']);
    expect(mocks.list).toHaveBeenCalledTimes(5);
    expect(mocks.list).toHaveBeenCalledWith({
      block_id: 'toggle-id', page_size: 100, start_cursor: undefined,
    });
    expect(mocks.list).toHaveBeenCalledWith({
      block_id: 'toggle-id', page_size: 100, start_cursor: 'child-next',
    });
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });

  it('continues past an empty page with a next cursor', async () => {
    mocks.list
      .mockResolvedValueOnce(response([], 'cursor-2'))
      .mockResolvedValueOnce(response([image('later-image')]));

    expect(await extractAndUploadImages('page-id')).toHaveLength(1);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it.each([
    { has_more: false, next_cursor: null },
    { has_more: false, next_cursor: 'unused-cursor' },
    { has_more: true, next_cursor: null },
  ])('stops on a terminal response: %j', async (pagination) => {
    mocks.list.mockResolvedValueOnce({ results: [], ...pagination });

    expect(await extractAndUploadImages('page-id')).toEqual([]);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('skips Notion requests when Cloudinary is not configured', async () => {
    vi.stubEnv('CLOUDINARY_API_SECRET', '');

    expect(await extractAndUploadImages('page-id')).toEqual([]);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('keeps the existing empty-result fallback when a later block page fails', async () => {
    mocks.list
      .mockResolvedValueOnce(response([image('first-image')], 'cursor-2'))
      .mockRejectedValueOnce(new Error('Notion request failed'));

    expect(await extractAndUploadImages('page-id')).toEqual([]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
