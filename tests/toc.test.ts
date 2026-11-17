import { describe, expect, it } from 'vitest';
import type { Heading } from '@/lib/notion/types';
import {
  buildHeadingNodes,
  getAncestorIds,
  getVisibleHeadings,
  resolveExpandedOnActiveChange,
  toggleExpandedOnClick,
} from '@/lib/utils/toc';

const sampleHeadings: Heading[] = [
  { id: 'intro', level: 1, text: '소개' },
  { id: 'coroutine-context', level: 2, text: 'Coroutine Context' },
  { id: 'dispatcher', level: 2, text: 'Dispatcher' },
  { id: 'dispatcher-main', level: 3, text: 'Dispatchers.Main' },
  { id: 'dispatcher-io', level: 3, text: 'Dispatchers.IO' },
  { id: 'summary', level: 1, text: '정리' },
  { id: 'comments', level: 2, text: '댓글' },
];

describe('TOC hierarchy and hasChildren boundary logic', () => {
  it('stops hasChildren scan at sibling or higher-level headings', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // coroutine-context(h2) 뒤에 형제 dispatcher(h2)가 오므로 자식이 없어야 함
    // (뒤쪽 dispatcher-main(h3) 때문에 오탐되면 안 됨)
    expect(byId.get('coroutine-context')?.hasChildren).toBe(false);
    expect(byId.get('intro')?.hasChildren).toBe(true);
    expect(byId.get('dispatcher')?.hasChildren).toBe(true);
    expect(byId.get('dispatcher-main')?.hasChildren).toBe(false);
    expect(byId.get('dispatcher-io')?.hasChildren).toBe(false);
    expect(byId.get('summary')?.hasChildren).toBe(true);
    expect(byId.get('comments')?.hasChildren).toBe(false);
  });

  it('stops hasChildren scan when a higher-level heading follows immediately', () => {
    const headings: Heading[] = [
      { id: 'h2-empty', level: 2, text: 'Empty H2' },
      { id: 'h1-next', level: 1, text: 'Next H1' },
      { id: 'h3-nested', level: 3, text: 'Nested H3' },
    ];
    const nodes = buildHeadingNodes(headings);

    expect(nodes[0].hasChildren).toBe(false);
    expect(nodes[1].hasChildren).toBe(true);
    expect(nodes[2].hasChildren).toBe(false);
    expect(nodes[2].parentId).toBe('h1-next');
  });

  it('computes parentId and ancestor chains accurately across levels', () => {
    const nodes = buildHeadingNodes(sampleHeadings);

    expect(getAncestorIds(nodes, 'intro')).toEqual([]);
    expect(getAncestorIds(nodes, 'coroutine-context')).toEqual(['intro']);
    expect(getAncestorIds(nodes, 'dispatcher-main')).toEqual(['dispatcher', 'intro']);
    expect(getAncestorIds(nodes, 'comments')).toEqual(['summary']);
  });

  it('filters visible headings only when every ancestor is expanded', () => {
    const nodes = buildHeadingNodes(sampleHeadings);

    // 아무것도 확장되지 않으면 최상위(h1)만 표시
    expect(getVisibleHeadings(nodes, new Set()).map((n) => n.id)).toEqual([
      'intro',
      'summary',
    ]);

    // intro만 확장되면 h2가 표시되고 h3는 숨겨짐
    expect(getVisibleHeadings(nodes, new Set(['intro'])).map((n) => n.id)).toEqual([
      'intro',
      'coroutine-context',
      'dispatcher',
      'summary',
    ]);

    // dispatcher만 있고 intro가 없으면 h3도 숨겨짐
    expect(getVisibleHeadings(nodes, new Set(['dispatcher'])).map((n) => n.id)).toEqual([
      'intro',
      'summary',
    ]);

    // intro + dispatcher 모두 확장되면 h3까지 표시
    expect(
      getVisibleHeadings(nodes, new Set(['intro', 'dispatcher'])).map((n) => n.id),
    ).toEqual([
      'intro',
      'coroutine-context',
      'dispatcher',
      'dispatcher-main',
      'dispatcher-io',
      'summary',
    ]);
  });
});

