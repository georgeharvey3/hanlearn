/// <reference types="vitest" />
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The identity of one build.
 *
 * CI has the commit it is building; a local build asks git; a checkout without
 * git falls back to the clock, which is still distinct per build. The value
 * only has to differ between deploys, so any of the three will do.
 */
function resolveBuildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return `t${Date.now()}`;
  }
}

/**
 * Write the build id where the running app can read it back.
 *
 * The app compares the id baked into its bundle against `/version.json`, which
 * is fetched fresh, and reloads itself when the two differ. Vite hashes the
 * asset filenames, so a deploy already invalidates them; what goes stale is
 * `index.html`, which names those files, and a client that keeps its own copy
 * of that (an iOS home-screen app does) never sees the new bundle at all.
 * See web-client/src/utils/appVersion.ts.
 */
function versionStamp(buildId: string): Plugin {
  return {
    name: 'hanlearn-version-stamp',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      });
    },
  };
}

export default defineConfig(async () => {
  const buildId = resolveBuildId();
  const plugins: PluginOption[] = [react(), versionStamp(buildId)];

  if (process.env.ANALYZE === 'true') {
    const { visualizer } = await import('rollup-plugin-visualizer');
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
      }),
    );
  }

  return {
    plugins,
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    build: {
      outDir: 'dist',
      sourcemap: 'hidden',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-mui': ['@mui/material', '@mui/icons-material'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-redux': ['redux', 'react-redux', 'redux-thunk'],
            'vendor-sentry': ['@sentry/react'],
          },
        },
      },
    },
    server: {
      port: 3000,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      exclude: ['**/node_modules/**', '**/e2e/**'],
      testTimeout: 15000,
    },
  };
});
