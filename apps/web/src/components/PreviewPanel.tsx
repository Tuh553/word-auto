import { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";

interface Props {
  buffer: ArrayBuffer;
  /** 要定位高亮的段落原文（文档级问题为 null，不定位） */
  targetText: string | null;
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, "");

export function PreviewPanel({ buffer, targetText }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
      })
      .catch((e: unknown) => {
        if (!stale) host.textContent = "预览渲染失败：" + (e as Error).message;
      });
    return () => {
      stale = true;
    };
  }, [buffer]);

  // 按段落原文匹配定位（不依赖序号，避免与渲染 DOM 错位）
  useEffect(() => {
    const el = ref.current;
    if (!el || !targetText) return;
    const key = norm(targetText).slice(0, 18);
    if (key.length < 3) return;

    el.querySelectorAll(".wa-hl").forEach((n) => n.classList.remove("wa-hl"));
    const blocks = el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, td, li");
    for (const b of Array.from(blocks)) {
      if (norm(b.textContent).includes(key)) {
        b.classList.add("wa-hl");
        b.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }, [targetText]);

  return <div className="preview" ref={ref} />;
}
