import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '@/lib/utils/markdown';

describe('markdownToHtml', () => {
  it('renders headings and extracts TOC metadata', async () => {
    const result = await markdownToHtml('# Hello World\n\n## Section One\n\nBody text.');

    expect(result.html).toContain('<h1 id="hello-world">');
    expect(result.html).toContain('<h2 id="section-one">');
    expect(result.headings.length).toBeGreaterThanOrEqual(2);
    expect(result.headings[0]?.text).toBe('Hello World');
  });

  it('replaces non-http image sources with the local placeholder', async () => {
    const result = await markdownToHtml('![alt](/relative/image.png)');

    expect(result.html).toContain('src="/image-placeholder.png"');
  });
});
