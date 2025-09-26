import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';

// Load environment variables from multiple files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
      // Add SSR-specific rollup options to reduce warnings (e.g., empty chunks from Remix routes)
      ssr: {
        noExternal: [/^@remix-run\/.*/, /^ai\/.*/, 'isomorphic-git'],  // Keep server deps bundled
      },
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'crypto'],  // Add crypto for dev
        globals: {
          Buffer: true,
          process: true,
          global: true,
          // Add these for server-side compat in dev (won't bloat client)
          crypto: true,
        },
        protocolImports: true,
        // Remove exclusions for fs/child_process in dev; Wrangler handles prod
        exclude: config.mode === 'production' ? ['child_process', 'fs', 'path'] : [],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }
          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
          // Add this to suppress single-fetch warning
          v3_singleFetch: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    // Suppress dynamic/static import warnings by code-splitting
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Group large deps (e.g., AI SDK) to avoid conflicts
            vendor_ai: ['ai', '@ai-sdk/openai', '@ai-sdk/anthropic'],
            vendor_git: ['isomorphic-git'],
          },
        },
      },
    },
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OPENAI_LIKE_API_MODELS',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/tests/preview/**', // Exclude preview tests that require Playwright
      ],
    },
    // Resolve path externalization warning
    resolve: {
      alias: {
        path: 'path-browserify',  // Ensure browser-friendly path
      },
    },
  };
});

// ... (chrome129IssuePlugin unchanged)
