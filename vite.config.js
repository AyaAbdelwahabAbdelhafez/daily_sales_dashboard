import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works whether it's served from the repo
  // root or from a GitHub Pages project subpath (https://user.github.io/repo/).
  base: "./",
});
