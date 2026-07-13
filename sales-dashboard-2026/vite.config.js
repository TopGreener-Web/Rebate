import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const defaultPagesBase =
  process.env.GITHUB_PAGES === "true" &&
  repositoryName &&
  !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || defaultPagesBase,
  plugins: [react()],
});
