import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ai-generation-preferences-service', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('保存并恢复 AI 输入栏下拉偏好', async () => {
    const {
      loadAIInputPreferences,
      saveAIInputPreferences,
    } = await import('../ai-generation-preferences-service');

    saveAIInputPreferences({
      generationType: 'text',
      selectedModel: 'deepseek-v3.2',
      selectedParams: {},
      selectedCount: 1,
      selectedSkillId: 'skill-123',
    });

    expect(loadAIInputPreferences()).toMatchObject({
      generationType: 'text',
      selectedModel: 'deepseek-v3.2',
      selectedCount: 1,
      selectedSkillId: 'skill-123',
    });
  });
});
