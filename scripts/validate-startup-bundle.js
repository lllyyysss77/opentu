const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist/apps/web');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const IDLE_MANIFEST = path.join(DIST_DIR, 'idle-prefetch-manifest.json');
const DISALLOWED_PREFIXES = [
  'ai-chat-',
  'tool-windows-',
  'diagram-engines-',
  'office-data-',
  'external-skills-',
];
const STATIC_IMPORT_RE =
  /(?:import|export)\s*(?:[^"'`]*?\sfrom\s*)?["']\.\/([^"']+)["']/g;

function fail(message) {
  console.error(`[startup-validate] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
  fail('dist/apps/web/index.html 不存在，请先构建 web 应用');
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptMatches = Array.from(
  html.matchAll(/<script[^>]+src="\.\/([^"]+)"[^>]*><\/script>/g)
).map((match) => match[1]);
const styleMatches = Array.from(
  html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"[^>]*>/g)
).map((match) => match[1]);

const directAssets = [...scriptMatches, ...styleMatches].filter((asset) =>
  asset.startsWith('assets/')
);

if (directAssets.length === 0) {
  fail('入口 HTML 没有直接引用任何 assets 资源');
}

const invalidDirectAssets = directAssets.filter((asset) =>
  DISALLOWED_PREFIXES.some((prefix) => path.basename(asset).startsWith(prefix))
);

if (invalidDirectAssets.length > 0) {
  fail(`重模块重新回流到入口 HTML：${invalidDirectAssets.join(', ')}`);
}

if (!fs.existsSync(IDLE_MANIFEST)) {
  fail('idle-prefetch-manifest.json 不存在');
}

const idleManifest = JSON.parse(fs.readFileSync(IDLE_MANIFEST, 'utf8'));
const missingGroups = ['ai-chat', 'tool-windows'].filter((group) => {
  const files = idleManifest.groups?.[group];
  return !Array.isArray(files) || files.length === 0;
});

if (missingGroups.length > 0) {
  fail(`idle-prefetch-manifest 缺少高频分组：${missingGroups.join(', ')}`);
}

function collectStaticImports(entryAsset, visited = new Set()) {
  if (visited.has(entryAsset)) {
    return visited;
  }
  visited.add(entryAsset);

  const fullPath = path.join(DIST_DIR, entryAsset);
  if (!fs.existsSync(fullPath) || !entryAsset.endsWith('.js')) {
    return visited;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  STATIC_IMPORT_RE.lastIndex = 0;
  let match;

  while ((match = STATIC_IMPORT_RE.exec(source))) {
    const imported = path.posix.normalize(
      path.posix.join(path.posix.dirname(entryAsset), match[1])
    );
    if (!visited.has(imported)) {
      collectStaticImports(imported, visited);
    }
  }

  return visited;
}

const entryScripts = scriptMatches.filter(
  (asset) => asset.startsWith('assets/') && asset.endsWith('.js')
);

const entryDependencyGraph = new Set();
entryScripts.forEach((asset) => {
  collectStaticImports(asset, entryDependencyGraph);
});

const invalidStaticDeps = Array.from(entryDependencyGraph).filter(
  (asset) =>
    asset !== undefined &&
    DISALLOWED_PREFIXES.some((prefix) => path.basename(asset).startsWith(prefix))
);

if (invalidStaticDeps.length > 0) {
  fail(`重模块重新回流到入口依赖链：${invalidStaticDeps.join(', ')}`);
}

const sizeReport = directAssets.map((asset) => {
  const fullPath = path.join(DIST_DIR, asset);
  const size = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
  return {
    asset,
    size,
  };
});

console.log(
  JSON.stringify(
    {
      directAssets: sizeReport,
      entryDependencyGraph: Array.from(entryDependencyGraph).sort(),
      idlePrefetchGroups: Object.keys(idleManifest.groups || {}),
    },
    null,
    2
  )
);
