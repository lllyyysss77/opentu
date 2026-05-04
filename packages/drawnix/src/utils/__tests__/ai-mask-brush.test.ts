import { describe, expect, it, vi } from 'vitest';
import {
  buildMaskStrokeCommands,
  exportImageMaskFromBrushes,
  findMaskBrushesForImage,
  MAX_AI_MASK_PIXELS,
} from '../ai-mask-brush';
import { FreehandShape } from '../../plugins/freehand/type';

const mocks = vi.hoisted(() => ({
  cacheMediaFromBlob: vi.fn(async (url: string) => url),
}));

vi.mock('../../services/unified-cache-service', () => ({
  unifiedCacheService: {
    cacheMediaFromBlob: mocks.cacheMediaFromBlob,
  },
}));

function createMockCanvas(blobSize = 128) {
  const compositeOperations: GlobalCompositeOperation[] = [];
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: string) {},
    set strokeStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set lineCap(_value: CanvasLineCap) {},
    set lineJoin(_value: CanvasLineJoin) {},
    set globalCompositeOperation(value: GlobalCompositeOperation) {
      compositeOperations.push(value);
    },
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(new Blob([new Uint8Array(blobSize)], { type: 'image/png' }));
    }),
  } as unknown as HTMLCanvasElement;

  return { canvas, context, compositeOperations };
}

function imageElement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'image-1',
    type: 'image',
    url: 'https://example.com/source.png',
    angle: 0,
    points: [
      [10, 20],
      [110, 70],
    ],
    ...overrides,
  } as any;
}

function maskElement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mask-1',
    type: 'freehand',
    shape: FreehandShape.mask,
    points: [
      [20, 30],
      [60, 50],
    ],
    strokeWidth: 10,
    ...overrides,
  } as any;
}

describe('ai-mask-brush', () => {
  it('按图片自然尺寸缩放蒙版笔迹坐标和线宽', () => {
    const commands = buildMaskStrokeCommands(
      imageElement(),
      [maskElement()],
      { width: 200, height: 100 }
    );

    expect(commands).toHaveLength(1);
    expect(commands[0].points).toEqual([
      [20, 20],
      [100, 60],
    ]);
    expect(commands[0].strokeWidth).toBe(20);
  });

  it('只查找与图片矩形相交的蒙版笔迹', () => {
    const image = imageElement();
    const overlapping = maskElement({ id: 'mask-overlap' });
    const outside = maskElement({
      id: 'mask-outside',
      points: [
        [300, 300],
        [320, 320],
      ],
    });
    const normalPen = maskElement({
      id: 'pen',
      shape: FreehandShape.feltTipPen,
    });
    const board = {
      children: [image, overlapping, outside, normalPen],
    };

    expect(findMaskBrushesForImage(board as any, image)).toEqual([overlapping]);
  });

  it('导出 PNG 后缓存为稳定 URL', async () => {
    const { canvas } = createMockCanvas();
    const strokes: Array<{ points: unknown[]; strokeWidth: number }> = [];

    const url = await exportImageMaskFromBrushes({
      imageElement: imageElement(),
      maskElements: [maskElement()],
      naturalSize: { width: 200, height: 100 },
      cacheId: 'test-mask',
      createCanvas: (width, height) => {
        canvas.width = width;
        canvas.height = height;
        return canvas;
      },
      onDrawStroke: (command) => strokes.push(command),
    });

    expect(url).toBe('/__aitu_cache__/image/test-mask.png');
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(strokes[0]).toMatchObject({
      points: [
        [20, 20],
        [100, 60],
      ],
      strokeWidth: 20,
    });
    expect(mocks.cacheMediaFromBlob).toHaveBeenCalledWith(
      '/__aitu_cache__/image/test-mask.png',
      expect.any(Blob),
      'image',
      expect.objectContaining({
        metadata: expect.objectContaining({ source: 'ai-mask-brush' }),
      })
    );
  });

  it('反选时把蒙版笔迹作为不透明区域绘制', async () => {
    const { canvas, compositeOperations } = createMockCanvas();

    const url = await exportImageMaskFromBrushes({
      imageElement: imageElement(),
      maskElements: [maskElement()],
      naturalSize: { width: 200, height: 100 },
      cacheId: 'test-mask-invert',
      invert: true,
      createCanvas: (width, height) => {
        canvas.width = width;
        canvas.height = height;
        return canvas;
      },
    });

    expect(url).toBe('/__aitu_cache__/image/test-mask-invert.png');
    expect(compositeOperations).toContain('source-over');
    expect(mocks.cacheMediaFromBlob).toHaveBeenCalledWith(
      '/__aitu_cache__/image/test-mask-invert.png',
      expect.any(Blob),
      'image',
      expect.objectContaining({
        metadata: expect.objectContaining({ invert: true }),
      })
    );
  });

  it('空蒙版不导出', async () => {
    await expect(
      exportImageMaskFromBrushes({
        imageElement: imageElement(),
        maskElements: [],
        naturalSize: { width: 200, height: 100 },
      })
    ).resolves.toBeUndefined();
  });

  it('图片像素超限时阻止生成', async () => {
    await expect(
      exportImageMaskFromBrushes({
        imageElement: imageElement(),
        maskElements: [maskElement()],
        naturalSize: { width: MAX_AI_MASK_PIXELS + 1, height: 1 },
      })
    ).rejects.toThrow('蒙版图片过大');
  });
});
