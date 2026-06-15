// @ts-check
// 结构性门禁：lint 聚焦「复杂度 / 体量 / 反模式」这类机器可测的劣化信号，
// 与 jscpd（重复）、knip（死代码）互补。type-checked 规则暂不启用：本仓库
// OOXML 解析层大量以 any 操作动态节点，全量 no-unsafe-* 会淹没真正信号。
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.{js,mjs,ts}",
      "eslint.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // BOM 去除等场景需在正则字面量内匹配特殊空白，豁免正则；其余位置仍报错
      "no-irregular-whitespace": ["error", { skipRegExps: true }],
      // 结构债务（复杂度/体量）存量较多：设 warn + CI --max-warnings 棘轮锁定，
      // 不阻断当前构建，但不允许新增；增量收紧时再下调阈值与上限。
      complexity: ["warn", { max: 15 }],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      // OOXML 解析层以 any 操作动态节点是设计选择，不纳入治理（也避免污染棘轮计数）
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // 测试文件放宽体量（用例常含大块构造数据）
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "max-lines-per-function": "off",
      "max-lines": "off",
    },
  },
);
