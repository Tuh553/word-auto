import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseDocx } from "@word-auto/parser";
import type { LineSpacing } from "@word-auto/parser";
import {
  classifyParagraphs,
  normalizeRuleLibrary,
  validateDoc,
  type EditableRuleLibrary,
  type LegacyRuleLibrary,
} from "@word-auto/validator";

const fmtLs = (ls?: LineSpacing): string => {
  if (!ls) return "-";
  return ls.pt != null ? `固定${ls.pt}pt` : `${ls.multiple}倍`;
};

const usage = `用法：
  pnpm --filter @word-auto/cli exec tsx src/main.ts <docx> --rules <规则库.json> [--out <报告文件>]

参数：
  <docx>          必填，待检测的 .docx 文件路径
  --rules <path>  规则库 JSON 路径
  --out <path>    可选，将报告写入文件；缺省时打印到 stdout
  -h, --help      打印本帮助并退出`;

const printUsage = (): void => {
  console.log(usage);
};

const fail = (message: string): never => {
  console.error(`错误：${message}`);
  process.exit(1);
};

const ensureFile = (path: string, label: string): void => {
  if (!existsSync(path)) {
    fail(`${label}不存在：${path}`);
  }
  const stat = statSync(path);
  if (!stat.isFile()) {
    fail(`${label}不是文件：${path}`);
  }
};

const ensureDocxPath = (path: string): void => {
  ensureFile(path, "输入文档");
  if (!path.toLowerCase().endsWith(".docx")) {
    fail(`输入文档必须是 .docx 文件：${path}`);
  }
};

const loadRules = (
  rulesPath: string,
): LegacyRuleLibrary | EditableRuleLibrary => {
  ensureFile(rulesPath, "规则库文件");
  const content = readFileSync(rulesPath, "utf8").replace(/^﻿/, "");
  try {
    return JSON.parse(content) as LegacyRuleLibrary | EditableRuleLibrary;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`规则库 JSON 解析失败：${rulesPath}\n${detail}`);
  }
  throw new Error("unreachable");
};

type CliOptions = {
  docxPath: string;
  rulesPath: string;
  outPath?: string;
};

type ReportTextInput = {
  docxPath: string;
  rulesPath: string;
  rulesName: string;
  model: ReturnType<typeof parseDocx>;
  roles: ReturnType<typeof classifyParagraphs>;
  report: ReturnType<typeof validateDoc>;
};

const parseRawArgs = () => {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        rules: { type: "string" },
        out: { type: "string" },
      },
      strict: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`${detail}\n\n${usage}`);
  }
  throw new Error("unreachable");
};

const parseCliArgs = (): CliOptions => {
  const parsed = parseRawArgs();
  const { values, positionals } = parsed;
  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const positionalDocx = positionals[0];
  if (!positionalDocx) {
    fail(`缺少必填参数 <docx>\n\n${usage}`);
  }
  if (positionals.length > 1) {
    fail(`只接受一个位置参数 <docx>，收到多余参数：${positionals.slice(1).join(" ")}\n\n${usage}`);
  }
  const rulesPath = values.rules;
  if (!rulesPath) {
    fail("未提供规则库路径，请显式传入 `--rules <path>`。");
  }

  return {
    docxPath: positionalDocx,
    rulesPath: rulesPath!,
    outPath: values.out,
  };
};

const loadDocModel = (docxPath: string): ReturnType<typeof parseDocx> => {
  try {
    const buf = readFileSync(docxPath);
    return parseDocx(new Uint8Array(buf));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`文档解析失败：${docxPath}\n${detail}`);
  }
  throw new Error("unreachable");
};

const buildReportText = ({
  docxPath,
  rulesPath,
  rulesName,
  model,
  roles,
  report,
}: ReportTextInput): string => {
  const lines: string[] = [];

  lines.push(`输入文档: ${docxPath}`);
  lines.push(`规则库:   ${rulesPath}`);
  lines.push("");

  lines.push("=== 解析自检（前 12 个已分类段落的“有效格式”）===");
  let shown = 0;
  model.paragraphs.forEach((p, i) => {
    const role = roles[i];
    if (!role || shown >= 12) return;
    shown++;
    const e = p.effective;
    const txt = p.text.replace(/\s+/g, " ").trim().slice(0, 14);
    lines.push(
      `#${p.index} [${role}] "${txt}" | 字体:${e.fontEastAsia ?? "-"}/${e.fontAscii ?? "-"} ` +
        `字号:${e.sizePt ?? "-"} 粗:${e.bold ? "Y" : "N"} 对齐:${e.alignment ?? "-"} ` +
        `行距:${fmtLs(e.lineSpacing)} 首行:${e.firstLineIndentChars ?? "-"}`,
    );
  });

  const sec = model.sections.at(-1);
  if (sec) {
    const cm = (tw?: number): string =>
      tw == null ? "-" : (tw / 566.93).toFixed(2);
    lines.push("");
    lines.push("=== 页面设置（主体节，实测）===");
    lines.push(
      `纸张 ${cm(sec.pageWidthTwips)}×${cm(sec.pageHeightTwips)}cm | ` +
        `边距 上${cm(sec.marginTopTwips)}/下${cm(sec.marginBottomTwips)}/` +
        `左${cm(sec.marginLeftTwips)}/右${cm(sec.marginRightTwips)}cm | ` +
        `页眉${cm(sec.headerTwips)}/页脚${cm(sec.footerTwips)}/装订${cm(sec.gutterTwips)}cm`,
    );
  }

  if (model.sections.length) {
    const fmts = model.sections.map(
      (s) =>
        `${s.pageNumberFormat ?? "decimal"}${s.pageNumberStart != null ? "@" + s.pageNumberStart : ""}`,
    );
    lines.push(`分节页码（共 ${model.sections.length} 节）: ${fmts.join(" | ")}`);
  }

  lines.push("");
  lines.push("=== 校验报告 ===");
  lines.push(`规则库: ${rulesName}`);
  lines.push(`段落总数 ${report.paragraphCount}，已分类 ${report.classifiedCount}`);
  lines.push(
    `问题: error ${report.summary.error} / warn ${report.summary.warn} / info ${report.summary.info}`,
  );

  lines.push("");
  lines.push("--- 问题明细（前 30 条）---");
  report.issues.slice(0, 30).forEach((it) => {
    const loc = it.paraIndex < 0 ? "[页面设置]" : `#${it.paraIndex + 1}`;
    lines.push(
      `${loc} [${it.severity}] (${it.role}.${it.field}) ${it.message}  «${it.textPreview}»`,
    );
  });
  if (report.issues.length > 30) {
    lines.push(`... 其余 ${report.issues.length - 30} 条见完整报告`);
  }

  return lines.join("\n");
};

const writeOutput = (text: string, outPath?: string): void => {
  if (!outPath) {
    console.log(text);
    return;
  }

  const resolved = resolve(process.cwd(), outPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, "utf8");
};

const main = (): void => {
  const { docxPath, rulesPath, outPath } = parseCliArgs();
  ensureDocxPath(docxPath);

  const rules = loadRules(rulesPath);
  const normalizedRules = normalizeRuleLibrary(rules);
  const model = loadDocModel(docxPath);

  const roles = classifyParagraphs(model.paragraphs);
  const report = validateDoc(model, normalizedRules);
  const text = buildReportText({
    docxPath,
    rulesPath,
    rulesName: normalizedRules.name,
    model,
    roles,
    report,
  });

  try {
    writeOutput(text, outPath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`写入报告失败：${outPath}\n${detail}`);
  }
};

main();
