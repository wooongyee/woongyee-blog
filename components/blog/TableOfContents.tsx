/**
 * 목차 (Table of Contents) 컴포넌트
 * 포스트의 heading(h1-h3)을 표시하고 클릭 시 해당 섹션으로 스크롤
 * 3레이어 계층 구조: h1 > h2 > h3 유연하게 대응
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useActiveHeading } from '@/hooks/useActiveHeading';
import type { Heading } from '@/lib/notion/types';
import {
  buildHeadingNodes,
  getVisibleHeadings,
  resolveExpandedOnActiveChange,
  toggleExpandedOnClick,
} from '@/lib/utils/toc';

interface TableOfContentsProps {
  headings: Heading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  // 댓글 항목 추가
  const allHeadings: Heading[] = useMemo(() => [
    ...headings,
    { id: 'comments', level: 2, text: '댓글' }
  ], [headings]);

  const headingIds = useMemo(() => allHeadings.map((h) => h.id), [allHeadings]);
  const { activeId, activeSource, setActiveId } = useActiveHeading(headingIds);

  // 확장된 heading id 목록 관리
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 계층 구조 파악: 각 heading의 부모 및 자식 유무 계산
  const headingNodes = useMemo(
    () => buildHeadingNodes(allHeadings),
    [allHeadings],
  );

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();

    const { shouldScroll } = toggleExpandedOnClick(headingNodes, expandedIds, id);
    setExpandedIds((prev) => toggleExpandedOnClick(headingNodes, prev, id).expandedIds);

    if (!shouldScroll) {
      return;
    }

    // 스크롤 이동 (자식이 없거나, 닫혀있던 헤더를 연 경우만 실행)
    setActiveId(id);

    const element = document.getElementById(id);
    if (element) {
      // Header 높이 동적 계산
      const header = document.querySelector('header[class*="sticky"], header[class*="fixed"], nav[class*="sticky"], nav[class*="fixed"]');
      const headerHeight = header?.getBoundingClientRect().height || 64;
      const yOffset = -(headerHeight + 20); // 20px 여유
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'instant' });
      // URL 업데이트
      window.history.pushState(null, '', `#${id}`);
    }
  };

  // 스크롤로 activeId 변경 시 해당 heading의 조상만 열고 나머지는 닫기
  useEffect(() => {
    if (activeId) {
      setExpandedIds((prev) =>
        resolveExpandedOnActiveChange(headingNodes, prev, activeId, activeSource),
      );
    }
  }, [activeId, activeSource, headingNodes]);

  // 표시할 heading 필터링: 부모가 없거나 모든 조상이 확장되어 있으면 표시
  const visibleHeadings = useMemo(
    () => getVisibleHeadings(headingNodes, expandedIds),
    [headingNodes, expandedIds],
  );

  // Early return: headings가 없으면 렌더링하지 않음
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="space-y-1">
      <ul className="space-y-1 text-sm">
        {visibleHeadings.map((node) => {
          const isActive = activeId === node.id;
          const indent = (node.level - 1) * 12;

          return (
            <li key={node.id} style={{ paddingLeft: `${indent}px` }}>
              <a
                href={`#${node.id}`}
                onClick={(e) => handleClick(e, node.id)}
                className={`
                  block py-1.5 px-2 rounded transition-all duration-200
                  hover:text-primary hover:bg-secondary/50
                  ${
                    isActive
                      ? 'text-primary font-medium bg-secondary'
                      : 'text-muted-foreground'
                  }
                `}
              >
                {node.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
