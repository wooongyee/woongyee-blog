/**
 * HTML에서 참고 자료 추출 및 제거 (rehype plugin)
 */

import type { Element, Root, Text, Parent } from 'hast';
import type { Plugin } from 'unified';
import type { Reference } from '@/lib/notion/types';

/**
 * Element 노드에서 텍스트 추출 (재귀적, 깊이 제한)
 */
function extractText(node: Element, depth = 0, maxDepth = 500): string {
  if (depth > maxDepth) return '';

  let text = '';

  for (const child of node.children) {
    if (child.type === 'text') {
      text += (child as Text).value;
    } else if (child.type === 'element') {
      text += extractText(child as Element, depth + 1, maxDepth);
    }
  }

  return text;
}

/**
 * "참고" 섹션인지 확인
 */
function isReferenceHeading(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === '참고' ||
    normalized === '참고 자료' ||
    normalized === 'references' ||
    normalized === 'reference'
  );
}

/**
 * Element에서 링크 추출 (재귀적, 깊이 제한)
 */
function extractLinks(node: Element, references: Reference[], depth = 0, maxDepth = 500): void {
  if (depth > maxDepth) return;

  if (node.tagName === 'a' && node.properties?.href) {
    const href = node.properties.href as string;
    const text = extractText(node);

    if (href && text) {
      references.push({
        url: href,
        title: text.trim(),
      });
    }
  }

  // 자식 노드 탐색
  for (const child of node.children) {
    if (child.type === 'element') {
      extractLinks(child as Element, references, depth + 1, maxDepth);
    }
  }
}

const LINK_CONTAINER_TAGS = new Set([
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'del',
  's',
  'span',
  'div',
]);

/**
 * Element가 링크 외의 비-링크 콘텐츠(설명 문단, 비-링크 요소 등)를 포함하는지 확인
 */
function hasNonLinkContent(node: Element, depth = 0, maxDepth = 500): boolean {
  if (depth > maxDepth) return false;

  // href가 있는 <a> 태그 내부는 순수 링크 콘텐츠로 간주
  if (node.tagName === 'a' && node.properties?.href) {
    return false;
  }

  if (node.tagName === 'br') {
    return false;
  }

  // 링크를 감싸는 컨테이너 태그 외의 요소(코드 블록, 이미지, 인용구 등)는 비-링크 콘텐츠
  if (!LINK_CONTAINER_TAGS.has(node.tagName)) {
    return true;
  }

  for (const child of node.children) {
    if (child.type === 'text') {
      if ((child as Text).value.trim().length > 0) {
        return true;
      }
    } else if (child.type === 'element') {
      if (hasNonLinkContent(child as Element, depth + 1, maxDepth)) {
        return true;
      }
    }
  }

  return false;
}

interface ReferenceSection {
  nodeIndices: number[];
  hasNonLinkContent: boolean;
}

/**
 * HTML에서 "참고" 섹션 추출하고 순수 링크 섹션만 제거하는 rehype plugin
 *
 * 1. h1/h2/h3 중 "참고" 텍스트를 가진 heading 찾기
 * 2. 해당 heading부터 다음 heading 전까지의 모든 링크 수집
 * 3. 비-링크 설명 문단/요소가 없는 순수 링크 섹션만 DOM에서 제거
 */
export function rehypeExtractReferences(references: Reference[]): Plugin<[], Root> {
  return () => {
    return (tree: Root) => {
      if (!tree || !tree.children) return;

      const parent = tree as Parent;
      const sections: ReferenceSection[] = [];
      let currentSection: ReferenceSection | null = null;

      // 1단계: "참고" 섹션 찾기, 링크 수집 및 비-링크 콘텐츠 여부 판별
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];

        if (node.type !== 'element') continue;

        const element = node as Element;

        // heading 발견
        if (['h1', 'h2', 'h3'].includes(element.tagName)) {
          const text = extractText(element);

          // 이전 참고 섹션 종료
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }

          // 새로운 참고 섹션 시작
          if (isReferenceHeading(text)) {
            currentSection = {
              nodeIndices: [i],
              hasNonLinkContent: false,
            };
            continue;
          }
        }

        // 참고 섹션 내부의 노드 처리
        if (currentSection) {
          extractLinks(element, references);
          if (hasNonLinkContent(element)) {
            currentSection.hasNonLinkContent = true;
          }
          currentSection.nodeIndices.push(i);
        }
      }

      if (currentSection) {
        sections.push(currentSection);
      }

      // 2단계: 순수 링크만 있는 섹션만 DOM에서 제거 (뒤에서부터 제거해야 인덱스 안 꼬임)
      const nodesToRemove = sections
        .filter((section) => !section.hasNonLinkContent)
        .flatMap((section) => section.nodeIndices);

      for (let i = nodesToRemove.length - 1; i >= 0; i--) {
        parent.children.splice(nodesToRemove[i], 1);
      }
    };
  };
}
