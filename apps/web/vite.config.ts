import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 用相对路径，兼容 GitHub Pages 任意子路径（项目页 /<repo>/）
export default defineConfig({
  base: "./",
  plugins: [react()],
});
