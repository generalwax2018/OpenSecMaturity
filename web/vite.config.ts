import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Local-first build: no server, no accounts. `npm run build` writes one
// self-contained dist/index.html that opens straight from disk.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@catalog": here("../catalog"),
      "@": here("./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
    fs: { allow: [here("..")] },
  },
  preview: { host: "127.0.0.1", port: 8080 },
});
