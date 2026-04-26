/**
 * AI 的默认提示词常量
 */

// AI 图片默认提示词
export const AI_IMAGE_PROMPTS = {
  zh: [
    `一张写实的半身人像，一位身穿水蓝色连身裙的年轻韩国亚洲女人走进旅馆大厅，女人脸上带着温暖的微笑，左手拿着白色棒球帽，右手拉着黄色行李箱。
场景在济州岛度假感的旅馆大厅里，柔和的光线从窗外洒入室内柔和的打在女人的身上，凸显了女人的脸部表情。
使用 50mm 人像镜头拍摄，女人在画面中央，背景呈现柔和的模糊（散景）。
氛围是日系杂志的色调并充满放松度假感。直式人像构图，比例1:1。`,
    '一只可爱的小猫坐在窗台上，阳光透过窗户洒在它的毛发上',
    '美丽的山水风景，青山绿水，云雾缭绕',
    '现代简约风格的室内设计，明亮宽敞',
    '夜晚的城市天际线，霓虹灯闪烁',
    '春天的樱花盛开，粉色花瓣飘落',
    '科幻风格的太空站，星空背景',
    '温馨的咖啡厅，暖色调灯光',
    '抽象艺术风格，色彩丰富的几何图形'
  ],
  en: [
    `young Korean woman in a light blue dress holding a white baseball cap and pulling a yellow suitcase, photography,
stylish modern hotel lobby, soft sunlight streaming through the window, pastel tones, relaxed vacation mood,
centered vertical portrait with bokeh background, medium shot.`,
    'A cute kitten sitting on a windowsill with sunlight streaming through',
    'Beautiful mountain landscape with green hills and misty clouds',
    'Modern minimalist interior design, bright and spacious',
    'City skyline at night with neon lights glowing',
    'Cherry blossoms in spring with pink petals falling',
    'Sci-fi space station with starry background',
    'Cozy coffee shop with warm ambient lighting',
    'Abstract art with colorful geometric shapes'
  ]
} as const;

// AI 视频默认提示词
export const AI_VIDEO_PROMPTS = {
  zh: [
    `场景：日落时分，一座宏伟的城堡庭院，金色的光线透过彩色玻璃窗，营造出温暖而充满希望的氛围。
相机：对两位公主进行中特写跟踪拍摄，然后进行广角拉出，露出整个庭院，最后缓慢向上倾斜到天空。
动作：公主们互相微笑，然后开始和谐地唱歌，然后在灯光亮起时向天空举手。
音频：柔和的管弦乐，伴随着令人振奋的弦乐和合唱，沙沙作响的树叶和远处鸟儿的环绕声，对话："我们相信明天会更加光明。"
风格：迪士尼风格的动画，鲜艳的色彩，梦幻般的灯光。`,
    '一个美丽的日出场景，阳光从山峰后缓缓升起，云朵轻柔地飘动',
    '一个森林中的场景，树叶在微风中轻轻摇摆，阳光斑驳',
    '一个海边场景，海浪轻拍岸边，海鸟在空中盘旋',
    '一个花园场景，花朵在微风中轻摆，蝴蝶翩翩起舞',
    '一个雨后场景，水滴从树叶上缓缓滴落，彩虹出现在天空',
    '一个雪花飘落的冬日场景，雪花轻柔地降落',
    '一个星空场景，星星闪烁，云朵缓缓飘过月亮',
    '一个溪流场景，清水在石头间潺潺流淌，鱼儿游过'
  ],
  en: [
    `Scene: A grand castle courtyard at sunset, golden light filtering through stained glass windows, creating a warm and hopeful atmosphere.
Camera: Medium close-up tracking shot of the two princesses, then a wide-angle pull-out to reveal the entire courtyard, ending with a slow upward tilt to the sky.
Action: The princesses smile at each other, then begin singing in harmony, then raise their hands toward the sky as the light brightens.
Audio: Soft orchestral music with uplifting strings and choir, ambient sounds of rustling leaves and distant birds, dialogue: "Together, we believe tomorrow will be brighter."
Style: Disney-style animation, vibrant colors, dreamy lighting.`,
    'a beautiful sunrise scene where the sun slowly rises from behind mountains with clouds gently floating',
    'a forest scene with leaves gently swaying in the breeze and dappled sunlight',
    'a seaside scene with waves gently lapping the shore and seagulls circling overhead',
    'a garden scene with flowers swaying in the breeze and butterflies dancing',
    'a post-rain scene with water drops slowly dripping from leaves and a rainbow appearing in the sky',
    'a winter scene with snowflakes gently falling',
    'a starry night scene with twinkling stars and clouds slowly drifting across the moon',
    'a stream scene with clear water flowing gently between stones and fish swimming by'
  ]
} as const;

