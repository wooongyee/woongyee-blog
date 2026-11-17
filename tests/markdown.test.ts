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

  it('preserves Notion toggle (<details>/<summary>) elements and inner markdown', async () => {
    const md = '<details><summary>더보기</summary>\n\n접힌 **본문** 내용\n\n</details>';
    const result = await markdownToHtml(md);

    expect(result.html).toContain('<details>');
    expect(result.html).toContain('<summary>더보기</summary>');
    expect(result.html).toContain('<p>접힌 <strong>본문</strong> 내용</p>');
    expect(result.html).toContain('</details>');
  });

  it('preserves open attribute on <details> and extracts headings/references alongside toggles', async () => {
    const md = [
      '# Top Heading',
      '',
      '<details open>',
      '<summary>토글 제목</summary>',
      '',
      '## Inside Toggle',
      '',
      '내용입니다.',
      '',
      '</details>',
      '',
      '## 참고',
      '',
      '- [Example](https://example.com)',
    ].join('\n');

    const result = await markdownToHtml(md);

    expect(result.html).toContain('<details open>');
    expect(result.html).toContain('<summary>토글 제목</summary>');
    expect(result.headings).toEqual([
      { id: 'top-heading', level: 1, text: 'Top Heading' },
      { id: 'inside-toggle', level: 2, text: 'Inside Toggle' },
    ]);
    expect(result.references).toEqual([
      { url: 'https://example.com', title: 'Example' },
    ]);
    expect(result.html).not.toContain('id="참고"');
  });

  it('sanitizes dangerous HTML tags, event handlers, and javascript: URIs', async () => {
    const md = [
      '<script>alert("xss")</script>',
      '<details ontoggle="alert(1)"><summary onclick="alert(2)">안전한 토글</summary>',
      '',
      '<p onmouseover="alert(3)">본문</p>',
      '<a href="javascript:alert(4)">악성 링크</a>',
      '',
      '</details>',
    ].join('\n');

    const result = await markdownToHtml(md);

    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('alert(');
    expect(result.html).not.toContain('ontoggle');
    expect(result.html).not.toContain('onclick');
    expect(result.html).not.toContain('onmouseover');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('<details>');
    expect(result.html).toContain('<summary>안전한 토글</summary>');
  });

  it('strips raw onerror on images while preserving rehypeImageErrorHandler and rehypeHighlight', async () => {
    const md = [
      '<img src="https://example.com/photo.png" onerror="alert(1)" alt="photo">',
      '',
      '<img src="javascript:alert(2)" alt="bad">',
      '',
      '```ts',
      'const greeting: string = "hello";',
      '```',
    ].join('\n');

    const result = await markdownToHtml(md);

    expect(result.html).not.toContain('alert(1)');
    expect(result.html).not.toContain('alert(2)');
    expect(result.html).toContain('src="https://example.com/photo.png"');
    expect(result.html).toContain('loading="lazy"');
    expect(result.html).toContain('this.src=&#x27;/image-placeholder.png&#x27;');
    expect(result.html).toContain('src="/image-placeholder.png"');
    expect(result.html).toContain('class="hljs language-ts"');
    expect(result.html).toContain('<span class="hljs-keyword">const</span>');
  });
});
