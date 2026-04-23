// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHoverTip = vi.fn();

vi.mock('./hover', () => ({
  HoverTip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
  }) => {
    mockHoverTip(content);
    return (
      <div data-testid="hover-tip">
        {children}
        <div data-testid="hover-tip-content">{content}</div>
      </div>
    );
  },
}));

describe('PromptListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    {
      modelType: 'image',
      content: '默认图片提示词',
      previewExamples: [
        {
          kind: 'image' as const,
          src: '/prompt-examples/image/01.png',
          alt: 'image example',
        },
      ],
    },
    {
      modelType: 'video',
      content: '默认视频提示词',
      previewExamples: [
        {
          kind: 'video' as const,
          src: '/prompt-examples/video/01.mp4',
          posterSrc: '/prompt-examples/video/01.png',
          playable: true,
          alt: 'video example',
        },
      ],
    },
    {
      modelType: 'audio',
      content: '默认音频提示词',
      previewExamples: [
        {
          kind: 'image' as const,
          src: '/prompt-examples/audio/01.png',
          alt: 'audio example',
        },
      ],
    },
    {
      modelType: 'text',
      content: '默认文本提示词',
      previewExamples: [
        {
          kind: 'image' as const,
          src: '/prompt-examples/text/01.png',
          alt: 'text example',
        },
      ],
    },
    {
      modelType: 'agent',
      content: '默认 Agent 提示词',
      previewExamples: [
        {
          kind: 'image' as const,
          src: '/prompt-examples/agent/01.png',
          alt: 'agent example',
        },
      ],
    },
  ])(
    '$modelType 默认提示词有 previewExamples 时复用 HoverTip 展示富预览内容',
    async ({ modelType, content, previewExamples }) => {
      const { PromptListItem } = await import('./PromptListItem');
      const onPreviewExample = vi.fn();

      render(
        <PromptListItem
          content={content}
          modelType={modelType}
          previewExamples={previewExamples}
          onPreviewExample={onPreviewExample}
        />
      );

      expect(screen.getByTestId('hover-tip')).toBeTruthy();
      if (previewExamples[0].kind === 'video') {
        expect(
          screen.getByAltText(previewExamples[0].alt)
        ).toBeTruthy();
      } else {
        expect(screen.getByAltText(previewExamples[0].alt)).toBeTruthy();
      }
      expect(screen.getAllByText(content)).toHaveLength(2);
      expect(
        document.querySelector('.prompt-list-item__hover-gallery--single')
      ).toBeTruthy();
      expect(
        document.querySelector('.prompt-list-item__hover-thumb--single')
      ).toBeTruthy();
      expect(mockHoverTip).toHaveBeenCalled();

      fireEvent.mouseDown(
        screen.getByRole('button', { name: '预览示例图 1' })
      );

      expect(onPreviewExample).toHaveBeenCalledWith({
        content,
        initialIndex: 0,
        previewExamples,
      });
    }
  );

  it('默认视频样片 hover 时显示静态封面并使用中性预览文案', async () => {
    const { PromptListItem } = await import('./PromptListItem');

    render(
      <PromptListItem
        content="默认视频提示词"
        modelType="video"
        previewExamples={[
          {
            kind: 'video',
            src: '/prompt-examples/video/01.mp4',
            posterSrc: '/prompt-examples/video/01.png',
            playable: true,
            alt: 'video example',
          },
        ]}
        onPreviewExample={vi.fn()}
      />
    );

    const media = screen.getByAltText('video example');
    const video = screen.getByTestId('hover-tip-content').querySelector('video');

    expect(media.getAttribute('src')).toBe('/prompt-examples/video/01.png');
    expect(video).toBeNull();
    expect(screen.getByText('点击预览')).toBeTruthy();
    expect(screen.queryByText('点击播放预览')).toBeNull();
  });

  it('真实视频样片 hover 时也使用静态封面和中性预览文案', async () => {
    const { PromptListItem } = await import('./PromptListItem');

    render(
      <PromptListItem
        content="任务视频提示词"
        modelType="video"
        previewExamples={[
          {
            kind: 'video',
            src: '/generated/video-01.mp4',
            posterSrc: '/generated/video-01.png',
            playable: true,
            alt: 'video example',
          },
        ]}
        onPreviewExample={vi.fn()}
      />
    );

    const media = screen.getByAltText('video example');
    const video = screen.getByTestId('hover-tip-content').querySelector('video');

    expect(media.getAttribute('src')).toBe('/generated/video-01.png');
    expect(video).toBeNull();
    expect(screen.getByText('点击预览')).toBeTruthy();
    expect(screen.queryByText('点击播放预览')).toBeNull();
  });

  it('没有 previewExamples 时退回纯文本 HoverTip', async () => {
    const { PromptListItem } = await import('./PromptListItem');

    render(<PromptListItem content="无图历史提示词" />);

    expect(screen.getByTestId('hover-tip')).toBeTruthy();
    expect(mockHoverTip).toHaveBeenCalledWith('无图历史提示词');
  });
});
