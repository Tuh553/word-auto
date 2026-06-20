import { useEffect, useRef, useState, type MouseEvent, type UIEvent } from "react";
import { renderAsync } from "docx-preview";
import type { PreviewIssueTarget } from "../lib/reportGroups.js";
import {
  findBestFragmentMatch,
  findNormalizedTextRange,
  findPreviewParagraphIssueKeysFromNode,
  findPreviewBlockTextIndex,
  findPreviewIssueKeyFromNode,
  pickParagraphIssueKey,
  pickPreviewIssueInViewport,
  type PreviewHighlightTarget,
} from "../lib/previewHighlight.js";

interface Props {
  buffer: ArrayBuffer;
  /** 要定位高亮的段落与可选片段（文档级问题为 null，不定位） */
  shouldScrollToTarget: boolean;
  target: PreviewHighlightTarget | null;
  targets: PreviewIssueTarget[];
  suppressScrollSelectionUntil: number;
  onSelectTarget: (issueKey: string, source: "preview-click" | "preview-scroll") => void;
}

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, td, li";
const FRAGMENT_CLASS = "wa-fragment-hl";

interface TextPosition {
  node: Text;
  offset: number;
}

const collectPreviewIssueCandidates = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>(".wa-preview-hit")).flatMap((block) => {
    const issueKey = block.dataset.issueKey;
    if (!issueKey) return [];
    return [{
      bottom: block.offsetTop + block.offsetHeight,
      issueKey,
      top: block.offsetTop,
    }];
  });

const resetPreviewTargets = (host: HTMLElement) => {
  host.querySelectorAll<HTMLElement>(".wa-preview-hit").forEach((block) => {
    block.classList.remove("wa-preview-hit");
    delete block.dataset.issueKey;
    delete block.dataset.paragraphIssueKeys;
  });
};

const unwrapPreviewFragments = (host: HTMLElement) => {
  host.querySelectorAll<HTMLElement>(`.${FRAGMENT_CLASS}`).forEach((marker) => {
    const parent = marker.parentNode;
    if (!parent) return;
    while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
    marker.remove();
    parent.normalize();
  });
};

const resetActiveHighlight = (host: HTMLElement) => {
  unwrapPreviewFragments(host);
  host.querySelectorAll(".wa-hl").forEach((node) => {
    node.classList.remove("wa-hl");
  });
};

const findBlockByText = (
  blocks: HTMLElement[],
  text: string,
): HTMLElement | undefined => {
  const index = findPreviewBlockTextIndex(
    blocks.map((block) => block.textContent ?? ""),
    text,
  );
  return index < 0 ? undefined : blocks[index];
};

const findTextPosition = (
  block: HTMLElement,
  absoluteOffset: number,
): TextPosition | null => {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const nextSeen = seen + node.data.length;
    if (absoluteOffset >= seen && absoluteOffset <= nextSeen) {
      return { node, offset: absoluteOffset - seen };
    }
    seen = nextSeen;
    current = walker.nextNode();
  }
  return null;
};

const highlightTextFragment = (
  block: HTMLElement,
  range: { start: number; end: number } | null,
): HTMLElement | null => {
  if (!range) return null;
  const start = findTextPosition(block, range.start);
  const end = findTextPosition(block, range.end);
  if (!start || !end) return null;

  const domRange = document.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);
  const marker = document.createElement("span");
  marker.className = FRAGMENT_CLASS;
  marker.append(domRange.extractContents());
  domRange.insertNode(marker);
  return marker;
};

