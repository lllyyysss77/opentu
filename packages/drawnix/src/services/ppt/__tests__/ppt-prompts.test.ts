import { describe, expect, it } from 'vitest';
import {
  generateOutlineSystemPrompt,
  generateSlideImagePrompt,
  parseOutlineResponse,
} from '../ppt-prompts';
import type { PPTOutline, PPTStyleSpec } from '../ppt.types';

const styleSpec: PPTStyleSpec = {
  visualStyle: 'editorial blue glass presentation system',
  colorPalette: 'navy text, porcelain background, cyan accent',
  typography: 'condensed bold titles with calm sans body text',
  layout: '12-column grid, repeated title rail, consistent card spacing',
  decorativeElements: 'thin cyan lines and small rounded data chips',
  avoid: 'avoid warm orange palettes and mixed illustration styles',
};

describe('ppt prompts style consistency', () => {
  it('requires a deck-level styleSpec in outline generation', () => {
    const prompt = generateOutlineSystemPrompt({
      language: '中文',
      extraRequirements: '科技发布会风格',
    });

    expect(prompt).toContain('styleSpec: PPTStyleSpec');
    expect(prompt).toContain('所有页面都必须共享同一套 styleSpec');
    expect(prompt).toContain('额外要求中包含风格要求');
  });

  it('fills missing styleSpec with a default that includes user style requirements', () => {
    const outline = parseOutlineResponse(
      JSON.stringify({
        title: 'AI 产品路线图',
        pages: [
          { layout: 'cover', title: '路线图' },
          { layout: 'ending', title: '谢谢' },
        ],
      }),
      { extraRequirements: '深色霓虹但保持商务感' }
    );

    expect(outline.styleSpec).toBeDefined();
    expect(outline.styleSpec?.visualStyle).toContain('深色霓虹但保持商务感');
    expect(outline.styleSpec?.colorPalette).toContain('no random palette changes');
  });

  it('normalizes partial styleSpec without rejecting the outline', () => {
    const outline = parseOutlineResponse(
      JSON.stringify({
        title: '增长复盘',
        styleSpec: {
          visualStyle: 'minimal report deck',
        },
        pages: [
          { layout: 'cover', title: '增长复盘' },
          { layout: 'ending', title: '谢谢' },
        ],
      })
    );

    expect(outline.styleSpec?.visualStyle).toBe('minimal report deck');
    expect(outline.styleSpec?.typography).toContain('geometric sans-serif');
  });

  it('injects the same styleSpec and adjacent page context into slide prompts', () => {
    const outline: PPTOutline = {
      title: 'AI 产品路线图',
      styleSpec,
      pages: [
        { layout: 'cover', title: '路线图' },
        {
          layout: 'title-body',
          title: '关键方向',
          bullets: ['模型能力升级', '工作流集成'],
        },
        { layout: 'ending', title: '谢谢' },
      ],
    };

    const prompt = generateSlideImagePrompt(
      outline,
      outline.pages[1],
      2,
      { language: '中文' }
    );

    expect(prompt).toContain('全局风格规格');
    expect(prompt).toContain(styleSpec.visualStyle);
    expect(prompt).toContain(styleSpec.colorPalette);
    expect(prompt).toContain('不得为当前页另起一套画风');
    expect(prompt).toContain('上一页：cover｜路线图');
    expect(prompt).toContain('下一页：ending｜谢谢');
  });
});
