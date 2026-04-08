import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime-model-discovery', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('不会把图片模型钉到音频类型列表里', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'provider-image',
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: 'gemini-3-pro-image-preview',
                label: 'Gemini Image',
                shortLabel: 'Gemini Image',
                shortCode: 'gmi',
                type: 'image',
                vendor: 'GEMINI',
              },
            ],
            selectedModelIds: ['gemini-3-pro-image-preview'],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-image',
            name: '图片供应商',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { getPinnedSelectableModel } = await import(
      '../runtime-model-discovery'
    );

    expect(
      getPinnedSelectableModel('audio', 'gemini-3-pro-image-preview', {
        profileId: 'provider-image',
        modelId: 'gemini-3-pro-image-preview',
      })
    ).toBeNull();
  });
});
