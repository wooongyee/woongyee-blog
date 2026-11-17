import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '@/lib/utils/markdown';

describe('rehypeExtractReferences via markdownToHtml', () => {
  describe('link-only Reference sections', () => {
    it('extracts links and removes the section when it contains only a link list', async () => {
      const markdown = [
        '# 본문 제목',
        '',
        '본문 내용입니다.',
        '',
        '## 참고 자료',
        '',
        '- [Next.js Docs](https://nextjs.org/docs)',
        '- [React Docs](https://react.dev)',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'Next.js Docs', url: 'https://nextjs.org/docs' },
        { title: 'React Docs', url: 'https://react.dev' },
      ]);
      expect(result.html).toContain('본문 내용입니다.');
      expect(result.html).not.toContain('참고 자료');
      expect(result.html).not.toContain('https://nextjs.org/docs');
      expect(result.headings.map((h) => h.text)).toEqual(['본문 제목']);
    });

    it('supports all reference heading variants and preserves following sections', async () => {
      const markdown = [
        '## References',
        '',
        '1. [TypeScript](https://www.typescriptlang.org)',
        '',
        '## 결론',
        '',
        '마무리 내용입니다.',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'TypeScript', url: 'https://www.typescriptlang.org' },
      ]);
      expect(result.html).not.toContain('References');
      expect(result.html).not.toContain('https://www.typescriptlang.org');
      expect(result.html).toContain('결론');
      expect(result.html).toContain('마무리 내용입니다.');
      expect(result.headings.map((h) => h.text)).toEqual(['결론']);
    });

    it('removes a reference section containing only standalone link paragraphs', async () => {
      const markdown = [
        '### 참고',
        '',
        '[Vitest](https://vitest.dev)',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'Vitest', url: 'https://vitest.dev' },
      ]);
      expect(result.html).not.toContain('참고');
      expect(result.html).not.toContain('https://vitest.dev');
    });
  });

  describe('mixed prose + link Reference sections', () => {
    it('preserves explanatory paragraph and section while still extracting references', async () => {
      const markdown = [
        '## 참고 자료',
        '',
        '이 글은 아래 공식 문서를 바탕으로 정리했습니다.',
        '',
        '- [Next.js Docs](https://nextjs.org/docs)',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'Next.js Docs', url: 'https://nextjs.org/docs' },
      ]);
      expect(result.html).toContain('참고 자료');
      expect(result.html).toContain('이 글은 아래 공식 문서를 바탕으로 정리했습니다.');
      expect(result.html).toContain('https://nextjs.org/docs');
      expect(result.headings.map((h) => h.text)).toContain('참고 자료');
    });

    it('preserves inline prose with embedded links', async () => {
      const markdown = [
        '## Reference',
        '',
        '자세한 내용은 [React Docs](https://react.dev)를 참고하세요.',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'React Docs', url: 'https://react.dev' },
      ]);
      expect(result.html).toContain('Reference');
      expect(result.html).toContain('자세한 내용은');
      expect(result.html).toContain('를 참고하세요.');
    });

    it('preserves list items that include descriptive text alongside links', async () => {
      const markdown = [
        '## 참고',
        '',
        '- [MDN Web Docs](https://developer.mozilla.org) - 웹 표준 레퍼런스',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
      ]);
      expect(result.html).toContain('참고');
      expect(result.html).toContain('웹 표준 레퍼런스');
    });

    it('evaluates multiple reference sections independently', async () => {
      const markdown = [
        '## 참고',
        '',
        '- [Link Only](https://example.com/only)',
        '',
        '## References',
        '',
        '추가 맥락 설명입니다.',
        '',
        '- [With Prose](https://example.com/prose)',
      ].join('\n');

      const result = await markdownToHtml(markdown);

      expect(result.references).toEqual([
        { title: 'Link Only', url: 'https://example.com/only' },
        { title: 'With Prose', url: 'https://example.com/prose' },
      ]);
      expect(result.html).not.toContain('https://example.com/only');
      expect(result.html).toContain('추가 맥락 설명입니다.');
      expect(result.html).toContain('https://example.com/prose');
      expect(result.headings.map((h) => h.text)).toEqual(['References']);
    });
  });
});
