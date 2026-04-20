import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';

// Full-reload on any src/ change: module-level singletons in the glasses
// layer (pageCreated, appStore, bridge) must reset in lockstep — HMR would
// leave them desynced with the Even bridge.
const evenHudFullReload = (): PluginOption => ({
  name: 'even-hud-full-reload',
  apply: 'serve',
  handleHotUpdate({ server, file }) {
    if (file.endsWith('index.html') || file.includes('/src/') || file.includes('\\src\\')) {
      server.ws.send({ type: 'full-reload', path: '*' });
      return [];
    }
  },
});

export default defineConfig({
  plugins: [react(), evenHudFullReload()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
