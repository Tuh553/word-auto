import { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";

interface Props {
  buffer: ArrayBuffer;
  /** 要高亮定位的段落序号（与 parser 的 body 段落顺序对应） */
  selectedIndex: number | null;
}

export function PreviewPanel({ buffer, selectedIndex }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 渲染 docx 原貌。关闭页眉/页脚/脚注渲染，使正文 <p> 顺序尽量贴合 body 段落顺序。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    renderAsync(buffer.slice(0), el, undefined, {
      className: "docx",
      inWrapper: true,
      ignoreHeight: true,
      renderHeaders: false,
      renderFooters: false,
      renderFootnotes: false,
      renderEndnotes: false,
    }).catch((e: unknown) => {
      el.textContent = "预览渲染失败：" + (e as Error).message;
    });
  }, [buffer]);

  // 点击问题时定位高亮
  useEffect(() => {
    const el = ref.current;
    if (!el || selectedIndex == null) return;
    el.querySelectorAll("p.hl").forEach((p) => p.classList.remove("hl"));
    const ps = el.querySelectorAll("p");
    const target = ps[selectedIndex];
    if (target) {
      target.classList.add("hl");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedIndex]);

  return <div className="preview" ref={ref} />;
}
