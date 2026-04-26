import type { ImageProps } from '@plait/common';
import { RectangleClient } from '@plait/core';
import { Loading, MessagePlugin } from 'tdesign-react';
import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Video } from './video';
import { generateImage } from '../../mcp/tools/image-generation';
import { getImageRegion } from '../../services/ppt';
import {
  insertMediaIntoFrame,
  removePPTImagePlaceholder,
  setFramePPTImageStatus,
  setPPTImagePlaceholderStatus,
} from '../../utils/frame-insertion-utils';
import {
  clearVirtualUrlImageError,
  handleVirtualUrlImageError,
} from '../../utils/asset-cleanup';

const FALLBACK_OBJECT_URL_RELEASE_DELAY = 60_000;

const virtualImageFallbacks = new Map<
  string,
  {
    src: string;
    refCount: number;
    releaseTimer: number | null;
  }
>();

function acquireVirtualImageFallback(imageUrl: string): string | null {
  const entry = virtualImageFallbacks.get(imageUrl);
  if (!entry) {
    return null;
  }

  entry.refCount++;
  if (entry.releaseTimer) {
    window.clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }
  return entry.src;
}

function createOrAcquireVirtualImageFallback(
  imageUrl: string,
  blob: Blob
): string {
  const existing = acquireVirtualImageFallback(imageUrl);
  if (existing) {
    return existing;
  }

  const src = URL.createObjectURL(blob);
  virtualImageFallbacks.set(imageUrl, {
    src,
    refCount: 1,
    releaseTimer: null,
  });
  return src;
}

function releaseVirtualImageFallback(imageUrl: string | null): void {
  if (!imageUrl) {
    return;
  }

  const entry = virtualImageFallbacks.get(imageUrl);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount > 0 || entry.releaseTimer) {
    return;
  }

  entry.releaseTimer = window.setTimeout(() => {
    const latest = virtualImageFallbacks.get(imageUrl);
    if (!latest || latest.refCount > 0) {
      return;
    }
    URL.revokeObjectURL(latest.src);
    virtualImageFallbacks.delete(imageUrl);
  }, FALLBACK_OBJECT_URL_RELEASE_DELAY);
}

