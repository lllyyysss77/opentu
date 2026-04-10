/**
 * 脚本编辑页 - 商品信息 + AI 改编 + 镜头脚本编辑
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { AnalysisRecord, ProductInfo, VideoShot } from '../types';
import { formatShotsMarkdown } from '../types';
import { quickInsert } from '../../../mcp/tools/canvas-insertion';
import { sendChatWithGemini } from '../../../utils/gemini-api/services';
import type { GeminiMessage } from '../../../utils/gemini-api/types';
import { updateRecord } from '../storage';
import { ShotCard } from '../components/ShotCard';
import { ComboInput } from '../components/ComboInput';
import { ModelDropdown } from '../../ai-input-bar/ModelDropdown';
import { useSelectableModels } from '../../../hooks/use-runtime-models';
import { VIDEO_MODEL_CONFIGS } from '../../../constants/video-model-config';
import type { VideoModel } from '../../../types/video.types';
import { computeSegmentPlan, type SegmentPlan } from '../../../utils/segment-plan';
import { getVideoModelConfig } from '../../../constants/video-model-config';

const STORAGE_KEY_SCRIPT_MODEL = 'video-analyzer:script-model';
const STORAGE_KEY_VIDEO_MODEL = 'video-analyzer:video-model';
const DEFAULT_SCRIPT_MODEL = 'gemini-2.5-flash';
const DEFAULT_VIDEO_MODEL = 'veo3';

const CAMERA_MOVEMENT_OPTIONS = [
  '固定镜头 (Static)',
  '缓慢推近 (Dolly In)',
  '缓慢拉远 (Dolly Out)',
  '水平平移 (Pan)',
  '垂直摇移 (Tilt)',
  '跟随拍摄 (Follow)',
  '手持感 (Handheld)',
  '环绕拍摄 (Orbit)',
  '升降镜头 (Crane)',
  '快速推移 (Zoom In)',
  '快速拉远 (Zoom Out)',
  '滑轨移动 (Slider)',
  '航拍俯冲 (Drone Dive)',
  '第一人称 (POV)',
];

interface ScriptPageProps {
  record: AnalysisRecord;
  onRecordUpdate: (record: AnalysisRecord) => void;
  onRecordsChange: (records: AnalysisRecord[]) => void;
  onNext?: () => void;
}

export const ScriptPage: React.FC<ScriptPageProps> = ({
  record,
  onRecordUpdate,
  onRecordsChange,
  onNext,
}) => {
  const [productInfo, setProductInfo] = useState<ProductInfo>(
    record.productInfo || { name: '', category: '', sellingPoints: '', targetDuration: record.analysis.totalDuration }
  );
  const [shots, setShots] = useState<VideoShot[]>(
    record.editedShots || [...record.analysis.shots]
  );
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState('');
  const [scriptModel, setScriptModelState] = useState(
    () => localStorage.getItem(STORAGE_KEY_SCRIPT_MODEL) || DEFAULT_SCRIPT_MODEL
  );
  const setScriptModel = useCallback((model: string) => {
    setScriptModelState(model);
    localStorage.setItem(STORAGE_KEY_SCRIPT_MODEL, model);
  }, []);
  const textModels = useSelectableModels('text');
  const videoModels = useSelectableModels('video');
  const [videoModel, setVideoModelState] = useState(
    () => record.productInfo?.videoModel || localStorage.getItem(STORAGE_KEY_VIDEO_MODEL) || DEFAULT_VIDEO_MODEL
  );
  const setVideoModel = useCallback((model: string) => {
    setVideoModelState(model);
    localStorage.setItem(STORAGE_KEY_VIDEO_MODEL, model);
    setProductInfo(p => ({ ...p, videoModel: model }));
  }, []);

  // 获取视频模型的最大单段时长
  const maxSegmentDuration = useMemo(() => {
    const cfg = VIDEO_MODEL_CONFIGS[videoModel as VideoModel];
    if (!cfg) return 10;
    const durations = cfg.durationOptions.map(o => parseInt(o.value, 10)).filter(n => !isNaN(n));
    return durations.length > 0 ? Math.max(...durations) : parseInt(cfg.defaultDuration, 10) || 10;
  }, [videoModel]);

  // 分段计划（智能适配固定/可变时长模型）
  const segmentPlan = useMemo((): SegmentPlan => {
    const cfg = getVideoModelConfig(videoModel);
    const targetDur = productInfo.targetDuration || record.analysis.totalDuration;
    return computeSegmentPlan(targetDur, cfg.durationOptions);
  }, [videoModel, productInfo.targetDuration, record.analysis.totalDuration]);

  // 表单变化时自动保存到 IndexedDB（防抖 500ms）
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const updated = await updateRecord(record.id, { productInfo });
      onRecordsChange(updated);
      onRecordUpdate({ ...record, productInfo });
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [productInfo]); // 只依赖 productInfo，避免循环

  const saveShots = useCallback(async (newShots: VideoShot[]) => {
    setShots(newShots);
    const updated = await updateRecord(record.id, { editedShots: newShots, productInfo });
    onRecordsChange(updated);
    onRecordUpdate({ ...record, editedShots: newShots, productInfo });
  }, [record, productInfo, onRecordUpdate, onRecordsChange]);

  const handleShotFieldChange = useCallback((shotId: string, field: keyof VideoShot, value: string) => {
    const newShots = shots.map(s => s.id === shotId ? { ...s, [field]: value } : s);
    saveShots(newShots);
  }, [shots, saveShots]);

  const handleRewrite = useCallback(async () => {
    if (!productInfo.name && !productInfo.category) {
      setError('请至少填写商品名称或品类');
      return;
    }
    setRewriting(true);
    setError('');
    try {
      const originalShots = JSON.stringify(record.analysis.shots.map(s => ({
        id: s.id, label: s.label, type: s.type,
        startTime: s.startTime, endTime: s.endTime, duration: s.duration,
        description: s.description, script: s.script,
        visual_prompt: s.visual_prompt, video_prompt: s.video_prompt,
        camera_movement: s.camera_movement,
      })));

      const targetDur = productInfo.targetDuration || record.analysis.totalDuration;
      const { segments, actualTotal, isFixed, overflow } = segmentPlan;
      const segmentCount = segments.length;

      const durationInfo = isFixed
        ? `当前视频模型（${videoModel}）为固定时长模型，每段固定 ${segments[0]} 秒。
实际可用视频总时长：${actualTotal} 秒（${segmentCount} 段 × ${segments[0]} 秒/段）${overflow > 0 ? `，比目标 ${targetDur} 秒多出 ${overflow} 秒` : ''}。
请按 ${actualTotal} 秒总时长分配内容节奏。`
        : `目标视频总时长：${targetDur} 秒。
分段方案：${segments.map((d, i) => `第${i + 1}段 ${d}s`).join('、')}，实际总时长 ${actualTotal} 秒。
每个镜头的 duration 必须等于对应段的可用时长。`;

      const prompt = `你是一个短视频脚本改编专家。请基于以下原始视频脚本，为新商品改编脚本。

原始视频信息：
- 总时长：${record.analysis.totalDuration}秒
- 风格：${record.analysis.video_style || '未知'}
- BGM 情绪：${record.analysis.bgm_mood || '未知'}
- 画面比例：${record.analysis.aspect_ratio || '16x9'}

原始镜头脚本：
${originalShots}

新商品信息：
- 品类：${productInfo.category || '未指定'}
- 商品名称：${productInfo.name || '未指定'}
- 核心卖点：${productInfo.sellingPoints || '未指定'}

视频生成约束：
- 使用的视频模型：${videoModel}
- ${durationInfo}
- 需要 ${segmentCount} 个视频片段拼接成完整视频

改编要求：
1. **description（画面描述）**：将画面中的原商品替换为新商品"${productInfo.name || '新商品'}"，场景和构图保持类似风格，但主体、文字、道具等要匹配新商品
2. **script（口播文案）**：以主角第一人称口述的方式撰写，语气自然、有感染力，像真人在镜头前说话，内容围绕新商品的卖点展开
3. **visual_prompt（图片提示词）**：英文，替换主体为新商品，保持原始画面风格
4. **video_prompt（视频提示词）**：英文，替换主体为新商品，保持原始运镜和动态风格
5. **camera_movement（运镜方式）**：根据新内容适当调整

拼接衔接要求（极其重要！）：
1. 视觉锚点：相邻镜头之间必须有一个共同的视觉元素（同一商品、同一场景、同一手部动作），确保画面连贯
2. 运镜方向延续：如果一个镜头结尾是向右平移(pan right)，下一个镜头开头应继续向右或保持静止，不能突然反向
3. 色调一致性：所有镜头统一使用相同的色调和光线风格
4. 动作连贯：如果一个镜头结尾主体正在做某个动作，下一个镜头开头要延续这个动作

每个镜头的额外输出字段：
- **transition_hint**：到下一个镜头的转场方式，从 'cut'(硬切)、'dissolve'(交叉溶解)、'match_cut'(匹配切)、'fade_to_black'(淡出到黑) 中选择。同场景内推荐 'cut'，跨场景推荐 'dissolve'，最后一个镜头设为 'fade_to_black'
- **end_frame_description**：本镜头结尾画面的精确描述（英文），具体描述主体位置、动作状态、背景元素

返回一个 JSON 数组，每个元素包含：id、startTime、endTime、duration、description、script、visual_prompt、video_prompt、camera_movement、label、type、transition_hint、end_frame_description 字段。
只返回 JSON 数组，不要 markdown 格式。`;

      const messages: GeminiMessage[] = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
      const response = await sendChatWithGemini(messages, undefined, undefined, scriptModel);
      const text = response.choices?.[0]?.message?.content;
      if (!text) throw new Error('AI 未返回有效响应');

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('响应中未找到有效 JSON');

      const updates = JSON.parse(jsonMatch[0]) as Array<Partial<VideoShot> & { id: string }>;
      // AI 可能返回全新的镜头列表（增减镜头），或基于原 id 更新
      let newShots: VideoShot[];
      if (updates.length > 0 && updates[0].startTime !== undefined) {
        // AI 返回了完整的镜头列表（含时间分配），直接使用
        newShots = updates.map((u, i) => ({
          ...shots.find(s => s.id === u.id) || shots[i] || {},
          ...u,
          id: u.id || `shot_${i + 1}`,
        })) as VideoShot[];
      } else {
        // 仅部分字段更新，合并到现有 shots
        newShots = shots.map(shot => {
          const update = updates.find(u => u.id === shot.id);
          return update ? { ...shot, ...update } : shot;
        });
      }
      await saveShots(newShots);
    } catch (err: any) {
      setError(err.message || '改编失败');
    } finally {
      setRewriting(false);
    }
  }, [record, productInfo, shots, saveShots, segmentPlan, videoModel, scriptModel]);

  const handleInsertScripts = useCallback(async () => {
    await quickInsert('text', formatShotsMarkdown(shots, record.analysis, productInfo));
  }, [shots, productInfo, record]);

  return (
    <div className="va-page">
      {/* 商品信息 */}
      <div className="va-product-form">
        <div className="va-form-row">
          <input className="va-form-input" placeholder="商品名称" value={productInfo.name} onChange={e => setProductInfo(p => ({ ...p, name: e.target.value }))} />
          <input className="va-form-input" placeholder="品类" value={productInfo.category} onChange={e => setProductInfo(p => ({ ...p, category: e.target.value }))} />
        </div>
        <div className="va-form-row">
          <textarea className="va-form-textarea" placeholder="核心卖点..." rows={2} value={productInfo.sellingPoints} onChange={e => setProductInfo(p => ({ ...p, sellingPoints: e.target.value }))} style={{ flex: 1 }} />
          <div className="va-duration-input">
            <label className="va-edit-label">视频时长(秒)</label>
            <input className="va-form-input" type="number" min={5} max={300} value={productInfo.targetDuration ?? record.analysis.totalDuration} onChange={e => setProductInfo(p => ({ ...p, targetDuration: Number(e.target.value) || undefined }))} />
          </div>
        </div>
        <div className="va-model-select">
          <label className="va-model-label">改编模型</label>
          <ModelDropdown
            variant="form"
            selectedModel={scriptModel}
            onSelect={setScriptModel}
            models={textModels}
            placement="down"
            disabled={rewriting}
            placeholder="选择文本模型"
          />
        </div>
        <div className="va-model-select">
          <label className="va-model-label">视频模型</label>
          <ModelDropdown
            variant="form"
            selectedModel={videoModel}
            onSelect={setVideoModel}
            models={videoModels}
            placement="down"
            disabled={rewriting}
            placeholder="选择视频模型"
          />
          <span className="va-model-hint">单段≤{maxSegmentDuration}s</span>
          {segmentPlan.isFixed && segmentPlan.overflow > 0 && (
            <span className="va-duration-overflow">
              实际 {segmentPlan.actualTotal}s（+{segmentPlan.overflow}s）
            </span>
          )}
        </div>
        <button className="va-analyze-btn" onClick={handleRewrite} disabled={rewriting}>
          {rewriting ? 'AI 改编中...' : 'AI 改编脚本'}
        </button>
        {error && <div className="va-error">{error}</div>}
      </div>

      {/* 镜头脚本列表 */}
      <div className="va-shots">
        {shots.map((shot, i) => (
          <ShotCard key={shot.id} shot={shot} index={i} compact>
            <div className="va-edit-fields">
              <label className="va-edit-label">画面描述</label>
              <textarea className="va-edit-textarea" rows={2} value={shot.description || ''} onChange={e => handleShotFieldChange(shot.id, 'description', e.target.value)} />
              <label className="va-edit-label">文案</label>
              <textarea className="va-edit-textarea" rows={2} value={shot.script || ''} onChange={e => handleShotFieldChange(shot.id, 'script', e.target.value)} />
              <label className="va-edit-label">运镜方式</label>
              <ComboInput value={shot.camera_movement || ''} onChange={v => handleShotFieldChange(shot.id, 'camera_movement', v)} options={CAMERA_MOVEMENT_OPTIONS} placeholder="选择或输入运镜方式" />
              <label className="va-edit-label">图片 Prompt</label>
              <textarea className="va-edit-textarea" rows={2} value={shot.visual_prompt || ''} onChange={e => handleShotFieldChange(shot.id, 'visual_prompt', e.target.value)} />
              <label className="va-edit-label">视频 Prompt</label>
              <textarea className="va-edit-textarea" rows={2} value={shot.video_prompt || ''} onChange={e => handleShotFieldChange(shot.id, 'video_prompt', e.target.value)} />
              <label className="va-edit-label">转场方式</label>
              <ComboInput value={shot.transition_hint || ''} onChange={v => handleShotFieldChange(shot.id, 'transition_hint', v)} options={['cut', 'dissolve', 'match_cut', 'fade_to_black']} placeholder="选择转场方式" />
              <label className="va-edit-label">尾帧描述</label>
              <textarea className="va-edit-textarea" rows={2} value={shot.end_frame_description || ''} onChange={e => handleShotFieldChange(shot.id, 'end_frame_description', e.target.value)} placeholder="本镜头结尾画面的英文描述..." />
            </div>
          </ShotCard>
        ))}
      </div>

      <div className="va-page-actions">
        <button onClick={handleInsertScripts}>脚本→画布</button>
        {onNext && <button className="va-btn-primary" onClick={onNext}>下一步: 生成素材 →</button>}
      </div>
    </div>
  );
};
