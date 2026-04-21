import fs from 'fs';
import path from 'path';

const rootDir = path.resolve('src/components');

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

const violations = [];

for (const filePath of collectFiles(rootDir)) {
  if (/\.(test|spec)\.tsx?$/.test(filePath)) {
    continue;
  }

  if (filePath.endsWith(path.join('shared', 'hover', 'HoverTip.tsx'))) {
    continue;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  const importsTooltip =
    /from\s+['"]tdesign-react['"]/.test(code) &&
    /import\s*{[^}]*\bTooltip\b[^}]*}\s*from\s*['"]tdesign-react['"]/.test(
      code
    );

  if (importsTooltip) {
    violations.push(
      `${path.relative(
        process.cwd(),
        filePath
      )}: 请改用共享 HoverTip，而不是直接从 tdesign-react 引入 Tooltip。`
    );
  }

  const nativeTooltipMatches = code.match(/<(button|div|span|a)\b[^>]*\btooltip=/gms);
  if (nativeTooltipMatches?.length) {
    violations.push(
      `${path.relative(
        process.cwd(),
        filePath
      )}: 原生 DOM 节点不应直接使用 tooltip 属性，请改为使用共享 HoverTip 包裹。`
    );
  }

  const toolButtonTitleMatches = code.match(/<ToolButton\b[^>]*\btitle=/gms);
  if (toolButtonTitleMatches?.length) {
    violations.push(
      `${path.relative(
        process.cwd(),
        filePath
      )}: ToolButton 的 hover 文案请改用 tooltip 属性，避免继续扩散原生 title 语义。`
    );
  }
}

if (violations.length > 0) {
  console.error('检测到不允许的 hover 用法:\n');
  console.error(violations.join('\n'));
  process.exit(1);
}