// AI 音频默认提示词
export const AI_AUDIO_PROMPTS = {
  zh: [
    '创作一段温柔治愈的钢琴纯音乐，节奏舒缓，适合作为夜晚阅读的背景音乐',
    '生成一首轻快的城市流行歌曲，带有明亮节拍和朗朗上口的副歌',
    '写一段梦幻电子氛围音乐，层次逐渐推进，适合作为产品宣传片配乐',
    '创作一首民谣风格歌曲，木吉他主导，歌词关于旅行与自由',
    '生成一段电影预告片风格配乐，从低沉铺垫逐步推向高潮',
    '制作一段 Lo-fi 学习音乐，带黑胶噪点和慵懒鼓点',
  ],
  en: [
    'Compose a soft healing piano instrumental with a slow tempo for late-night reading.',
    'Generate an upbeat city pop song with bright rhythm and a catchy chorus.',
    'Create dreamy electronic ambient music with layered progression for a product promo.',
    'Write a folk-style song led by acoustic guitar about travel and freedom.',
    'Generate a cinematic trailer soundtrack that builds from tension to a strong climax.',
    'Create a lo-fi study track with vinyl noise and laid-back drums.',
  ],
} as const;

// AI 文本默认提示词
export const AI_TEXT_PROMPTS = {
  zh: [
    '写一篇结构清晰的文章，解释这个主题的核心概念、背景和实际应用。',
    '把下面的信息整理成一份条理清晰的总结，并提炼 5 个关键结论。',
    '根据这个主题生成一份可直接演讲的 Markdown 大纲，包含标题、要点和结尾。',
    '把这些零散想法扩展成一段完整文案，语气专业但易懂。',
    '将这段内容改写得更简洁、更有说服力，适合对外发布。',
    '基于这个主题输出一份问答列表，覆盖常见问题与对应答案。',
  ],
  en: [
    'Write a well-structured article explaining the core concept, background, and practical uses of this topic.',
    'Turn the information below into a clear summary and extract 5 key takeaways.',
    'Create a presentation-ready Markdown outline with a title, talking points, and a closing section.',
    'Expand these rough ideas into a complete piece of copy with a professional but accessible tone.',
    'Rewrite this content to be more concise and persuasive for external publishing.',
    'Generate a Q&A list for this topic that covers the most common questions and answers.',
  ],
} as const;

// AI Agent 默认提示词
export const AI_AGENT_PROMPTS = {
  zh: [
    '把这个主题拆解成一个可执行的任务计划，并按优先级列出下一步行动。',
    '围绕这个主题生成一份结构清晰的思维导图，突出层级关系和关键节点。',
    '把这段内容转换成流程图方案，明确步骤、判断节点和输出结果。',
    '基于这个主题整理一份 PPT 大纲，包含封面、目录、核心页面和结论。',
    '围绕这个方向做一轮创意发散，给出 10 个不同角度的方案或灵感点。',
    '分析这个问题的成因、影响和解决路径，并给出推荐方案。',
  ],
  en: [
    'Break this topic into an actionable task plan and list the next steps by priority.',
    'Generate a clear mind map for this topic with strong hierarchy and key branches.',
    'Turn this content into a flowchart outline with steps, decision points, and outputs.',
    'Create a PPT outline for this topic including cover, agenda, key slides, and conclusion.',
    'Run a creative ideation pass and provide 10 different directions or inspiration angles.',
    'Analyze the causes, impact, and solution paths for this problem and recommend an approach.',
  ],
} as const;

// AI 指令项接口 - 用于 AI 输入框的指令建议
export interface InstructionItemData {
  content: string;
  scene: string;  // 适用场景描述
  tips?: string;
}

