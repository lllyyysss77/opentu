/**
 * PPT 大纲生成提示词模块
 *
 * 参考 banana-slides 8.2 节和 LandPPT 5.3 节设计
 * 输出严格 JSON（PPTOutline），内置语言控制和页数控制
 */

import type {
  PPTGenerateOptions,
  PPTLayoutType,
  PPTOutline,
  PPTPageSpec,
  PPTStyleSpec,
} from './ppt.types';

/** 页数范围映射 */
const PAGE_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  short: { min: 5, max: 7 },
  normal: { min: 8, max: 12 },
  long: { min: 13, max: 18 },
};

/** 版式类型描述 */
const LAYOUT_DESCRIPTIONS: Record<PPTLayoutType, string> = {
  cover: '封面页 - 用于PPT开头，包含主标题和副标题',
  toc: '目录页 - 展示PPT的章节结构',
  'title-body': '标题正文页 - 最常用的版式，标题 + 要点列表',
  'image-text': '图文页 - 同时包含文字信息和视觉表达',
  comparison: '对比页 - 左右对比两个概念或事物',
  ending: '结尾页 - 用于PPT结尾，包含感谢语或总结',
};

const VALID_LAYOUTS: PPTLayoutType[] = [
  'cover',
  'toc',
  'title-body',
  'image-text',
  'comparison',
  'ending',
];

const STYLE_FIELD_TEXT_LIMIT = 480;
const STYLE_REQUIREMENT_TEXT_LIMIT = 280;

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

/**
 * 默认 PPT 全局风格规格。
 * 只保存短文本，不保存图片或 base64，避免增大画布元数据。
 */
export function createDefaultPPTStyleSpec(
  options: PPTGenerateOptions = {}
): PPTStyleSpec {
  const extraRequirements = options.extraRequirements?.trim()
    ? truncateText(
        options.extraRequirements.trim(),
        STYLE_REQUIREMENT_TEXT_LIMIT
      )
    : '';
  const visualStyle = extraRequirements
    ? `professional modern premium presentation design, incorporate this user style requirement consistently: ${extraRequirements}`
    : 'professional modern premium presentation design, clean keynote style, polished SaaS editorial look';

  return {
    visualStyle,
    colorPalette:
      'warm white or very light neutral background, deep charcoal text, one consistent accent color, muted supporting colors, no random palette changes',
    typography:
      'consistent geometric sans-serif, bold concise titles, clear body hierarchy, same font mood and weight system on every slide',
    layout:
      'stable 16:9 grid, generous margins, repeated header/title rhythm, reusable cards/charts/content blocks, balanced whitespace',
    decorativeElements:
      'subtle geometric shapes, thin dividers, soft shadows, restrained icons, repeated visual motif across slides',
    avoid:
      'do not switch art styles, do not change color families between slides, do not use mismatched fonts, do not create busy backgrounds',
  };
}

function readStyleField(
  styleSpec: Record<string, unknown>,
  key: keyof PPTStyleSpec,
  fallback: string | undefined
): string | undefined {
  const value = styleSpec[key];
  return typeof value === 'string' && value.trim()
    ? truncateText(value.trim(), STYLE_FIELD_TEXT_LIMIT)
    : fallback;
}

export function normalizePPTStyleSpec(
  styleSpec: unknown,
  options: PPTGenerateOptions = {}
): PPTStyleSpec {
  const fallback = createDefaultPPTStyleSpec(options);
  if (!styleSpec || typeof styleSpec !== 'object') {
    return fallback;
  }

  const s = styleSpec as Record<string, unknown>;
  return {
    visualStyle: readStyleField(s, 'visualStyle', fallback.visualStyle)!,
    colorPalette: readStyleField(s, 'colorPalette', fallback.colorPalette)!,
    typography: readStyleField(s, 'typography', fallback.typography)!,
    layout: readStyleField(s, 'layout', fallback.layout)!,
    decorativeElements: readStyleField(
      s,
      'decorativeElements',
      fallback.decorativeElements
    )!,
    avoid: readStyleField(s, 'avoid', fallback.avoid),
  };
}

function normalizeOutlineStyle(
  outline: PPTOutline,
  options: PPTGenerateOptions = {}
): PPTOutline {
  return {
    ...outline,
    styleSpec: normalizePPTStyleSpec(outline.styleSpec, options),
  };
}

