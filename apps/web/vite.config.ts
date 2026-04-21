/// <reference types='vitest' />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { visualizer } from 'rollup-plugin-visualizer';

// Read version from public/version.json
const versionPath = path.resolve(__dirname, 'public/version.json');
let appVersion = '0.0.0';

try {
  if (fs.existsSync(versionPath)) {
    const versionContent = fs.readFileSync(versionPath, 'utf-8');
    const versionJson = JSON.parse(versionContent);
    appVersion = versionJson.version || '0.0.0';
    console.log(`[Vite] Loaded version from version.json: ${appVersion}`);
  } else {
    console.warn('[Vite] version.json not found at', versionPath);
  }
} catch (e) {
  console.error('[Vite] Failed to read version.json', e);
}

const IDLE_PREFETCH_GROUPS = [
  'ai-chat',
  'tool-windows',
  'diagram-engines',
  'office-data',
  'external-skills',
] as const;

type IdlePrefetchGroup = (typeof IDLE_PREFETCH_GROUPS)[number];

const AI_CHAT_ENTRY_MODULES = [
  '/packages/drawnix/src/components/version-update/version-update-prompt.tsx',
] as const;

const TOOL_WINDOW_ENTRY_MODULES = [
  '/packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx',
  '/packages/drawnix/src/components/toolbox-drawer/ToolboxDrawer.tsx',
  '/packages/drawnix/src/components/project-drawer/ProjectDrawer.tsx',
  '/packages/drawnix/src/components/backup-restore/backup-restore-dialog.tsx',
  '/packages/drawnix/src/components/startup/DeferredSyncSettings.tsx',
  '/packages/drawnix/src/components/command-palette/command-palette.tsx',
  '/packages/drawnix/src/components/canvas-search/canvas-search.tsx',
  '/packages/drawnix/src/components/performance-panel/PerformancePanel.tsx',
] as const;

const EDITOR_SHELL_SHARED_MODULES = [
  '/packages/drawnix/src/runtime.ts',
  '/packages/drawnix/src/i18n.tsx',
  '/packages/drawnix/src/hooks/use-drawnix',
  '/packages/drawnix/src/components/icons.tsx',
  '/packages/drawnix/src/components/popover/',
  '/packages/drawnix/src/components/shared/hover/',
  '/packages/drawnix/src/components/shared/ContextMenu',
  '/packages/drawnix/src/components/dialog/ConfirmDialog',
  '/packages/drawnix/src/services/workspace-',
  '/packages/drawnix/src/services/crash-recovery-service',
  '/packages/drawnix/src/services/unified-cache-service',
  '/packages/drawnix/src/services/kv-storage-service',
  '/packages/drawnix/src/services/workflow-submission-service',
  '/packages/drawnix/src/services/sw-channel/',
  '/packages/drawnix/src/services/web-vitals-service',
  '/packages/drawnix/src/services/page-report-service',
  '/packages/drawnix/src/services/prevent-pinch-zoom-service',
  '/packages/drawnix/src/services/db-cleanup-service',
  '/packages/drawnix/src/services/storage-migration-service',
  '/packages/drawnix/src/services/prompt-storage-service',
  '/packages/drawnix/src/services/toolbar-config-service',
  '/packages/drawnix/src/services/memory-monitor-service',
  '/packages/drawnix/src/hooks/useDocumentTitle',
  '/packages/drawnix/src/hooks/useTabSync',
  '/packages/drawnix/src/hooks/useWorkflow',
  '/packages/drawnix/src/hooks/useTaskWorkflowSync',
  '/packages/drawnix/src/hooks/use-runtime-models',
  '/packages/drawnix/src/contexts/AssetContext',
  '/packages/drawnix/src/contexts/ChatDrawerContext',
  '/packages/drawnix/src/contexts/ModelHealthContext',
  '/packages/drawnix/src/contexts/WorkflowContext',
  '/packages/drawnix/src/types/workspace.types',
  '/packages/drawnix/src/types/asset.types',
  '/packages/drawnix/src/types/audio-node.types',
  '/packages/drawnix/src/types/audio-playlist.types',
  '/packages/drawnix/src/types/card.types',
  '/packages/drawnix/src/types/fill.types',
  '/packages/drawnix/src/types/frame.types',
  '/packages/drawnix/src/types/task.types',
  '/packages/drawnix/src/utils/active-tasks',
  '/packages/drawnix/src/utils/api-auth-error-event',
  '/packages/drawnix/src/utils/common.ts',
  '/packages/drawnix/src/utils/posthog-analytics',
  '/packages/drawnix/src/components/startup/DeferredAIInputBar.tsx',
  '/packages/drawnix/src/components/ai-input-bar/',
  '/packages/drawnix/src/components/toolbox-drawer/ToolProviderWrapper',
  '/packages/drawnix/src/components/toolbar/minimized-tools-bar/',
  '/packages/drawnix/src/services/tool-window-service',
  '/packages/drawnix/src/services/toolbox-service',
  '/packages/drawnix/src/constants/built-in-tools',
  '/packages/drawnix/src/tools/registry',
] as const;

