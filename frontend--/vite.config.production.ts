import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async ({ mode }) => {
  let taggerPlugin = undefined;
  try {
    const { componentTagger } = await import("lovable-tagger");
    taggerPlugin = componentTagger();
  } catch (e) {
    console.warn("lovable-tagger not loaded:", (e as Error).message);
  }

  return {
    base: "/",
    server: {
      host: "::",
      port: 5173,
      strictPort: false, // Allow Vite to use the next available port if 5173 is busy
    },
    plugins: [
      react(),
      mode === 'development' && taggerPlugin,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "terser",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          },
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    // Production optimizations
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        '@tanstack/react-query',
        'lucide-react',
        'recharts',
        'socket.io-client'
      ],
    },
    // Environment variables
    envPrefix: 'VITE_',
  };
});

