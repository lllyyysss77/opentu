// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_IMAGE_PROMPTS,
  AI_VIDEO_PROMPTS,
} from '../../../constants/prompts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mockPromptListPanel = vi.fn();
let roots: Root[] = [];

vi.mock('../../../services/prompt-storage-service', () => ({
  promptStorageService: {
    sortPrompts: (_type: string, prompts: string[]) => prompts,
    isPinned: () => false,
    pinPrompt: vi.fn(),
    unpinPrompt: vi.fn(),
    deletePrompt: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Lightbulb: () => React.createElement('span', { 'aria-hidden': 'true' }),
}));

vi.mock('../../../hooks/useMention', () => ({
  useMention: () => ({
    mentionState: {
      visible: false,
      query: '',
      position: { top: 0, left: 0 },
      showBelow: true,
      selectedIndex: 0,
    },
    textareaRef: { current: null },
    handleTextChange: vi.fn(),
    handleKeyDown: vi.fn(),
    handleCharacterSelect: vi.fn(),
    closeMentionPopup: vi.fn(),
  }),
}));

vi.mock('../../character/CharacterMentionPopup', () => ({
  CharacterMentionPopup: () => null,
}));

vi.mock('../../../hooks/use-runtime-models', () => ({
  useSelectableModels: () => [],
}));

vi.mock('../../../hooks/useGenerationHistory', () => ({
  useGenerationHistory: () => ({
    imageHistory: [],
    videoHistory: [
      {
        id: 'task-video-1',
        prompt: AI_VIDEO_PROMPTS.zh[0],
        timestamp: 100,
        imageUrl: '/generated/video-01.png',
        previewUrl: '/generated/video-01.mp4',
        downloadUrl: '/generated/video-01.mp4',
        width: 1280,
        height: 720,
      },
    ],
  }),
}));

vi.mock('../../../services/media-executor', () => ({
  executorFactory: {
    getFallbackExecutor: () => ({
      generateText: vi.fn(),
    }),
  },
}));

vi.mock('../../ai-input-bar/ModelDropdown', () => ({
  ModelDropdown: () => <div data-testid="model-dropdown" />,
}));

vi.mock('../../../utils/settings-manager', () => {
  return {
    createModelRef: vi.fn(),
    resolveInvocationRoute: () => ({ modelId: '', profileId: null }),
    providerPricingCacheSettings: {
      get: () => [],
      update: vi.fn(),
    },
  };
});

vi.mock('../../../utils/runtime-model-discovery', () => ({
  getPinnedSelectableModel: vi.fn(),
}));

vi.mock('../../../utils/model-selection', () => ({
  findMatchingSelectableModel: vi.fn(),
  getModelRefFromConfig: vi.fn(),
  getSelectionKey: vi.fn(),
}));

vi.mock('../../dialog/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeading: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../shared', () => ({
  PromptOptimizeButton: () => (
    <button type="button" data-testid="prompt-optimize-button" />
  ),
  PromptListPanel: (props: Record<string, unknown>) => {
    mockPromptListPanel(props);
    return <div data-testid="prompt-list-panel" />;
  },
}));

describe('PromptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    roots.forEach((root) => {
      act(() => root.unmount());
    });
    roots = [];
    document.body.innerHTML = '';
  });

  const renderPromptInput = async (
    props: Partial<
      React.ComponentProps<typeof import('./PromptInput').PromptInput>
    >
  ) => {
    const { PromptInput } = await import('./PromptInput');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        <PromptInput
          prompt=""
          onPromptChange={vi.fn()}
          language="zh"
          type="image"
          {...props}
        />
      );
    });
  };

  const openPresetPanel = () => {
    act(() => {
      document.querySelector<HTMLButtonElement>('.preset-icon-button')?.click();
    });
  };

  it('图片默认提示词在弹窗预设列表中不再带内置示例图', async () => {
    await renderPromptInput({
      presetPrompts: [AI_IMAGE_PROMPTS.zh[1]],
      type: 'image',
    });

    openPresetPanel();

    const panelProps = mockPromptListPanel.mock.calls.at(-1)?.[0] as {
      items: Array<{ content: string; previewExamples?: Array<{ src: string }> }>;
    };

    expect(panelProps.items[0]?.content).toBe(AI_IMAGE_PROMPTS.zh[1]);
    expect(panelProps.items[0]?.previewExamples).toEqual([]);
  });

  it('视频默认提示词命中用户生成历史时使用真实预览', async () => {
    await renderPromptInput({
      presetPrompts: [AI_VIDEO_PROMPTS.zh[0]],
      type: 'video',
    });

    openPresetPanel();

    const panelProps = mockPromptListPanel.mock.calls.at(-1)?.[0] as {
      items: Array<{
        content: string;
        previewExamples?: Array<{
          kind: string;
          src: string;
          posterSrc?: string;
        }>;
      }>;
    };

    expect(panelProps.items[0]?.content).toBe(AI_VIDEO_PROMPTS.zh[0]);
    expect(panelProps.items[0]?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/generated/video-01.mp4',
      posterSrc: '/generated/video-01.png',
      playable: true,
    });
  });

  it('未命中用户生成历史时，视频默认提示词不再回退到内置样片', async () => {
    await renderPromptInput({
      presetPrompts: [AI_VIDEO_PROMPTS.zh[1]],
      type: 'video',
    });

    openPresetPanel();

    const panelProps = mockPromptListPanel.mock.calls.at(-1)?.[0] as {
      items: Array<{
        content: string;
        previewExamples?: Array<{
          kind: string;
          src: string;
          posterSrc?: string;
        }>;
      }>;
    };

    expect(panelProps.items[0]?.content).toBe(AI_VIDEO_PROMPTS.zh[1]);
    expect(panelProps.items[0]?.previewExamples).toEqual([]);
  });
});