/**
 * 生成 PPT 大纲的系统提示词
 */
export function generateOutlineSystemPrompt(
  options: PPTGenerateOptions = {}
): string {
  const { pageCount = 'normal', language = '中文' } = options;
  const range = PAGE_COUNT_RANGES[pageCount] || PAGE_COUNT_RANGES.normal;

  return `你是一位专业的PPT大纲设计师。请根据用户提供的主题，生成一份结构清晰、逻辑严密、内容丰富的PPT大纲。

## 输出要求
1. 输出格式：严格JSON，符合 PPTOutline 接口定义
2. 输出语言：所有文本内容使用${language}
3. 页数控制：${range.min}-${range.max}页（不含封面和结尾）
4. 必须以封面页(cover)开头，结尾页(ending)结尾

## 可用版式类型
${Object.entries(LAYOUT_DESCRIPTIONS)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join('\n')}

## PPTOutline JSON Schema
\`\`\`typescript
interface PPTOutline {
  title: string;          // PPT总标题
  styleSpec: PPTStyleSpec; // 整套PPT共用的全局风格规格
  pages: PPTPageSpec[];   // 所有页面
}

interface PPTStyleSpec {
  visualStyle: string;        // 整体视觉风格，具体且可复用
  colorPalette: string;       // 主色、背景色、强调色、辅助色规则
  typography: string;         // 字体气质、字号层级、字重规则
  layout: string;             // 网格、留白、组件复用、版面节奏
  decorativeElements: string; // 重复出现的图形、图标、纹理或视觉母题
  avoid?: string;             // 禁止漂移项
}

interface PPTPageSpec {
  layout: "cover" | "toc" | "title-body" | "image-text" | "comparison" | "ending";
  title: string;          // 页面标题（控制在10个中文字符以内，避免换行）
  subtitle?: string;      // 副标题（cover/ending页使用）
  bullets?: string[];     // 页面要点：除 cover/ending 外必须提供，toc 为目录项
  imagePrompt?: string;   // 视觉概念描述（可选，英文）
  notes?: string;         // 演讲者备注（可选）
}
\`\`\`

## 视觉概念规则
- imagePrompt 是可选视觉概念，不是单独配图任务；可为需要更强画面指引的页面生成
- imagePrompt 使用英文描述，便于图片生成模型理解
- 描述应具体、可视化，包含主体、风格、氛围等要素
- imagePrompt 必须服从全局 styleSpec，不得为单页创造新的画风、色板或字体体系
- 示例："A futuristic city with flying cars and holographic billboards, professional flat design illustration, clean and modern style"

## 全局风格规格规则
1. 必须生成 styleSpec，且所有页面都必须共享同一套 styleSpec
2. styleSpec 要具体到可执行的视觉规则，不能只写 generic、modern、clean 这类泛词
3. 若额外要求中包含风格要求，必须融合进 styleSpec
4. 各页允许版式变化，但颜色、字体气质、组件样式、装饰母题必须一致

## 页面要点硬性规则
1. 除 cover 和 ending 外，每一页都必须包含非空 bullets 数组
2. toc 页 bullets 填 3-7 个目录项；title-body/image-text 页填 4-6 个正文要点
3. comparison 页必须填 6 个要点，前 3 个代表左侧，后 3 个代表右侧
4. 每个 bullet 必须是具体内容，10-24 个中文字符，不能只写概念名
5. 禁止在 bullets 中输出“无”“暂无”“待补充”“N/A”或空字符串
6. 如果主题信息较少，也要基于主题合理补全页面要点，不允许省略

## 设计原则
1. **标题精简**：每页标题控制在 10 个中文字符以内（约 20 个英文字符），避免在幻灯片上换行
2. **内容充实**：每页 4-6 个要点，每个要点 10-20 字，信息密度适中
3. **视觉完整**：每页都应能被图片模型生成成完整幻灯片画面
4. **逻辑清晰**：内容有明确的起承转合
5. **版式多样**：合理搭配不同版式，避免连续多页相同版式
6. **对比页要点**：comparison 版式需要 6 个要点（左右各 3 个），方便排版

## 输出格式
直接输出JSON对象，不要包含markdown代码块标记。`;
}

/**
 * 生成用户提示词
 */
