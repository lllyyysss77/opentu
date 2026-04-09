import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getCanvasSpeechText } from './text-to-speech-utils';

vi.mock('../../card-element/CardElement', () => ({
  getCardBodyElement: vi.fn(),
}));

describe('getCanvasSpeechText', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const selection = window.getSelection();
    selection?.removeAllRanges();
    vi.clearAllMocks();
  });

  it('优先返回 Card 内部选中的文本', async () => {
    const { getCardBodyElement } = await import('../../card-element/CardElement');

    const container = document.createElement('div');
    container.innerHTML = '<p><span>第一段</span><span>第二段</span></p>';
    document.body.appendChild(container);
    vi.mocked(getCardBodyElement).mockReturnValue(container);

    const range = document.createRange();
    const textNode = container.querySelector('span')?.firstChild;
    if (!textNode) throw new Error('text node missing');
    range.setStart(textNode, 0);
    range.setEnd(textNode, 3);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const result = getCanvasSpeechText({} as never, [
      { id: 'card-1', type: 'card', body: '忽略整卡内容', title: '标题' } as never,
    ]);

    expect(result).toEqual({
      text: '第一段',
      source: 'selection',
    });
  });

  it('没有局部选区时回退到整卡 markdown 内容', async () => {
    const { getCardBodyElement } = await import('../../card-element/CardElement');
    vi.mocked(getCardBodyElement).mockReturnValue(null);

    const result = getCanvasSpeechText({} as never, [
      { id: 'card-1', type: 'card', title: '标题', body: '## 正文' } as never,
    ]);

    expect(result).toEqual({
      text: '标题\n\n正文',
      source: 'element',
    });
  });

  it('拼接非 Card 元素提取出的文本', () => {
    const result = getCanvasSpeechText({} as never, [
      { id: 'text-1', type: 'text', text: '文本 A' } as never,
      {
        id: 'text-2',
        type: 'shape',
        data: [{ type: 'paragraph', children: [{ text: '文本 B' }] }],
      } as never,
    ]);

    expect(result).toEqual({
      text: '文本 A\n\n文本 B',
      source: 'element',
    });
  });
});