// AI 指令 - 用于文本模型工作流（AI 输入框使用）
export const AI_INSTRUCTIONS: Record<'zh' | 'en', InstructionItemData[]> = {
  zh: [
    // {
    //   content: '将选中的内容整理成思维导图',
    //   scene: '知识梳理、内容结构化、学习笔记'
    // },
    // {
    //   content: '为选中的主题详细的分析框架',
    //   scene: '项目分析、问题拆解、决策支持'
    // },
    // {
    //   content: '将文本内容转换为流程图',
    //   scene: '流程可视化、步骤说明、操作指南'
    // },
    // {
    //   content: '为这个概念相关的扩展内容',
    //   scene: '头脑风暴、创意发散、内容扩展'
    // },
    // {
    //   content: '总结并提炼关键要点',
    //   scene: '内容摘要、报告总结、快速了解'
    // },
    // {
    //   content: '分析这些内容之间的关联关系',
    //   scene: '关系分析、逻辑梳理、知识图谱'
    // },
    // {
    //   content: '为当前内容行动计划',
    //   scene: '任务规划、项目管理、执行方案'
    // },
    // {
    //   content: '对比分析这些选项的优缺点',
    //   scene: '方案对比、决策分析、选型评估'
    // },
    // {
    //   content: '一张与主题相关的配图',
    //   scene: '视觉辅助、内容配图、演示美化'
    // },
    {
      content: '优化提示词并生成',
      scene: '提示词',
      tips: '在生成图片/视频前先调一次文本模型对提示词进行优化'
    },
    {
      content: '生成该角色无背景的各种表情16宫格图',
      scene: '宫格图',
      tips: '调用1次文本模型 + 1次生图模型，一张图排布n张正方形子图（最多16张）'
    }
  ],
  en: [
    // {
    //   content: 'Organize the selected content into a mind map',
    //   scene: 'Knowledge organization, content structuring, study notes'
    // },
    // {
    //   content: 'a detailed analysis framework for the selected topic',
    //   scene: 'Project analysis, problem breakdown, decision support'
    // },
    // {
    //   content: 'Convert the text content into a flowchart',
    //   scene: 'Process visualization, step explanation, operation guide'
    // },
    // {
    //   content: 'related extended content for this concept',
    //   scene: 'Brainstorming, creative expansion, content extension'
    // },
    // {
    //   content: 'Summarize and extract key points',
    //   scene: 'Content summary, report summary, quick overview'
    // },
    // {
    //   content: 'Analyze the relationships between these contents',
    //   scene: 'Relationship analysis, logic organization, knowledge graph'
    // },
    // {
    //   content: 'an action plan for the current content',
    //   scene: 'Task planning, project management, execution plan'
    // },
    // {
    //   content: 'Compare and analyze the pros and cons of these options',
    //   scene: 'Solution comparison, decision analysis, selection evaluation'
    // },
    // {
    //   content: 'an image related to the topic',
    //   scene: 'Visual aid, content illustration, presentation enhancement'
    // },
    {
      content: 'Optimize prompt and generate',
      scene: 'Optimization',
      tips: 'Prompt optimization, Quality improvement, Prompt polishing'
    }
  ]
};

// 冷启动引导提示词 - 用于引导新用户开始使用
export interface ColdStartSuggestion {
  content: string;
  scene: string;
  /** 模型调用说明，介绍该命令会用到的模型概况 */
  tips: string;
  /** 生成类型：image(直接生图)、video(直接生视频)、agent(需要Agent分析) */
  modelType?: 'image' | 'video' | 'text' | 'agent';
}

