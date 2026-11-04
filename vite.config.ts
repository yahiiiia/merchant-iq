import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Never enable offline access in any build, including builds using development mode.
  const offlinePreview = command === "serve" && !isPreview && mode === "development" && env.VITE_OFFLINE_PREVIEW === "true";
  return {
    define: { __MERCHANTIQ_OFFLINE_PREVIEW__: JSON.stringify(offlinePreview) },
    server: { host: "::", port: 8080 },
    plugins: [dyadComponentTagger(), react()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
