import {
  buildPromptOptimizationRequest,
  normalizeOptimizedPromptResult,
} from './ai-generation-utils';

describe('buildPromptOptimizationRequest', () => {
  it('builds zh image optimization instructions with original prompt and requirements', () => {
    const content = buildPromptOptimizationRequest({
      originalPrompt: '一只猫坐在窗台上',
      optimizationRequirements: '增加电影感和逆光氛围',
      language: 'zh',
      type: 'image',
    });

    expect(content).toContain('你是一名专业的图片生成提示词优化助手');
    expect(content).toContain('【原始提示词】\n一只猫坐在窗台上');
    expect(content).toContain('【优化要求】\n增加电影感和逆光氛围');
    expect(content).toContain('主体、构图、风格、光线');
  });

  it('falls back to light polishing when requirements are empty', () => {
    const content = buildPromptOptimizationRequest({
      originalPrompt: 'A castle at dusk',
      optimizationRequirements: '   ',
      language: 'en',
      type: 'video',
    });

    expect(content).toContain('professional video generation prompt optimizer');
    expect(content).toContain('[Original Prompt]\nA castle at dusk');
    expect(content).toContain(
      '[Refinement Requirements]\nNone. Apply light polishing for clarity and execution quality.'
    );
    expect(content).toContain('camera movement');
  });
});

describe('normalizeOptimizedPromptResult', () => {
  it('unwraps fenced code blocks', () => {
    expect(
      normalizeOptimizedPromptResult('```text\n优化后的提示词\n```')
    ).toBe('优化后的提示词');
  });

  it('returns trimmed plain text', () => {
    expect(normalizeOptimizedPromptResult('  refined prompt  ')).toBe(
      'refined prompt'
    );
  });
});