const highlightPreviewTarget = (
  host: HTMLElement,
  target: PreviewHighlightTarget | null,
  shouldScrollToTarget: boolean,
): string | null => {
  resetActiveHighlight(host);
  if (!target) return null;
  const blocks = Array.from(host.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
  const block = findBlockByText(blocks, target.text);
  if (!block) return target.issueKey ?? null;
  const fragment = highlightTextFragment(
    block,
    findBestFragmentMatch(block.textContent ?? "", target)?.range ??
      findNormalizedTextRange(block.textContent ?? "", target.affectedText),
  );
  if (fragment) {
    if (target.issueKey) fragment.dataset.issueKey = target.issueKey;
    if (shouldScrollToTarget) {
      fragment.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return target.issueKey ?? null;
  }
  block.classList.add("wa-hl");
  if (shouldScrollToTarget) {
    block.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return target.issueKey ?? null;
};

const markPreviewIssueTargets = (
  host: HTMLElement,
  targets: PreviewIssueTarget[],
): void => {
  resetPreviewTargets(host);
  const blocks = Array.from(host.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
  for (const target of targets) {
    const block = findBlockByText(blocks, target.text);
    if (!block || block.dataset.issueKey) continue;
    block.classList.add("wa-preview-hit");
    block.dataset.issueKey = target.issueKey;
    block.dataset.paragraphIssueKeys = target.issues.map((issue) => issue.issueKey).join("|");
  }
};

const pickIssueKeyFromPreviewScroll = (
  host: HTMLDivElement,
  suppressScrollSelectionUntil: number,
): string | null => {
  if (Date.now() < suppressScrollSelectionUntil) return null;
  return pickPreviewIssueInViewport(collectPreviewIssueCandidates(host), {
    clientHeight: host.clientHeight,
    scrollTop: host.scrollTop,
  });
};

const pickIssueKeyFromPreviewClick = (event: MouseEvent<HTMLDivElement>) =>
  event.target instanceof Element
    ? findPreviewIssueKeyFromNode(
      event.target as Element & { dataset?: { issueKey?: string; paragraphIssueKeys?: string } },
    )
    : null;

const getParagraphIssueKeyFromPreviewClick = (
  event: MouseEvent<HTMLDivElement>,
  target: PreviewHighlightTarget | null,
) => {
  const paragraphIssueKeys =
    event.target instanceof Element
      ? findPreviewParagraphIssueKeysFromNode(
        event.target as Element & {
          dataset?: { issueKey?: string; paragraphIssueKeys?: string };
        },
      )
      : [];
  return pickParagraphIssueKey(paragraphIssueKeys, target);
};

const fixCollapsedLineHeights = (host: HTMLElement) => {
  host.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize);
    if (lh && fs && lh < fs) el.style.lineHeight = "normal";
  });
};

export function PreviewPanel({
  buffer,
  shouldScrollToTarget,
  target,
  targets,
  suppressScrollSelectionUntil,
  onSelectTarget,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const lastScrollIssueKeyRef = useRef<string | null>(null);

  // 用 docx-preview 默认配置（默认即分页渲染、保留页高），不再自行覆盖
  // ignoreHeight/breakPages/experimental 等——那些覆盖反而破坏分页布局。
  // 渲染到游离节点完成后整体挂载，stale 标志丢弃过期渲染，杜绝并发重影。
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let stale = false;
    const mount = document.createElement("div");
    renderAsync(buffer.slice(0), mount, undefined, {
      className: "docx",
      inWrapper: true,
    })
      .then(() => {
        if (stale) return;
        host.replaceChildren(mount);
        // 修补：docx-preview 对部分固定行距文档会算出极小行高(如 1pt)，导致文字行重叠。
        // 凡行高 < 字高(必然重叠)的元素，行高重置为 normal；正常行距(≥字高)不动。
        fixCollapsedLineHeights(host);
        setRenderVersion((version) => version + 1);
      })
      .catch((e: unknown) => {
        if (!stale) host.textContent = "预览渲染失败：" + (e as Error).message;
      });
    return () => {
      stale = true;
    };
  }, [buffer]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    lastScrollIssueKeyRef.current = null;
    markPreviewIssueTargets(el, targets);
  }, [renderVersion, targets]);

  // 按段落原文匹配定位（不依赖序号，避免与渲染 DOM 错位）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    lastScrollIssueKeyRef.current = highlightPreviewTarget(
      el,
      target,
      shouldScrollToTarget,
    );
  }, [renderVersion, shouldScrollToTarget, target]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const issueKey = pickIssueKeyFromPreviewScroll(
      event.currentTarget,
      suppressScrollSelectionUntil,
    );
    if (!issueKey || issueKey === lastScrollIssueKeyRef.current) return;
    lastScrollIssueKeyRef.current = issueKey;
    onSelectTarget(issueKey, "preview-scroll");
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const issueKey = pickIssueKeyFromPreviewClick(event);
    if (issueKey) {
      onSelectTarget(issueKey, "preview-click");
      return;
    }
    const paragraphIssueKey = getParagraphIssueKeyFromPreviewClick(event, target);
    if (paragraphIssueKey) onSelectTarget(paragraphIssueKey, "preview-click");
  };

  return (
    <div
      className="preview"
      ref={ref}
      onClick={handleClick}
      onScroll={handleScroll}
    />
  );
}
