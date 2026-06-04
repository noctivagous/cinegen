import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createRequestHandler, isProxyOrApiRequest, logProviderStatus, setupStateWebSocket } from './server/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = __dirname;

export default defineConfig({
  root: appRoot,
  css: {
    postcss: path.resolve(appRoot, 'postcss.config.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(appRoot, 'src'),
    },
  },
  build: {
    outDir: path.resolve(appRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(appRoot, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lit')) return 'lit-vendor';
          if (id.includes('/setup-assistant/')) return 'setup-assistant';
          if (id.includes('/workspace/workspace-bundle')) return 'workspace';
          if (id.includes('/components/panels/chunk-')) return 'panels-lazy';
          if (id.includes('modal-loader')) return;
          if (id.includes('/components/modals/') && !id.includes('templates')) return 'modals-lazy';
        },
      },
    },
  },
  plugins: [
    {
      name: 'cinegen-proxy',
      configureServer(server) {
        const handler = createRequestHandler();
        server.middlewares.use((req, res, next) => {
          if (isProxyOrApiRequest(req.url)) {
            handler(req, res);
          } else {
            next();
          }
        });
        setupStateWebSocket(server);
        logProviderStatus();
      },
    },
  ],
});
