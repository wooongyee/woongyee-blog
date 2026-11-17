/**
 * 목차(Table of Contents) 계층 구조 및 확장 상태 관리 순수 헬퍼
 */

import type { Heading } from '@/lib/notion/types';

export interface HeadingNode extends Heading {
  parentId: string | null;
  hasChildren: boolean;
}

export type ActiveHeadingSource = 'scroll' | 'manual';

export interface ClickTransitionResult {
  expandedIds: Set<string>;
  shouldScroll: boolean;
}

/**
 * 평탄화된 heading 목록으로부터 부모-자식 관계 및 자식 유무를 계산한다.
 * hasChildren은 다음 형제/상위 레벨(level <= current.level)을 만나면 즉시 탐색을 중단한다.
 */
export function buildHeadingNodes(headings: Heading[]): HeadingNode[] {
  const nodes: HeadingNode[] = [];

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    let parentId: string | null = null;

    for (let j = i - 1; j >= 0; j--) {
      const prev = headings[j];
      if (prev.level < current.level) {
        parentId = prev.id;
        break;
      }
    }

    let hasChildren = false;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= current.level) {
        break;
      }
      hasChildren = true;
      break;
    }

    nodes.push({
      ...current,
      parentId,
      hasChildren,
    });
  }

  return nodes;
}

/**
 * 특정 heading의 모든 조상 id 배열을 반환한다. (가까운 부모부터 루트 순)
 */
export function getAncestorIds(nodes: HeadingNode[], headingId: string): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ancestors: string[] = [];
  let current = nodeById.get(headingId);

  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = nodeById.get(current.parentId);
  }

  return ancestors;
}

/**
 * 현재 확장 상태(expandedIds)를 기준으로 화면에 표시할 heading 목록을 필터링한다.
 */
export function getVisibleHeadings(
  nodes: HeadingNode[],
  expandedIds: Set<string>,
): HeadingNode[] {
  return nodes.filter((node) => {
    if (!node.parentId) return true;
    const ancestors = getAncestorIds(nodes, node.id);
    return ancestors.every((ancestorId) => expandedIds.has(ancestorId));
  });
}

/**
 * 목차 항목 클릭 시 다음 확장 상태와 스크롤 이동 여부를 계산한다.
 * - 이미 열린 부모 항목: 축소만 수행하고 스크롤하지 않는다.
 * - 닫힌 부모 항목: 조상 및 본인을 확장하고 스크롤한다.
 * - 자식이 없는 항목: 확장 상태는 유지하고 스크롤한다.
 */
export function toggleExpandedOnClick(
  nodes: HeadingNode[],
  expandedIds: Set<string>,
  clickedId: string,
): ClickTransitionResult {
  const node = nodes.find((n) => n.id === clickedId);
  if (!node) {
    return { expandedIds, shouldScroll: false };
  }

  if (node.hasChildren) {
    const next = new Set(expandedIds);

    if (next.has(clickedId)) {
      next.delete(clickedId);
      return { expandedIds: next, shouldScroll: false };
    }

    for (const ancestorId of getAncestorIds(nodes, clickedId)) {
      next.add(ancestorId);
    }
    next.add(clickedId);
    return { expandedIds: next, shouldScroll: true };
  }

  return { expandedIds, shouldScroll: true };
}

/**
 * activeId 변경 시 발생 출처(scroll vs manual)에 따라 확장 상태를 동기화한다.
 * - scroll: 현재 활성 항목의 조상만 열어두고 나머지는 닫는다.
 * - manual: 클릭 직후 수동으로 연 확장 상태를 덮어쓰지 않고 유지한다.
 */
export function resolveExpandedOnActiveChange(
  nodes: HeadingNode[],
  currentExpandedIds: Set<string>,
  activeId: string,
  source: ActiveHeadingSource,
): Set<string> {
  if (!activeId || source === 'manual') {
    return currentExpandedIds;
  }

  return new Set(getAncestorIds(nodes, activeId));
}
