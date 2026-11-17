import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/webhook/notion/route';

const mocks = vi.hoisted(() => ({
  retrievePage: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  extractAndUploadImages: vi.fn(),
  upload: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(function () {
    return {
      pages: { retrieve: mocks.retrievePage },
    };
  }),
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mocks.upload } },
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock('@/lib/notion/images', () => ({
  extractAndUploadImages: mocks.extractAndUploadImages,
}));

vi.mock('@/blog.config', async (importOriginal) => {
  const { blogConfig } = await importOriginal<typeof import('@/blog.config')>();
  return {
    blogConfig: {
      ...blogConfig,
      notion: { ...blogConfig.notion, apiKey: 'test-key', databaseId: 'database-id' },
    },
  };
});

function makeNotionPage(slug: string, status: string) {
  return {
    object: 'page',
    id: 'page-1',
    properties: {
      Status: { type: 'select', select: { name: status } },
      Slug: { type: 'rich_text', rich_text: [{ plain_text: slug }] },
    },
  };
}

function makeWebhookRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhook/notion', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.NOTION_WEBHOOK_SECRET;

  mocks.retrievePage.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.revalidateTag.mockReset();
  mocks.extractAndUploadImages.mockReset().mockResolvedValue([]);
  mocks.upload.mockReset();
  mocks.fetch.mockReset().mockRejectedValue(new Error('Unexpected external request'));
  vi.stubGlobal('fetch', mocks.fetch);

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = originalEnv;
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/webhook/notion', () => {
  it('returns health check status and env configuration flags', async () => {
    process.env.NOTION_API_KEY = 'secret-notion-key';
    process.env.NOTION_DATABASE_ID = 'db-123';
    process.env.NOTION_WEBHOOK_SECRET = 'webhook-secret';

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'ok',
      configured: true,
      message: 'Notion webhook endpoint is ready.',
      requiredEnvVars: {
        NOTION_API_KEY: true,
        NOTION_DATABASE_ID: true,
        NOTION_WEBHOOK_SECRET: true,
      },
    });
  });

  it('reports unconfigured when NOTION_API_KEY is missing', async () => {
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_DATABASE_ID;
    delete process.env.NOTION_WEBHOOK_SECRET;

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.configured).toBe(false);
    expect(data.requiredEnvVars).toEqual({
      NOTION_API_KEY: false,
      NOTION_DATABASE_ID: false,
      NOTION_WEBHOOK_SECRET: false,
    });
  });
});

describe('POST /api/webhook/notion', () => {
  it('returns challenge for url_verification requests', async () => {
    const request = makeWebhookRequest({
      type: 'url_verification',
      challenge: 'challenge-token-123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ challenge: 'challenge-token-123' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it('invalidates post, posts tag, and sitemap caches when a page transitions to Draft (!isPublished)', async () => {
    mocks.retrievePage.mockResolvedValueOnce(makeNotionPage('my-post', 'Draft'));

    const request = makeWebhookRequest({
      type: 'page.properties_updated',
      entity: { id: 'page-1', type: 'page' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toEqual({
      successful: 1,
      skipped: 0,
      failed: 0,
    });
    expect(data.details[0]).toMatchObject({
      success: true,
      type: 'page.properties_updated',
      pageId: 'page-1',
      slug: 'my-post',
      unpublished: true,
      revalidated: ['/blog/my-post', 'tag:posts', '/sitemap.xml'],
    });

    expect(mocks.extractAndUploadImages).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/my-post');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('posts');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('extracts images and invalidates caches when a page is Published', async () => {
    mocks.retrievePage.mockResolvedValueOnce(makeNotionPage('published-post', 'Published'));

    const request = makeWebhookRequest({
      type: 'page.created',
      entity: { id: 'page-2', type: 'page' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toEqual({
      successful: 1,
      skipped: 0,
      failed: 0,
    });
    expect(mocks.extractAndUploadImages).toHaveBeenCalledWith('page-2');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/published-post');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('posts');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('invalidates posts tag and sitemap on page.deleted', async () => {
    const request = makeWebhookRequest({
      type: 'page.deleted',
      entity: { id: 'page-deleted', type: 'page' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toEqual({
      successful: 1,
      skipped: 0,
      failed: 0,
    });
    expect(data.details[0]).toMatchObject({
      success: true,
      type: 'deleted',
      pageId: 'page-deleted',
      revalidated: ['tag:posts', '/sitemap.xml'],
    });
    expect(mocks.retrievePage).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).toHaveBeenCalledWith('posts');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('returns HTTP 500 and success: false when getPostSlugByPageId returns null', async () => {
    mocks.retrievePage.mockRejectedValueOnce(new Error('Notion API error'));

    const request = makeWebhookRequest({
      type: 'page.properties_updated',
      entity: { id: 'missing-page', type: 'page' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.results).toEqual({
      successful: 0,
      skipped: 0,
      failed: 1,
    });
    expect(data.details[0]).toEqual({
      error: 'Failed to fetch page info',
      pageId: 'missing-page',
    });
  });

  it('returns HTTP 500 and success: false on partial failure when revalidateTag throws', async () => {
    mocks.retrievePage
      .mockResolvedValueOnce(makeNotionPage('ok-post', 'Draft'))
      .mockResolvedValueOnce(makeNotionPage('broken-post', 'Draft'));
    mocks.revalidateTag
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('Cache invalidation failed');
      });

    const request = makeWebhookRequest({
      events: [
        { type: 'page.properties_updated', entity: { id: 'page-ok', type: 'page' } },
        { type: 'page.properties_updated', entity: { id: 'page-fail', type: 'page' } },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.processed).toBe(2);
    expect(data.results).toEqual({
      successful: 1,
      skipped: 0,
      failed: 1,
    });
  });

  it('verifies HMAC signature when NOTION_WEBHOOK_SECRET is configured', async () => {
    process.env.NOTION_WEBHOOK_SECRET = 'top-secret';
    const payload = {
      type: 'page.deleted',
      entity: { id: 'page-signed', type: 'page' },
    };
    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${crypto
      .createHmac('sha256', 'top-secret')
      .update(rawBody)
      .digest('hex')}`;

    const invalidResponse = await POST(
      makeWebhookRequest(payload, { 'x-notion-signature': 'sha256=invalid' })
    );
    expect(invalidResponse.status).toBe(401);

    const validResponse = await POST(
      makeWebhookRequest(payload, { 'x-notion-signature': signature })
    );
    expect(validResponse.status).toBe(200);
  });
});