function matchesAnyPath(
  normalizedId: string,
  patterns: readonly string[]
): boolean {
  return patterns.some((pattern) => normalizedId.includes(pattern));
}

function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, '/');
}

function resolveManualChunk(id: string): string | undefined {
  const normalizedId = normalizeModuleId(id);

  if (
    normalizedId.includes('vite/preload-helper.js') ||
    normalizedId.includes('commonjsHelpers.js') ||
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/') ||
    normalizedId.includes('/node_modules/tdesign-react/') ||
    normalizedId.includes('/node_modules/@sentry/') ||
    normalizedId.includes('/node_modules/classnames/') ||
    normalizedId.includes('/node_modules/lodash-es/') ||
    normalizedId.includes('/node_modules/react-is/') ||
    normalizedId.includes('/node_modules/lucide-react/') ||
    normalizedId.includes('/node_modules/@floating-ui/')
  ) {
    return 'editor-shell';
  }

  if (normalizedId.includes('/packages/utils/')) {
    return 'editor-shell';
  }

  if (
    normalizedId.includes('/node_modules/mermaid/') ||
    normalizedId.includes('/node_modules/katex/') ||
    normalizedId.includes('/node_modules/elkjs/') ||
    normalizedId.includes('/@plait-board/mermaid-to-drawnix') ||
    normalizedId.includes('/@plait-board/markdown-to-drawnix')
  ) {
    return 'diagram-engines';
  }

  if (
    normalizedId.includes('/node_modules/xlsx/') ||
    normalizedId.includes('/node_modules/pptxgenjs/')
  ) {
    return 'office-data';
  }

  if (
    normalizedId.includes('/external-skill-service') ||
    normalizedId.includes('/external-skills-bundle') ||
    normalizedId.includes('/services/sw-capabilities/')
  ) {
    return 'external-skills';
  }

  // 首屏外功能只对“明确入口模块”手动分组，避免共享依赖整片被吸进延后 chunk。
  if (matchesAnyPath(normalizedId, AI_CHAT_ENTRY_MODULES)) {
    return 'ai-chat';
  }

  if (matchesAnyPath(normalizedId, EDITOR_SHELL_SHARED_MODULES)) {
    return 'editor-shell';
  }

  if (
    matchesAnyPath(normalizedId, TOOL_WINDOW_ENTRY_MODULES) ||
    normalizedId.includes('/node_modules/winbox/')
  ) {
    return 'tool-windows';
  }

  if (
    normalizedId.includes('/@plait/') ||
    normalizedId.includes('/packages/react-board/') ||
    normalizedId.includes('/packages/react-text/') ||
    normalizedId.includes('/node_modules/mobile-detect/') ||
    normalizedId.includes('/node_modules/roughjs/')
  ) {
    return 'editor-core';
  }

  if (
    normalizedId.includes('/packages/drawnix/src/components/toolbar/') ||
    normalizedId.includes(
      '/packages/drawnix/src/components/audio-node-element/'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/components/view-navigation/'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/components/multi-selection-handles'
    ) ||
    normalizedId.includes('/packages/drawnix/src/plugins/') ||
    normalizedId.includes('/packages/drawnix/src/data/') ||
    normalizedId.includes('/packages/drawnix/src/drawnix.tsx')
  ) {
    return 'editor-shell';
  }

  return undefined;
}

/**
 * Vite 插件：生成 precache-manifest.json
 * 在构建完成后扫描输出目录，生成需要预缓存的静态资源清单
 */
function precacheManifestPlugin(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');

        // 需要预缓存的文件扩展名
        const PRECACHE_EXTENSIONS = [
          '.js',
          '.css',
          '.html',
          '.json',
          '.svg',
          '.ico',
        ];
        // 排除的文件模式
        const EXCLUDE_PATTERNS = [
          /stats\.html$/, // Vite visualizer
          /\.map$/, // Source maps
          /precache-manifest\.json$/, // 自身
          /idle-prefetch-manifest\.json$/, // idle 预取清单
          /sw\.js$/, // Service Worker 本身不需要预缓存
          /sw-debug\.html$/, // 调试面板，仅在访问时加载
          /changelog\.json$/, // 版本日志，需要始终获取最新
          /version\.json$/, // 版本信息，需要始终获取最新
        ];
        // 总是包含的关键文件
        const ALWAYS_INCLUDE = [
          '/index.html',
          '/manifest.json',
          '/favicon.ico',
        ];

        const manifest: { url: string; revision: string }[] = [];

        // 递归扫描目录
        function scanDir(dir: string, base = '') {
          if (!fs.existsSync(dir)) return;

          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path
              .join(base, entry.name)
              .replace(/\\/g, '/');

            if (entry.isDirectory()) {
              // 跳过不需要预缓存的目录
              // - product_showcase, help_tooltips: 大型资源目录
              // - sw-debug: 调试面板，仅在访问 /sw-debug.html 时加载
              if (
                !['product_showcase', 'help_tooltips', 'sw-debug'].includes(
                  entry.name
                )
              ) {
                scanDir(fullPath, relativePath);
              }
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              const url = '/' + relativePath;

              // 检查是否应该排除
              const shouldExclude = EXCLUDE_PATTERNS.some((pattern) =>
                pattern.test(url)
              );
              if (shouldExclude) continue;

              // 检查是否是需要预缓存的文件类型
              const shouldInclude =
                PRECACHE_EXTENSIONS.includes(ext) ||
                ALWAYS_INCLUDE.includes(url);

              if (shouldInclude) {
                // 计算文件哈希作为 revision
                const content = fs.readFileSync(fullPath);
                const hash = crypto
                  .createHash('md5')
                  .update(new Uint8Array(content))
                  .digest('hex')
                  .substring(0, 8);

                manifest.push({ url, revision: hash });
              }
            }
          }
        }

        scanDir(outDir);

        // 按 URL 排序，便于调试
        manifest.sort((a, b) => a.url.localeCompare(b.url));

        // 写入 manifest 文件
        const manifestPath = path.join(outDir, 'precache-manifest.json');
        const manifestContent = {
          version: appVersion,
          timestamp: new Date().toISOString(),
          files: manifest,
        };

        fs.writeFileSync(
          manifestPath,
          JSON.stringify(manifestContent, null, 2)
        );
        console.log(
          `[Precache] Generated manifest with ${manifest.length} files`
        );
      },
    },
  };
}

