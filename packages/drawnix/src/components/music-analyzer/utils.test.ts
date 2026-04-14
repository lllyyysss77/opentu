import { describe, expect, it } from 'vitest';
import {
  buildLyricsRewritePrompt,
  parseLyricsRewriteResult,
} from './utils';

describe('music-analyzer utils', () => {
  it('embeds Suno metatag guidance in rewrite prompts', () => {
    const prompt = buildLyricsRewritePrompt({
      analysis: {
        summary: '副歌抓耳',
        language: '中文',
        mood: '热血',
        genreTags: ['edm'],
        structure: ['[Intro]', '[Chorus]'],
        hook: '副歌上扬',
        lyricRewriteBrief: '强化副歌',
        titleSuggestions: ['燃夜'],
      },
      userPrompt: '改成更适合短视频传播的版本',
    });

    expect(prompt).toContain('Suno 元标签规则');
    expect(prompt).toContain('[Intro]');
    expect(prompt).toContain('只返回合法 JSON');
  });

  it('extracts lyrics rewrite payload from JSON text', () => {
    const result = parseLyricsRewriteResult(`说明文字
{
  "title": "燃夜",
  "styleTags": ["edm pop", "female vocal"],
  "lyricsDraft": "[Verse]\\n我们迎着光奔跑"
}
后缀`);

    expect(result).toEqual({
      title: '燃夜',
      styleTags: ['edm pop', 'female vocal'],
      lyricsDraft: '[Verse]\n我们迎着光奔跑',
    });
  });
});