export const AI_COLD_START_SUGGESTIONS: Record<'zh' | 'en', ColdStartSuggestion[]> = {
  zh: [
    {
      content: '灵感图：咖啡文化，16图',
      scene: '灵感图',
      tips: '调用1次文本模型 + 1次生图模型，一张图排布n张子图（最多16张）',
      modelType: 'agent',
    },
    {
      content: '宫格图：可爱猫咪表情包，16宫格',
      scene: '宫格图',
      tips: '调用1次文本模型 + 1次生图模型，一张图排布n张正方形子图（最多16张）',
      modelType: 'agent',
    },
    {
      content: '创作一个视频：樱花树下的少女，微风吹过，花瓣飘落',
      scene: '视频创作',
      tips: '调用1次文本模型 + 1次生视频模型',
      modelType: 'video',
    },
    // {
    //   content: '长视频：一只猫咪从早到晚的一天生活，1分钟',
    //   scene: '长视频',
    //   tips: '调用1次文本模型生成分段脚本 + 多次生视频模型，尾帧接首帧保证连贯',
    //   modelType: 'agent',
    // },
    {
      content: '画一个AI工作流的流程图',
      scene: 'mermaid图',
      tips: '调用1次文本模型，支持流程图、泳道图、',
      modelType: 'agent',
    },
    {
      content: '大模型发展趋势的思维导图',
      scene: '知识梳理',
      tips: '调用1次文本模型',
      modelType: 'agent',
    },
    {
      content: '矢量图：一个简约风格的火箭作为公司logo',
      scene: 'SVG矢量图',
      tips: '调用1次文本模型生成SVG图标，可无损缩放',
      modelType: 'agent',
    },
    {
      content: '生成一份关于人工智能发展的PPT',
      scene: '生成PPT大纲',
      tips: '调用1次文本模型生成大纲 + 自动布局为多页PPT幻灯片',
      modelType: 'agent',
    }
  ],
  en: [
    {
      content: 'inspiration board: Coffee culture mood board, beans, latte art, cafe scenes',
      scene: 'Inspiration board',
      tips: '1 text model + 1 image model',
      modelType: 'agent',
    },
    {
      content: 'grid image: Cute cat emoji pack, 4x4 scattered layout',
      scene: 'Grid image',
      tips: '1 text model + 1 image model',
      modelType: 'agent',
    },
    {
      content: 'a video: A girl under cherry blossom tree, petals falling in the breeze',
      scene: 'Video creation',
      tips: '1 text model + 1 video model',
      modelType: 'video',
    },
    // {
    //   content: 'long video: A day in the life of a cat, 1 minute',
    //   scene: 'Long video',
    //   tips: '1 text model for script + multiple video models, last frame connects to first frame',
    //   modelType: 'agent',
    // },
    {
      content: 'Draw a flowchart of AI workflow',
      scene: 'Tech docs',
      tips: '1 text model',
      modelType: 'agent',
    },
    {
      content: 'Draw a mind map of LLM development trends',
      scene: 'Knowledge organization',
      tips: '1 text model',
      modelType: 'agent',
    },
    {
      content: 'SVG: A minimalist rocket icon',
      scene: 'SVG vector',
      tips: '1 text model to generate SVG code, scalable and lossless',
      modelType: 'agent',
    },
    {
      content: 'Generate a PPT about artificial intelligence development',
      scene: 'PPT slides',
      tips: '1 text model for outline + auto layout into multi-page PPT slides',
      modelType: 'agent',
    },
  ],
};

// 类型定义
export type Language = 'zh' | 'en';
export type PromptGenerationType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'agent'
  | 'ppt-common';
export type PromptPreviewExample =
  | {
      kind: 'image';
      src: string;
      alt: string;
    }
  | {
      kind: 'video';
      src: string;
      alt: string;
      posterSrc?: string;
      playable?: boolean;
    };

type PromptPreviewExampleSet = readonly PromptPreviewExample[];

const createPromptPreviewExample = (
  generationType: PromptGenerationType,
  index: number,
  alt: string
): PromptPreviewExample => ({
  kind: 'image',
  src: `/prompt-examples/${generationType}/${String(index + 1).padStart(2, '0')}.png`,
  alt,
});

const createVideoPromptPreviewExample = (
  index: number,
  alt: string
): PromptPreviewExample => ({
  kind: 'video',
  src: `/prompt-examples/video/${String(index + 1).padStart(2, '0')}.mp4`,
  posterSrc: `/prompt-examples/video/${String(index + 1).padStart(2, '0')}.png`,
  playable: true,
  alt,
});

const createPromptPreviewExampleSets = (
  generationType: PromptGenerationType,
  alts: readonly string[]
): readonly PromptPreviewExampleSet[] =>
  alts.map((alt, index) => [
    createPromptPreviewExample(generationType, index, alt),
  ]);

const createVideoPromptPreviewExampleSets = (
  alts: readonly string[]
): readonly PromptPreviewExampleSet[] =>
  alts.map((alt, index) => [
    createVideoPromptPreviewExample(index, alt),
  ]);