function idlePrefetchManifestPlugin(): Plugin {
  return {
    name: 'idle-prefetch-manifest',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const assetsDir = path.join(outDir, 'assets');
        const groups = Object.fromEntries(
          IDLE_PREFETCH_GROUPS.map((group) => [
            group,
            [] as Array<{ url: string; revision: string }>,
          ])
        ) as Record<
          IdlePrefetchGroup,
          Array<{ url: string; revision: string }>
        >;

        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          for (const group of IDLE_PREFETCH_GROUPS) {
            const groupFiles = files.filter((file) => {
              const lower = file.toLowerCase();
              return (
                lower.startsWith(`${group}-`) &&
                (lower.endsWith('.js') || lower.endsWith('.css'))
              );
            });

            for (const file of groupFiles) {
              const fullPath = path.join(assetsDir, file);
              const content = fs.readFileSync(fullPath);
              const revision = crypto
                .createHash('md5')
                .update(new Uint8Array(content))
                .digest('hex')
                .substring(0, 8);
              groups[group].push({
                url: `/assets/${file}`,
                revision,
              });
            }
          }
        }

        const manifestPath = path.join(outDir, 'idle-prefetch-manifest.json');
        fs.writeFileSync(
          manifestPath,
          JSON.stringify(
            {
              version: appVersion,
              timestamp: new Date().toISOString(),
              defaults: ['ai-chat', 'tool-windows'],
              groups,
            },
            null,
            2
          )
        );
        console.log('[IdlePrefetch] Generated idle-prefetch-manifest.json');
      },
    },
  };
}

// 检测是否在 watch 模式下运行（命令行包含 --watch）
const isWatchMode = process.argv.includes('--watch');

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/web',

  // 使用相对路径，源站始终可用，CDN 加速由 SW 层处理
  // SW 的 handleStaticRequest: cache → CDN → 源站回退
  base: process.env.VITE_BASE_URL || './',

  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    __APP_VERSION__: JSON.stringify(appVersion),
    // Vue feature flags - @milkdown/crepe 内部使用了 Vue，需要定义这些编译时标志
    __VUE_OPTIONS_API__: JSON.stringify(false),
    __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
  },

  server: {
    port: 7200,
    host: 'localhost',
    headers: {
      'Content-Security-Policy':
        "upgrade-insecure-requests; default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://us.i.posthog.com https://us-assets.i.posthog.com https://wiki.tu-zi.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data:; frame-ancestors 'self' localhost:* 127.0.0.1:* https://api.tu-zi.com;",
    },
  },

  preview: {
    port: 4300,
    host: 'localhost',
    headers: {
      'Content-Security-Policy':
        "upgrade-insecure-requests; default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://us.i.posthog.com https://us-assets.i.posthog.com https://wiki.tu-zi.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data:; frame-ancestors 'self' localhost:* 127.0.0.1:* https://api.tu-zi.com;",
    },
  },

  plugins: [
    react(),
    nxViteTsPaths(),
    visualizer({
      open: false,
      filename: path.resolve(__dirname, '../../dist/apps/web/stats.html'),
      gzipSize: true,
      brotliSize: true,
    }),
    precacheManifestPlugin(),
    idlePrefetchManifestPlugin(),
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/web',
    // watch 模式下不清空输出目录，避免 index.html 丢失导致 serve 失败
    emptyOutDir: !isWatchMode,
    reportCompressedSize: true,
    // 首屏只注入壳层资源，懒加载分组改由运行时按需拉取/空闲预取。
    modulePreload: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          return resolveManualChunk(id);
        },
      },
    },
  },
});