describe('TOC parent click expand/collapse and scroll vs manual sync', () => {
  it('expands a collapsed parent on click and preserves it when activeSource is manual', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    let expanded = new Set<string>(['intro']);

    // 닫혀 있는 상위 항목(dispatcher) 클릭 -> 확장 + 스크롤 이동
    const clickResult = toggleExpandedOnClick(nodes, expanded, 'dispatcher');
    expect(clickResult.shouldScroll).toBe(true);
    expect(clickResult.expandedIds.has('dispatcher')).toBe(true);
    expect(clickResult.expandedIds.has('intro')).toBe(true);

    // 직후 activeId가 'dispatcher'로 변경되더라도 source가 'manual'이면 확장 상태를 덮어쓰지 않음
    expanded = resolveExpandedOnActiveChange(
      nodes,
      clickResult.expandedIds,
      'dispatcher',
      'manual',
    );
    expect(expanded.has('dispatcher')).toBe(true);
    expect(getVisibleHeadings(nodes, expanded).map((n) => n.id)).toContain('dispatcher-main');
    expect(getVisibleHeadings(nodes, expanded).map((n) => n.id)).toContain('dispatcher-io');
  });

  it('collapses an already expanded parent on click without scrolling', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const expanded = new Set<string>(['intro', 'dispatcher']);

    const clickResult = toggleExpandedOnClick(nodes, expanded, 'dispatcher');
    expect(clickResult.shouldScroll).toBe(false);
    expect(clickResult.expandedIds.has('dispatcher')).toBe(false);
    expect(clickResult.expandedIds.has('intro')).toBe(true);
    expect(getVisibleHeadings(nodes, clickResult.expandedIds).map((n) => n.id)).not.toContain(
      'dispatcher-main',
    );
  });

  it('re-expands a collapsed parent even if it is already activeId', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const initial = new Set<string>(['intro']);

    const open1 = toggleExpandedOnClick(nodes, initial, 'dispatcher');
    expect(open1.expandedIds.has('dispatcher')).toBe(true);

    const close = toggleExpandedOnClick(nodes, open1.expandedIds, 'dispatcher');
    expect(close.shouldScroll).toBe(false);
    expect(close.expandedIds.has('dispatcher')).toBe(false);

    const open2 = toggleExpandedOnClick(nodes, close.expandedIds, 'dispatcher');
    expect(open2.shouldScroll).toBe(true);
    expect(open2.expandedIds.has('dispatcher')).toBe(true);
    const afterManualSync = resolveExpandedOnActiveChange(
      nodes,
      open2.expandedIds,
      'dispatcher',
      'manual',
    );
    expect(afterManualSync.has('dispatcher')).toBe(true);
  });

  it('keeps expanded state unchanged and scrolls when clicking a leaf heading', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const expanded = new Set<string>(['intro', 'dispatcher']);

    const clickResult = toggleExpandedOnClick(nodes, expanded, 'dispatcher-main');
    expect(clickResult.shouldScroll).toBe(true);
    expect(Array.from(clickResult.expandedIds)).toEqual(['intro', 'dispatcher']);
  });

  it('returns unchanged state and shouldScroll=false for unknown heading id', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const expanded = new Set<string>(['intro']);

    const clickResult = toggleExpandedOnClick(nodes, expanded, 'non-existent');
    expect(clickResult.shouldScroll).toBe(false);
    expect(clickResult.expandedIds).toBe(expanded);
  });

  it('syncs expanded ancestors and closes unrelated sections when activeSource is scroll', () => {
    const nodes = buildHeadingNodes(sampleHeadings);
    const manuallyExpanded = new Set<string>(['intro', 'dispatcher']);

    // 스크롤로 다른 섹션(comments)으로 이동하면 해당 조상(summary)만 열리고 기존 섹션은 닫힘
    const afterScrollToComments = resolveExpandedOnActiveChange(
      nodes,
      manuallyExpanded,
      'comments',
      'scroll',
    );
    expect(Array.from(afterScrollToComments)).toEqual(['summary']);

    // 스크롤로 dispatcher-io에 진입하면 조상(dispatcher, intro)이 자동으로 열림
    const afterScrollToNested = resolveExpandedOnActiveChange(
      nodes,
      afterScrollToComments,
      'dispatcher-io',
      'scroll',
    );
    expect(afterScrollToNested.has('dispatcher')).toBe(true);
    expect(afterScrollToNested.has('intro')).toBe(true);
    expect(afterScrollToNested.has('summary')).toBe(false);
  });
});
