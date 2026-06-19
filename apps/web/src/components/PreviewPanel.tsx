import { useEffect, useRef, useState, type MouseEvent } from "react";
import { renderAsync } from "docx-preview";
import type { PreviewIssueTarget } from "../lib/reportGroups.js";

interface Props {
  buffer: ArrayBuffer;
  /** 要定位高亮的段落原文（文档级问题为 null，不定位） */
  targetText: string | null;
  targets: PreviewIssueTarget[];
  onSelectTarget: (issueKey: string) => void;
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, "");

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, td, li";

const getTextKey = (text: string): string => norm(text).slice(0, 18);

const resetPreviewTargets = (host: HTMLElement) => {
  host.querySelectorAll<HTMLElement>(".wa-preview-hit").forEach((block) => {
    block.classList.remove("wa-preview-hit");
    delete block.dataset.issueKey;
  });
};

const findBlockByText = (
  blocks: HTMLElement[],
  text: string,
): HTMLElement | undefined => {
  const key = getTextKey(text);
  if (key.length < 3) return undefined;
  return blocks.find((block) => norm(block.textContent).includes(key));
};

export function PreviewPanel({
  buffer,
  targetText,
  targets,
  onSelectTarget,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [renderVersion, setRenderVersion] = useState(0);

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
        host.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const cs = getComputedStyle(el);
          const lh = parseFloat(cs.lineHeight);
          const fs = parseFloat(cs.fontSize);
          if (lh && fs && lh < fs) el.style.lineHeight = "normal";
        });
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
    resetPreviewTargets(el);
    const blocks = Array.from(el.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
    for (const target of targets) {
      const block = findBlockByText(blocks, target.text);
      if (!block || block.dataset.issueKey) continue;
      block.classList.add("wa-preview-hit");
      block.dataset.issueKey = target.issueKey;
    }
  }, [renderVersion, targets]);

  // 按段落原文匹配定位（不依赖序号，避免与渲染 DOM 错位）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll(".wa-hl").forEach((n) => n.classList.remove("wa-hl"));
    if (!targetText) return;
    const blocks = Array.from(el.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
    const block = findBlockByText(blocks, targetText);
    if (!block) return;
    block.classList.add("wa-hl");
    block.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [renderVersion, targetText]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>(".wa-preview-hit")
      : null;
    const issueKey = target?.dataset.issueKey;
    if (issueKey) onSelectTarget(issueKey);
  };

  return <div className="preview" ref={ref} onClick={handleClick} />;
}