// 检查是否为视频元素（通过URL标识、扩展名或元数据）
const isVideoElement = (imageItem: any): boolean => {
  // 检查是否有视频标识属性
  if (imageItem.isVideo === true || imageItem.videoType) {
    return true;
  }

  const url = imageItem.url || '';

  // 检查 URL hash 标识符（用于 ObjectURL 的视频识别）
  // 格式：blob:http://...#video 或 blob:http://...#merged-video-{timestamp}
  if (url.includes('#video') || url.includes('#merged-video-')) {
    return true;
  }

  // 检查URL扩展名（用于普通 URL 的视频识别）
  const videoExtensions = [
    '.mp4',
    '.avi',
    '.mov',
    '.wmv',
    '.flv',
    '.webm',
    '.mkv',
  ];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

export const Image: React.FC<ImageProps> = (props: ImageProps) => {
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(() =>
    acquireVirtualImageFallback(props.imageItem.url)
  );
  const acquiredFallbackUrlRef = useRef<string | null>(
    fallbackSrc ? props.imageItem.url : null
  );
  const imgElementRef = useRef<HTMLImageElement | null>(null);
  const isMountedRef = useRef(true);
  const currentImageUrlRef = useRef(props.imageItem.url);

  const releaseAcquiredFallback = useCallback(() => {
    releaseVirtualImageFallback(acquiredFallbackUrlRef.current);
    acquiredFallbackUrlRef.current = null;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    currentImageUrlRef.current = props.imageItem.url;

    releaseAcquiredFallback();
    const existingFallback = acquireVirtualImageFallback(props.imageItem.url);
    acquiredFallbackUrlRef.current = existingFallback ? props.imageItem.url : null;
    setFallbackSrc(existingFallback);

    return () => {
      isMountedRef.current = false;
      releaseAcquiredFallback();
    };
  }, [props.imageItem.url, releaseAcquiredFallback]);

  const applyCachedFallback = useCallback((blob: Blob) => {
    if (
      !isMountedRef.current ||
      currentImageUrlRef.current !== props.imageItem.url
    ) {
      return;
    }

    if (acquiredFallbackUrlRef.current !== props.imageItem.url) {
      releaseAcquiredFallback();
      acquiredFallbackUrlRef.current = props.imageItem.url;
      setFallbackSrc(
        createOrAcquireVirtualImageFallback(props.imageItem.url, blob)
      );
    }

  }, [props.element.id, props.imageItem.url, releaseAcquiredFallback]);

  // 处理图片加载失败
  const handleImageError = useCallback((event: any) => {
    if (fallbackSrc && event.currentTarget?.src === fallbackSrc) {
      return;
    }

    const imageElement = event.currentTarget as HTMLImageElement;
    imgElementRef.current = imageElement;
    imageElement.style.visibility = 'hidden';

    const retry = handleVirtualUrlImageError(
      props.board,
      props.element,
      props.imageItem.url,
      {
        verifyCacheImmediately: true,
        onCachedBlob: applyCachedFallback,
      }
    );
    if (retry) {
      window.setTimeout(() => {
        if (acquiredFallbackUrlRef.current === props.imageItem.url) {
          return;
        }
        imageElement.src = retry.retryUrl;
      }, retry.delay);
    }
  }, [
    fallbackSrc,
    props.board,
    props.element,
    props.imageItem.url,
    applyCachedFallback,
  ]);
  const handleImageLoad = useCallback((event: any) => {
    (event.currentTarget as HTMLImageElement).style.visibility = '';
    clearVirtualUrlImageError(props.board, props.element, props.imageItem.url);
  }, [props.board, props.element, props.imageItem.url]);

  const elementData = props.element as any;
  const pptStatus = elementData?.pptImageStatus as
    | 'placeholder'
    | 'loading'
    | 'generated'
    | undefined;
  const pptPrompt = elementData?.pptImagePrompt as string | undefined;
  const pptFrameId = elementData?.frameId as string | undefined;
  const isLegacyAudioElement =
    elementData?.isAudio === true ||
    elementData?.audioType === 'music-card' ||
    (typeof elementData?.audioUrl === 'string' &&
      elementData.audioUrl.length > 0);
  const isVideo = isVideoElement(props.imageItem);
  const shouldContainFrameImage =
    !isLegacyAudioElement &&
    !isVideo &&
    typeof elementData?.frameId === 'string';

  const handlePPTImageGenerate = useCallback(async () => {
    if (!props.board || !pptFrameId || !pptPrompt || pptStatus === 'loading')
      return;

    setPPTImagePlaceholderStatus(props.board, pptFrameId, 'loading');
    setFramePPTImageStatus(props.board, pptFrameId, 'loading');

    try {
      const result = await generateImage({
        prompt: pptPrompt,
        size: '16x9',
      });

      if (result.success && (result.data as any)?.url) {
        removePPTImagePlaceholder(props.board, pptFrameId);

        const frame = props.board.children.find(
          (el: any) => el.id === pptFrameId
        );
        if (frame) {
          const frameRect = RectangleClient.getRectangleByPoints(frame.points!);
          const imgRegion = getImageRegion({
            x: frameRect.x,
            y: frameRect.y,
            width: frameRect.width,
            height: frameRect.height,
          });
          await insertMediaIntoFrame(
            props.board,
            (result.data as any).url,
            'image',
            pptFrameId,
            { width: frameRect.width, height: frameRect.height },
            { width: 800, height: 450 },
            imgRegion
          );
        }
        setFramePPTImageStatus(props.board, pptFrameId, 'generated');
      } else {
        setPPTImagePlaceholderStatus(props.board, pptFrameId, 'placeholder');
        setFramePPTImageStatus(props.board, pptFrameId, 'placeholder');
        MessagePlugin.error(result.error || '图片生成失败');
      }
    } catch (error: any) {
      setPPTImagePlaceholderStatus(props.board, pptFrameId, 'placeholder');
      setFramePPTImageStatus(props.board, pptFrameId, 'placeholder');
      MessagePlugin.error(error?.message || '图片生成失败');
    }
  }, [props.board, pptFrameId, pptPrompt, pptStatus]);

  if (elementData?.pptImagePlaceholder) {
    const isLoading = pptStatus === 'loading';

    return (
      <div
        className="ppt-image-placeholder"
        onClick={isLoading ? undefined : handlePPTImageGenerate}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px',
          borderRadius: '8px',
          border: '1px dashed #d9d9d9',
          backgroundColor: 'rgba(245,245,245,0.85)',
          color: '#999',
          fontSize: '13px',
          cursor: isLoading ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        {isLoading ? <Loading size="small" /> : null}
        <span>{isLoading ? '生成配图中…' : '点击生成配图'}</span>
      </div>
    );
  }

  // 如果是视频元素，使用视频组件渲染
  if (isVideo) {
    return (
      <Video
        videoItem={{
          url: props.imageItem.url,
          width: props.imageItem.width,
          height: props.imageItem.height,
          videoType: (props.imageItem as any).videoType,
          poster: (props.imageItem as any).poster,
        }}
        isFocus={props.isFocus}
        isSelected={(props as any).isSelected}
        readonly={(props as any).readonly}
      />
    );
  }

  // 否则使用原来的图片渲染
  const imgProps = {
    src: fallbackSrc || props.imageItem.url,
    draggable: false,
    ...(shouldContainFrameImage
      ? {
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'contain' as const,
            display: 'block',
          },
        }
      : {
          width: '100%',
        }),
  };
  return (
    <div
      data-slideshow-legacy-audio={isLegacyAudioElement ? 'true' : undefined}
      style={
        shouldContainFrameImage ? { width: '100%', height: '100%' } : undefined
      }
    >
      <img
        {...imgProps}
        className={classNames('image-origin', {
          'image-origin--focus': props.isFocus,
        })}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
};