export function generateOutlineUserPrompt(
  topic: string,
  options: PPTGenerateOptions = {}
): string {
  const { extraRequirements } = options;

  let prompt = `请为以下主题生成PPT大纲：

主题：${topic}`;

  if (extraRequirements) {
    prompt += `

额外要求：${extraRequirements}`;
  }

  prompt += `

请直接输出JSON格式的PPT大纲。`;
  prompt += `
注意：除 cover 和 ending 外，所有页面都必须生成 bullets，不能让页面要点为空或为“无”。`;

  return prompt;
}

function formatBullets(bullets?: string[]): string {
  if (!bullets || bullets.length === 0) return '无';
  return bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join('\n');
}

function formatStyleSpec(styleSpec: PPTStyleSpec): string {
  return `- 整体视觉风格：${styleSpec.visualStyle}
- 色板规则：${styleSpec.colorPalette}
- 字体规则：${styleSpec.typography}
- 布局规则：${styleSpec.layout}
- 装饰元素：${styleSpec.decorativeElements}
- 禁止事项：${styleSpec.avoid || '不得偏离上述全局风格规格'}`;
}

function formatCoreRequirements(options: PPTGenerateOptions = {}): string {
  const { language = '中文' } = options;
  return `## 核心要求
- 输出必须是一整页幻灯片设计，不要只生成插画、背景图或局部元素。
- 幻灯片内需要直接包含清晰可读的文字，不需要额外叠加文本。
- 文字语言：${language}
- 画面比例：16:9，留白合理，层级清晰，适合正式演示。
- 所有页面必须严格遵守公共提示词，不得为单页另起一套画风、色板、字体或组件样式。
- 各页可以有不同版式，但必须像同一套 PPT 模板中的一页。`;
}

export function formatPPTCommonPrompt(
  styleSpec: unknown,
  options: PPTGenerateOptions = {}
): string {
  return `整套 PPT 公共提示词，所有页面都必须遵守：

${formatCoreRequirements(options)}

## 全局风格规格
${formatStyleSpec(normalizePPTStyleSpec(styleSpec, options))}`;
}

