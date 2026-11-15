import {cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig, type Plugin} from 'vite';

/**
 * The game loads images and audio at runtime from relative URLs such as
 * `assets/images/ship.png`, so they are never imported and the bundler does
 * not see them. The dev server serves them straight from the project root;
 * for a production build they have to be copied next to the bundle.
 */
function copyGameAssets(): Plugin {
  return {
    name: 'copy-game-assets',
    apply: 'build',
    closeBundle() {
      const root = import.meta.dirname;
      cpSync(resolve(root, 'assets'), resolve(root, 'dist/assets'), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any folder or sub-path.
  base: './',
  // No separate public folder: assets/ at the project root plays that role.
  publicDir: false,
  build: {
    // Keep the hashed bundle files out of assets/, which holds the game's own files.
    assetsDir: 'bundle',
    chunkSizeWarningLimit: 4000,
    // Never inline files as data: URLs. The Content-Security-Policy in
    // index.html only allows fonts from this site, and small font subsets
    // would otherwise be inlined and blocked.
    assetsInlineLimit: 0,
  },
  plugins: [copyGameAssets()],
});
