import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const threeEntryPath = fileURLToPath(
  new URL("./node_modules/three/build/three.module.js", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "three"],
    alias: [
      {
        find: /^three$/,
        replacement: threeEntryPath,
      },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 740,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/scene3d/")) {
            return "scene3d-view";
          }

          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("three/examples")) {
            return "scene3d-three-examples";
          }

          if (id.includes("@react-three/fiber")) {
            return "scene3d-r3f";
          }

          if (
            id.includes("three/build/three.module.js") ||
            id.includes("three/build/three.core.js")
          ) {
            return "scene3d-three-entry";
          }

          if (id.includes("/three/")) {
            return "scene3d-three";
          }

          if (id.includes("socket.io-client")) {
            return "vendor-socket";
          }

          if (id.includes("react")) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
