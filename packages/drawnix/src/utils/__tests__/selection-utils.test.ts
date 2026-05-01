import { describe, expect, it } from 'vitest';
import {
  extractImagesFromElementForAI,
  extractTextFromElement,
  getImageTransformPromptContext,
} from '../selection-utils';

describe('selection-utils', () => {
  describe('extractTextFromElement', () => {
    it('应该将 markdown card 的标题和正文作为文本提取', () => {
      const result = extractTextFromElement({
        id: 'card-1',
        type: 'card',
        title: '需求总结',
        body: '## 正文\n- 第一条\n- 第二条',
        fillColor: '#fff',
        points: [
          [0, 0],
          [100, 100],
        ],
        children: [],
      } as any);

      expect(result).toBe('# 需求总结\n## 正文\n- 第一条\n- 第二条');
    });

    it('应该在 card 没有标题时仍提取 markdown 正文', () => {
      const result = extractTextFromElement({
        id: 'card-2',
        type: 'card',
        body: '只保留正文',
        fillColor: '#fff',
        points: [
          [0, 0],
          [100, 100],
        ],
        children: [],
      } as any);

      expect(result).toBe('只保留正文');
    });
  });

  describe('extractImagesFromElementForAI', () => {
    it('应该保持发送给 AI 的参考图为原图 URL', async () => {
      const element = {
        id: 'image-1',
        type: 'image',
        url: 'https://example.com/source.png',
        angle: Math.PI / 6,
        transform3d: {
          rotateX: 12,
          rotateY: -34,
          perspective: 900,
        },
        points: [
          [0, 0],
          [120, 80],
        ],
      };
      const board = {
        children: [element],
        getRectangle: () => ({ x: 0, y: 0, width: 120, height: 80 }),
      };

      const images = await extractImagesFromElementForAI(
        board as any,
        element as any
      );

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('https://example.com/source.png');
      expect(images[0].name).toMatch(/^draw-image-/);
    });

    it('应该把 2D/3D 旋转参数作为提示词上下文', () => {
      const context = getImageTransformPromptContext({
        id: 'image-1',
        type: 'image',
        url: 'https://example.com/source.png',
        angle: Math.PI / 6,
        transform3d: {
          rotateX: 12,
          rotateY: -34,
          perspective: 900,
        },
        points: [
          [0, 0],
          [120, 80],
        ],
      } as any);

      expect(context).toContain('二维旋转 30°');
      expect(context).toContain('rotateX 12°');
      expect(context).toContain('rotateY -34°');
      expect(context).toContain('perspective 900px');
      expect(context).toContain('参考图为未变换原图');
      expect(context).toContain('请按以下画布显示效果理解');
    });

    it('没有旋转参数时不额外生成提示词上下文', () => {
      const context = getImageTransformPromptContext({
        id: 'image-plain',
        type: 'image',
        url: 'https://example.com/source.png',
        points: [
          [0, 0],
          [120, 80],
        ],
      } as any);

      expect(context).toBeNull();
    });
  });
});
