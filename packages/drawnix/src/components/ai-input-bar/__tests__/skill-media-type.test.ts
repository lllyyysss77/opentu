import { describe, expect, it } from 'vitest';
import {
  inferSkillMediaTypes,
  normalizeSkillOutputType,
} from '../skill-media-type';

describe('skill-media-type', () => {
  it('将 PPT 输出归类到图片模型选择', () => {
    expect(normalizeSkillOutputType('ppt')).toBe('image');
    expect(inferSkillMediaTypes({ outputType: 'ppt' })).toEqual(['image']);
  });

  it('优先使用显式输出类型', () => {
    expect(
      inferSkillMediaTypes({
        outputType: 'video',
        content: '调用 generate_image',
      })
    ).toEqual(['video']);
  });

  it('从工具名和内容推断媒体类型', () => {
    expect(inferSkillMediaTypes({ mcpTool: 'generate_audio' })).toEqual([
      'audio',
    ]);
    expect(
      inferSkillMediaTypes({
        content: '先调用 generate_image，再调用 generate_video',
      })
    ).toEqual(['image', 'video']);
  });
});
