import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getImagePrompts, getVideoPrompts } from '../../../constants/prompts';
import * as promptUtils from './prompt-utils';

const {
  mockGetImagePromptHistoryContents,
  mockGetVideoPromptHistoryContents,
  mockSortPrompts,
  mockIsPinned,
} = vi.hoisted(() => ({
  mockGetImagePromptHistoryContents: vi.fn(),
  mockGetVideoPromptHistoryContents: vi.fn(),
  mockSortPrompts: vi.fn(),
  mockIsPinned: vi.fn(),
}));

vi.mock('../../../services/prompt-storage-service', () => ({
  getImagePromptHistoryContents: mockGetImagePromptHistoryContents,
  getVideoPromptHistoryContents: mockGetVideoPromptHistoryContents,
  promptStorageService: {
    sortPrompts: mockSortPrompts,
    isPinned: mockIsPinned,
  },
}));
describe('resolvePromptItemsByGenerationType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetImagePromptHistoryContents.mockReturnValue([]);
    mockGetVideoPromptHistoryContents.mockReturnValue([]);
    mockSortPrompts.mockImplementation((_type, prompts) => prompts);
    mockIsPinned.mockReturnValue(false);
  });

  it('图片类型只返回图片来源，不混入视频或通用 AI 输入历史', () => {
    mockGetImagePromptHistoryContents.mockReturnValue(['本地图片历史']);
    mockGetVideoPromptHistoryContents.mockReturnValue(['本地视频历史']);

    const resolver = promptUtils.resolvePromptItemsByGenerationType;

    expect(typeof resolver).toBe('function');

    const items = resolver({
      generationType: 'image',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'ai-image-only',
          content: 'AI 输入图片历史',
          timestamp: 100,
          modelType: 'image',
        },
        {
          id: 'ai-video-only',
          content: 'AI 输入视频历史',
          timestamp: 200,
          modelType: 'video',
        },
      ],
      imageHistory: [
        {
          id: 'task-image-1',
          prompt: '任务图片历史',
          timestamp: 300,
          imageUrl: '/image-task.png',
          width: 1024,
          height: 1024,
        },
      ],
      videoHistory: [
        {
          id: 'task-video-1',
          prompt: '任务视频历史',
          timestamp: 400,
          imageUrl: '/video-thumb.png',
          previewUrl: '/video.mp4',
          downloadUrl: '/video.mp4',
          width: 1280,
          height: 720,
        },
      ],
    });

    const contents = items.map((item: { content: string }) => item.content);
    const taskImageItem = items.find(
      (item: { content: string }) => item.content === '任务图片历史'
    );
    const defaultImageItem = items.find(
      (item: { content: string }) => item.content === getImagePrompts('zh')[0]
    );

    expect(contents).toContain('本地图片历史');
    expect(contents).toContain('任务图片历史');
    expect(contents).toContain(getImagePrompts('zh')[0]);
    expect(contents).not.toContain('本地视频历史');
    expect(contents).not.toContain('任务视频历史');
    expect(contents).not.toContain('AI 输入图片历史');
    expect(contents).not.toContain('AI 输入视频历史');
    expect(taskImageItem?.previewExamples?.[0]?.src).toBe('/image-task.png');
    expect(defaultImageItem?.previewExamples?.length).toBeGreaterThan(0);
  });

  it('图片默认提示词为各自内容命中对应示例图，而不是复用同一组共享图', () => {
    const defaults = promptUtils.getDefaultPromptsByGenerationType('image', 'zh');
    const portraitItem = defaults.find(
      (item) => item.content === getImagePrompts('zh')[0]
    );
    const catItem = defaults.find(
      (item) => item.content === getImagePrompts('zh')[1]
    );

    expect(portraitItem?.previewExamples?.[0]?.src).toBe(
      '/prompt-examples/image/01.png'
    );
    expect(catItem?.previewExamples?.[0]?.src).toBe(
      '/prompt-examples/image/02.png'
    );
    expect(catItem?.previewExamples?.[0]?.src).not.toBe(
      portraitItem?.previewExamples?.[0]?.src
    );
  });

  it('同一条图片提示词同时存在本地历史和已完成任务时，真实任务结果预览优先', () => {
    const duplicatedPrompt = getImagePrompts('zh')[1];
    mockGetImagePromptHistoryContents.mockReturnValue([duplicatedPrompt]);

    const items = promptUtils.resolvePromptItemsByGenerationType({
      generationType: 'image',
      language: 'zh',
      aiInputHistory: [],
      imageHistory: [
        {
          id: 'task-image-real-preview',
          prompt: duplicatedPrompt,
          timestamp: 300,
          imageUrl: '/real-kitten-result.png',
          width: 1024,
          height: 1024,
        },
      ],
      videoHistory: [],
    });

    const duplicatedItems = items.filter((item) => item.content === duplicatedPrompt);

    expect(duplicatedItems).toHaveLength(1);
    expect(duplicatedItems[0]?.previewExamples?.[0]?.src).toBe(
      '/real-kitten-result.png'
    );
  });

  it('语言值异常时回退到默认语言，而不是抛出运行时错误', () => {
    expect(() =>
      promptUtils.getDefaultPromptsByGenerationType('image', 'zh-CN' as never)
    ).not.toThrow();

    const defaults = promptUtils.getDefaultPromptsByGenerationType(
      'image',
      'zh-CN' as never
    );

    expect(defaults[0]?.content).toBe(getImagePrompts('zh')[0]);
    expect(defaults[1]?.previewExamples?.[0]?.src).toBe(
      '/prompt-examples/image/02.png'
    );
  });

  it('视频类型只返回视频来源，不混入图片来源', () => {
    mockGetImagePromptHistoryContents.mockReturnValue(['本地图片历史']);
    mockGetVideoPromptHistoryContents.mockReturnValue(['本地视频历史']);

    const resolver = promptUtils.resolvePromptItemsByGenerationType;

    expect(typeof resolver).toBe('function');

    const items = resolver({
      generationType: 'video',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'ai-video-only',
          content: 'AI 输入视频历史',
          timestamp: 200,
          modelType: 'video',
        },
      ],
      imageHistory: [
        {
          id: 'task-image-1',
          prompt: '任务图片历史',
          timestamp: 300,
          imageUrl: '/image-task.png',
          width: 1024,
          height: 1024,
        },
      ],
      videoHistory: [
        {
          id: 'task-video-1',
          prompt: '任务视频历史',
          timestamp: 400,
          imageUrl: '/video-thumb.png',
          previewUrl: '/video.mp4',
          downloadUrl: '/video.mp4',
          width: 1280,
          height: 720,
        },
      ],
    });

    const contents = items.map((item: { content: string }) => item.content);
    const taskVideoItem = items.find(
      (item: { content: string }) => item.content === '任务视频历史'
    );
    const defaultVideoItem = items.find(
      (item: { content: string }) => item.content === getVideoPrompts('zh')[0]
    );

    expect(contents).toContain('本地视频历史');
    expect(contents).toContain('任务视频历史');
    expect(contents).toContain(getVideoPrompts('zh')[0]);
    expect(contents).not.toContain('本地图片历史');
    expect(contents).not.toContain('任务图片历史');
    expect(contents).not.toContain('AI 输入视频历史');
    expect(taskVideoItem?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/video.mp4',
      posterSrc: '/video-thumb.png',
      playable: true,
    });
    expect(defaultVideoItem?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/prompt-examples/video/01.mp4',
      posterSrc: '/prompt-examples/video/01.png',
      playable: true,
    });
  });

  it('默认视频提示词命中不足 8 秒的本地历史时，回退到内置 8 秒样片', () => {
    const duplicatedPrompt = getVideoPrompts('zh')[4];
    mockGetVideoPromptHistoryContents.mockReturnValue([duplicatedPrompt]);

    const items = promptUtils.resolvePromptItemsByGenerationType({
      generationType: 'video',
      language: 'zh',
      aiInputHistory: [],
      imageHistory: [],
      videoHistory: [
        {
          id: 'task-video-short-preview',
          prompt: duplicatedPrompt,
          timestamp: 500,
          imageUrl: '/local-short-video.png',
          previewUrl: '/local-short-video.mp4',
          downloadUrl: '/local-short-video.mp4',
          width: 1280,
          height: 720,
          duration: 5,
        } as any,
      ],
    });

    const duplicatedItems = items.filter((item) => item.content === duplicatedPrompt);

    expect(duplicatedItems).toHaveLength(1);
    expect(duplicatedItems[0]?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/prompt-examples/video/05.mp4',
      posterSrc: '/prompt-examples/video/05.png',
      playable: true,
    });
  });

  it('默认视频提示词命中同文案的真实视频历史时，仍优先使用内置样片，避免串用任务预览', () => {
    const duplicatedPrompt = getVideoPrompts('zh')[1];
    mockGetVideoPromptHistoryContents.mockReturnValue([duplicatedPrompt]);

    const items = promptUtils.resolvePromptItemsByGenerationType({
      generationType: 'video',
      language: 'zh',
      aiInputHistory: [],
      imageHistory: [],
      videoHistory: [
        {
          id: 'task-video-real-preview',
          prompt: duplicatedPrompt,
          timestamp: 600,
          imageUrl: '/generated/sunrise-task.png',
          previewUrl: '/generated/sunrise-task.mp4',
          downloadUrl: '/generated/sunrise-task.mp4',
          width: 1280,
          height: 720,
          duration: 8,
        } as any,
      ],
    });

    const duplicatedItems = items.filter((item) => item.content === duplicatedPrompt);

    expect(duplicatedItems).toHaveLength(1);
    expect(duplicatedItems[0]?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/prompt-examples/video/02.mp4',
      posterSrc: '/prompt-examples/video/02.png',
      playable: true,
    });
  });

  it('resolvePresetPromptItems 会为默认视频提示词生成与弹窗入口一致的内置样片预览', () => {
    const duplicatedPrompt = getVideoPrompts('zh')[1];

    const items = promptUtils.resolvePresetPromptItems({
      generationType: 'video',
      language: 'zh',
      promptContents: [duplicatedPrompt],
      imageHistory: [],
      videoHistory: [
        {
          id: 'task-video-real-preview',
          prompt: duplicatedPrompt,
          timestamp: 600,
          imageUrl: '/generated/sunrise-task.png',
          previewUrl: '/generated/sunrise-task.mp4',
          downloadUrl: '/generated/sunrise-task.mp4',
          width: 1280,
          height: 720,
          duration: 8,
        } as any,
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      content: duplicatedPrompt,
      modelType: 'video',
      pinned: false,
    });
    expect(items[0]?.previewExamples?.[0]).toMatchObject({
      kind: 'video',
      src: '/prompt-examples/video/02.mp4',
      posterSrc: '/prompt-examples/video/02.png',
      playable: true,
    });
  });

  it('resolvePresetPromptItems 会为默认图片提示词生成与弹窗入口一致的静态示例图', () => {
    const prompt = getImagePrompts('zh')[1];

    const items = promptUtils.resolvePresetPromptItems({
      generationType: 'image',
      language: 'zh',
      promptContents: [prompt],
      imageHistory: [],
      videoHistory: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      content: prompt,
      modelType: 'image',
      pinned: false,
    });
    expect(items[0]?.previewExamples?.[0]).toMatchObject({
      kind: 'image',
      src: '/prompt-examples/image/02.png',
    });
  });

  it('音频类型只返回音频历史与音频默认提示词', () => {
    const resolver = promptUtils.resolvePromptItemsByGenerationType;
    const getDefaults = promptUtils.getDefaultPromptsByGenerationType;

    expect(typeof resolver).toBe('function');
    expect(typeof getDefaults).toBe('function');

    const items = resolver({
      generationType: 'audio',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'audio-1',
          content: '音频历史提示',
          timestamp: 100,
          modelType: 'audio',
        },
        {
          id: 'text-1',
          content: '文本历史提示',
          timestamp: 200,
          modelType: 'text',
        },
        {
          id: 'agent-1',
          content: 'Agent 历史提示',
          timestamp: 300,
          modelType: 'agent',
        },
      ],
      imageHistory: [],
      videoHistory: [],
    });

    const contents = items.map((item: { content: string }) => item.content);
    const defaultAudioItem = items.find(
      (item: { content: string }) =>
        item.content === getDefaults('audio', 'zh')[0].content
    );
    const historyAudioItem = items.find(
      (item: { content: string }) => item.content === '音频历史提示'
    );

    expect(contents).toContain('音频历史提示');
    expect(contents).toContain(getDefaults('audio', 'zh')[0].content);
    expect(contents).not.toContain('文本历史提示');
    expect(contents).not.toContain('Agent 历史提示');
    expect(defaultAudioItem?.previewExamples?.length).toBeGreaterThan(0);
    expect(historyAudioItem?.previewExamples).toBeUndefined();
  });

  it('文本类型只返回文本历史与文本默认提示词', () => {
    const resolver = promptUtils.resolvePromptItemsByGenerationType;
    const getDefaults = promptUtils.getDefaultPromptsByGenerationType;

    expect(typeof resolver).toBe('function');
    expect(typeof getDefaults).toBe('function');

    const items = resolver({
      generationType: 'text',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'audio-1',
          content: '音频历史提示',
          timestamp: 100,
          modelType: 'audio',
        },
        {
          id: 'text-1',
          content: '文本历史提示',
          timestamp: 200,
          modelType: 'text',
        },
      ],
      imageHistory: [],
      videoHistory: [],
    });

    const contents = items.map((item: { content: string }) => item.content);
    const defaultTextItem = items.find(
      (item: { content: string }) =>
        item.content === getDefaults('text', 'zh')[0].content
    );
    const historyTextItem = items.find(
      (item: { content: string }) => item.content === '文本历史提示'
    );

    expect(contents).toContain('文本历史提示');
    expect(contents).toContain(getDefaults('text', 'zh')[0].content);
    expect(contents).not.toContain('音频历史提示');
    expect(defaultTextItem?.previewExamples?.length).toBeGreaterThan(0);
    expect(historyTextItem?.previewExamples).toBeUndefined();
  });

  it('Agent 类型只返回 Agent 历史与 Agent 默认提示词', () => {
    const resolver = promptUtils.resolvePromptItemsByGenerationType;
    const getDefaults = promptUtils.getDefaultPromptsByGenerationType;

    expect(typeof resolver).toBe('function');
    expect(typeof getDefaults).toBe('function');

    const items = resolver({
      generationType: 'agent',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'agent-1',
          content: 'Agent 历史提示',
          timestamp: 100,
          modelType: 'agent',
        },
        {
          id: 'video-1',
          content: '视频历史提示',
          timestamp: 200,
          modelType: 'video',
        },
      ],
      imageHistory: [],
      videoHistory: [],
    });

    const contents = items.map((item: { content: string }) => item.content);
    const defaultAgentItem = items.find(
      (item: { content: string }) =>
        item.content === getDefaults('agent', 'zh')[0].content
    );
    const historyAgentItem = items.find(
      (item: { content: string }) => item.content === 'Agent 历史提示'
    );

    expect(contents).toContain('Agent 历史提示');
    expect(contents).toContain(getDefaults('agent', 'zh')[0].content);
    expect(contents).not.toContain('视频历史提示');
    expect(defaultAgentItem?.previewExamples?.length).toBeGreaterThan(0);
    expect(historyAgentItem?.previewExamples).toBeUndefined();
  });

  it('PPT 公共提示词类型只返回公共提示词历史且无默认预设', () => {
    const resolver = promptUtils.resolvePromptItemsByGenerationType;
    const getDefaults = promptUtils.getDefaultPromptsByGenerationType;

    const items = resolver({
      generationType: 'ppt-common',
      language: 'zh',
      aiInputHistory: [
        {
          id: 'ppt-common-1',
          content: 'PPT 公共风格历史',
          timestamp: 100,
          modelType: 'ppt-common',
        },
        {
          id: 'agent-1',
          content: 'Agent 历史提示',
          timestamp: 200,
          modelType: 'agent',
        },
      ],
      imageHistory: [],
      videoHistory: [],
    });

    const contents = items.map((item: { content: string }) => item.content);

    expect(contents).toEqual(['PPT 公共风格历史']);
    expect(contents).not.toContain('Agent 历史提示');
    expect(getDefaults('ppt-common', 'zh')).toEqual([]);
    expect(items[0]?.previewExamples).toBeUndefined();
  });
});
