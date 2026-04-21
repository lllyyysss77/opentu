import { describe, expect, it } from 'vitest';
import { getSizeOptionsForModel } from '../model-config';

describe('model-config image size options', () => {
  it('为 gpt-image-2 系列暴露扩展比例', () => {
    const expected = [
      'auto',
      '1x1',
      '2x3',
      '3x2',
      '3x4',
      '4x3',
      '4x5',
      '5x4',
      '9x16',
      '16x9',
      '21x9',
    ];

    expect(getSizeOptionsForModel('gpt-image-2').map((option) => option.value)).toEqual(expected);
    expect(getSizeOptionsForModel('gpt-image-2-vip').map((option) => option.value)).toEqual(expected);
  });

  it('保留 gpt-image-1.5 的有限比例', () => {
    expect(getSizeOptionsForModel('gpt-image-1.5').map((option) => option.value)).toEqual([
      'auto',
      '1x1',
      '3x2',
      '2x3',
    ]);
  });
});