const normalizePromptLanguage = (language: Language): Language =>
  language === 'en' ? 'en' : 'zh';

export const DEFAULT_PROMPT_PREVIEW_EXAMPLE_SETS: Record<
  PromptGenerationType,
  readonly PromptPreviewExampleSet[]
> = {
  image: createPromptPreviewExampleSets('image', [
    'Hotel lobby portrait preview',
    'Kitten on windowsill preview',
    'Mountain landscape preview',
    'Minimalist interior preview',
    'Neon city skyline preview',
    'Cherry blossom preview',
    'Space station preview',
    'Cozy cafe preview',
    'Abstract geometry preview',
  ]),
  video: createVideoPromptPreviewExampleSets([
    'Castle courtyard video preview',
    'Sunrise video preview',
    'Forest video preview',
    'Seaside video preview',
    'Garden video preview',
    'Rainbow after rain video preview',
    'Winter snow video preview',
    'Moonlit sky video preview',
    'Mountain stream video preview',
  ]),
  audio: createPromptPreviewExampleSets('audio', [
    'Soft piano cover preview',
    'City pop cover preview',
    'Electronic ambient cover preview',
    'Folk travel cover preview',
    'Trailer soundtrack cover preview',
    'Lo-fi study cover preview',
  ]),
  text: createPromptPreviewExampleSets('text', [
    'Article layout preview',
    'Summary card preview',
    'Markdown outline preview',
    'Expanded copy preview',
    'Publishing rewrite preview',
    'Q and A layout preview',
  ]),
  agent: createPromptPreviewExampleSets('agent', [
    'Task planning board preview',
    'Mind map preview',
    'Flowchart preview',
    'Presentation outline preview',
    'Creative ideation board preview',
    'Problem analysis dashboard preview',
  ]),
  'ppt-common': [],
} as const;

// 获取图片提示词的辅助函数
export const getImagePrompts = (language: Language): readonly string[] => {
  return AI_IMAGE_PROMPTS[normalizePromptLanguage(language)];
};

// 获取视频提示词的辅助函数
export const getVideoPrompts = (language: Language): readonly string[] => {
  return AI_VIDEO_PROMPTS[normalizePromptLanguage(language)];
};

// 获取音频提示词的辅助函数
export const getAudioPrompts = (language: Language): readonly string[] => {
  return AI_AUDIO_PROMPTS[normalizePromptLanguage(language)];
};

// 获取文本提示词的辅助函数
export const getTextPrompts = (language: Language): readonly string[] => {
  return AI_TEXT_PROMPTS[normalizePromptLanguage(language)];
};

// 获取 Agent 提示词的辅助函数
export const getAgentPrompts = (language: Language): readonly string[] => {
  return AI_AGENT_PROMPTS[normalizePromptLanguage(language)];
};

// 获取指定生成类型默认提示词的辅助函数
export const getDefaultPromptsByGenerationType = (
  generationType: PromptGenerationType,
  language: Language
): readonly string[] => {
  switch (generationType) {
    case 'image':
      return getImagePrompts(language);
    case 'video':
      return getVideoPrompts(language);
    case 'audio':
      return getAudioPrompts(language);
    case 'text':
      return getTextPrompts(language);
    case 'agent':
      return getAgentPrompts(language);
    case 'ppt-common':
      return [];
    default:
      return [];
  }
};

export const getDefaultPromptPreviewExamples = (
  generationType: PromptGenerationType,
  language: Language,
  promptContent: string
): readonly PromptPreviewExample[] => {
  const defaultPrompts = getDefaultPromptsByGenerationType(generationType, language);
  const promptIndex = defaultPrompts.findIndex((prompt) => prompt === promptContent);

  if (promptIndex < 0) {
    return [];
  }

  return DEFAULT_PROMPT_PREVIEW_EXAMPLE_SETS[generationType]?.[promptIndex] || [];
};

// 获取 AI 指令的辅助函数
export const getInstructions = (language: Language): InstructionItemData[] => {
  return AI_INSTRUCTIONS[language];
};

// 获取冷启动引导提示词的辅助函数
export const getColdStartSuggestions = (language: Language): ColdStartSuggestion[] => {
  return AI_COLD_START_SUGGESTIONS[language];
};