export function buildPPTImageGenerationPrompt(
  commonPrompt: string,
  slidePrompt: string
): string {
  return [commonPrompt.trim(), slidePrompt.trim()]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export function normalizePPTSlidePrompt(prompt?: string): string {
  const normalized = prompt?.trim() || '';
  if (!normalized) return '';

  const separatorIndex = normalized.indexOf('\n---\n');
  const withoutMergedCommonPrompt =
    separatorIndex !== -1 &&
    /公共提示词|全局风格规格|所有页面/.test(
      normalized.slice(0, separatorIndex)
    )
      ? normalized.slice(separatorIndex).replace(/^\n---\n+/, '').trim()
      : normalized;

  return withoutMergedCommonPrompt
    .replace(/(^|\n)## 核心要求\n[\s\S]*?\n(?=## PPT 信息)/, '$1')
    .replace(
      /(^|\n)## 全局风格规格（整套 PPT 所有页面完全共用）\n[\s\S]*?\n(?=## PPT 信息)/,
      '$1'
    )
    .replace(
      /- 必须严格延续“全局风格规格”，不得为当前页另起一套画风、色板、字体或组件样式。/g,
      '- 必须严格遵守生成时拼接的“公共提示词”，不得为当前页另起一套画风、色板、字体或组件样式。'
    )
    .trim();
}

function summarizePage(page?: PPTPageSpec): string {
  if (!page) return '无';
  const bullets = page.bullets?.slice(0, 3).join('；') || '无要点';
  return `${page.layout}｜${page.title}${
    page.subtitle ? `｜${page.subtitle}` : ''
  }｜${bullets}`;
}

/**
 * 生成单页整图 PPT 的图片提示词。
 */
export function generateSlideImagePrompt(
  outline: Pick<PPTOutline, 'title' | 'pages' | 'styleSpec'>,
  page: PPTPageSpec,
  pageIndex: number,
  options: PPTGenerateOptions = {}
): string {
  const { extraRequirements } = options;
  const totalPages = outline.pages.length;
  const pageRole =
    page.layout === 'cover'
      ? '封面页'
      : page.layout === 'ending'
      ? '结束页'
      : page.layout === 'toc'
      ? '目录页'
      : `第 ${pageIndex} 页内容页`;
  const previousPage = outline.pages[pageIndex - 2];
  const nextPage = outline.pages[pageIndex];

  return `请生成一张完整的 16:9 PowerPoint 幻灯片图片，适合直接作为 PPT 第 ${pageIndex}/${totalPages} 页使用。

## PPT 信息
- PPT 总标题：${outline.title}
- 当前页面角色：${pageRole}
- 当前页面版式参考：${page.layout}
- 页面标题：${page.title}
- 副标题：${page.subtitle || '无'}
- 页面要点：
${formatBullets(page.bullets)}
- 视觉概念：${page.imagePrompt || '根据页面内容自行设计专业视觉元素'}

## 相邻页面上下文（用于保持连续性，不要照抄内容）
- 上一页：${summarizePage(previousPage)}
- 下一页：${summarizePage(nextPage)}

${extraRequirements ? `## 额外要求\n${extraRequirements}\n` : ''}
请只生成最终幻灯片画面。`;
}

/**
 * 验证 PPT 大纲结构
 */
export function validateOutline(
  outline: unknown
): outline is import('./ppt.types').PPTOutline {
  if (!outline || typeof outline !== 'object') return false;

  const o = outline as Record<string, unknown>;
  if (typeof o.title !== 'string' || !o.title) return false;
  if (!Array.isArray(o.pages) || o.pages.length === 0) return false;

  for (const page of o.pages) {
    if (!page || typeof page !== 'object') return false;
    const p = page as Record<string, unknown>;
    if (
      typeof p.layout !== 'string' ||
      !VALID_LAYOUTS.includes(p.layout as PPTLayoutType)
    )
      return false;
    if (typeof p.title !== 'string') return false;
  }

  return true;
}

function readStringField(
  value: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === 'string' && field.trim()) {
      return field.trim();
    }
  }
  return undefined;
}

function readStringArrayField(
  value: Record<string, unknown>,
  keys: string[]
): string[] | undefined {
  for (const key of keys) {
    const field = value[key];
    const items = Array.isArray(field)
      ? field
          .flatMap((item) =>
            typeof item === 'string' ? splitBulletText(item) : []
          )
          .map(normalizeBulletText)
          .filter(Boolean)
      : typeof field === 'string'
      ? splitBulletText(field).map(normalizeBulletText).filter(Boolean)
      : [];

    if (items.length > 0) return items;
  }
  return undefined;
}

function splitBulletText(value: string): string[] {
  return value
    .split(/\r?\n|[；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBulletText(value: string): string {
  const normalized = value
    .replace(/^\s*(?:[-*•]|(?:\d+|[一二三四五六七八九十]+)[、.．)]?)\s*/, '')
    .trim();

  return /^(无|暂无|没有|待补充|待定|n\/a|none|null)$/i.test(normalized)
    ? ''
    : normalized;
}

function normalizeLayoutValue(
  rawLayout: unknown,
  title: string,
  pageIndex: number,
  pageCount: number
): PPTLayoutType {
  const text = `${typeof rawLayout === 'string' ? rawLayout : ''} ${title}`
    .toLowerCase()
    .trim();

  if (text.includes('封面') || text.includes('cover')) return 'cover';
  if (text.includes('目录') || text.includes('toc') || text.includes('agenda'))
    return 'toc';
  if (
    text.includes('结尾') ||
    text.includes('结束') ||
    text.includes('谢谢') ||
    text.includes('致谢') ||
    text.includes('ending') ||
    text.includes('thanks')
  )
    return 'ending';
  if (
    text.includes('对比') ||
    text.includes('比较') ||
    text.includes('comparison') ||
    text.includes('compare')
  )
    return 'comparison';
  if (
    text.includes('图文') ||
    text.includes('image-text') ||
    text.includes('image_text') ||
    text.includes('visual')
  )
    return 'image-text';
  if (
    text.includes('正文') ||
    text.includes('内容') ||
    text.includes('title-body') ||
    text.includes('title_body') ||
    text.includes('body')
  )
    return 'title-body';

  if (pageIndex === 0) return 'cover';
  if (pageIndex === pageCount - 1) return 'ending';
  return 'title-body';
}

function normalizeOutlineShape(parsed: unknown): PPTOutline | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const outline = parsed as Record<string, unknown>;
  const rawPages = Array.isArray(outline.pages)
    ? outline.pages
    : Array.isArray(outline.slides)
    ? outline.slides
    : null;

  if (!rawPages || rawPages.length === 0) {
    return null;
  }

  const title =
    readStringField(outline, [
      'title',
      'theme',
      'topic',
      'name',
      'deckTitle',
      'deck_title',
    ]) || 'PPT 大纲';

  const pages = rawPages.map((rawPage, index): PPTPageSpec => {
    const page =
      rawPage && typeof rawPage === 'object'
        ? (rawPage as Record<string, unknown>)
        : { title: String(rawPage || '') };
    const pageTitle =
      readStringField(page, [
        'title',
        'pageTitle',
        'page_title',
        'headline',
        'name',
      ]) || `第 ${index + 1} 页`;
    const bullets = readStringArrayField(page, [
      'bullets',
      'key_points',
      'core_points',
      'points',
      'pagePoints',
      'page_points',
      'page_key_points',
      'slide_points',
      'main_points',
      'content_points',
      'takeaways',
      'content',
      'summary',
      '页面要点',
      '要点',
      '核心要点',
      '正文要点',
      '主要内容',
    ]);

    const normalizedPage: PPTPageSpec = {
      layout: normalizeLayoutValue(
        page.layout || page.type || page.pageType || page.page_type,
        pageTitle,
        index,
        rawPages.length
      ),
      title: pageTitle,
    };

    const subtitle = readStringField(page, [
      'subtitle',
      'subTitle',
      'sub_title',
    ]);
    const imagePrompt = readStringField(page, [
      'imagePrompt',
      'image_prompt',
      'visualPrompt',
      'visual_prompt',
    ]);
    const notes = readStringField(page, [
      'notes',
      'speakerNotes',
      'speaker_notes',
    ]);

    if (subtitle) normalizedPage.subtitle = subtitle;
    if (bullets) normalizedPage.bullets = bullets;
    if (imagePrompt) normalizedPage.imagePrompt = imagePrompt;
    if (notes) normalizedPage.notes = notes;

    return normalizedPage;
  });

  return {
    title,
    styleSpec: (outline.styleSpec ||
      outline.style ||
      outline.designStyle ||
      outline.design_style) as PPTStyleSpec | undefined,
    pages,
  };
}

function parseAndNormalizeOutline(
  jsonStr: string,
  options: PPTGenerateOptions
): PPTOutline | null {
  const parsed = JSON.parse(jsonStr);
  const normalized = normalizeOutlineShape(parsed);
  if (normalized && validateOutline(normalized)) {
    return normalizeOutlineStyle(normalized, options);
  }

  if (validateOutline(parsed)) {
    return normalizeOutlineStyle(parsed, options);
  }

  return null;
}

function extractFencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text))) {
    const block = match[1]?.trim();
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * 从文本中提取所有完整 JSON 对象候选。
 */
function extractJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

/**
 * 解析 AI 返回的大纲 JSON
 */
export function parseOutlineResponse(
  response: string,
  options: PPTGenerateOptions = {}
): import('./ppt.types').PPTOutline {
  let jsonStr = response.trim();

  // 移除可能的 markdown 代码块标记
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const candidates: string[] = [];
  const addCandidate = (candidate: string) => {
    const trimmed = candidate.trim();
    if (trimmed && !candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  addCandidate(jsonStr);
  extractFencedJsonBlocks(jsonStr).forEach(addCandidate);
  extractJsonObjectCandidates(jsonStr).forEach(addCandidate);

  // 策略1: 直接解析候选 JSON
  for (const candidate of candidates) {
    try {
      const outline = parseAndNormalizeOutline(candidate, options);
      if (outline) {
        return outline;
      }
    } catch {
      // 当前候选解析失败，继续尝试下一个候选
    }
  }

  // 策略3: 尝试修复常见 JSON 问题（如尾部逗号、单引号等）
  for (const candidate of candidates) {
    try {
      const fixedStr = candidate
        .replace(/,\s*([}\]])/g, '$1') // 移除尾部逗号
        .replace(/(['"])?(\w+)(['"])?\s*:/g, '"$2":') // 修复未引用的 key
        .replace(/:\s*'([^']*)'/g, ':"$1"'); // 单引号转双引号

      const outline = parseAndNormalizeOutline(fixedStr, options);
      if (outline) {
        return outline;
      }
    } catch {
      // 当前候选修复后仍然解析失败，继续尝试下一个候选
    }
  }

  throw new Error(
    `Failed to parse PPT outline. AI response may contain invalid JSON. ` +
      `Response preview: ${response.slice(0, 200)}...`
  );
}
