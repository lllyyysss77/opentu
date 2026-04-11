/**
 * 素材生成页 - 参考图 + 模型选择 + 批量图片/视频生成
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { AnalysisRecord, VideoShot } from '../types';
import { aspectRatioToVideoSize } from '../types';
import { getVideoModelConfig } from '../../../constants/video-model-config';
import { mcpRegistry } from '../../../mcp/registry';
import { updateRecord } from '../storage';
import { ShotCard } from '../components/ShotCard';
import { buildVideoPrompt } from '../utils';
import { ReferenceImageUpload } from '../../ttd-dialog/shared';
import type { ReferenceImage } from '../../ttd-dialog/shared';
import { ModelDropdown } from '../../ai-input-bar/ModelDropdown';
import { useSelectableModels } from '../../../hooks/use-runtime-models';

interface GeneratePageProps {
  record: AnalysisRecord;
  onRecordUpdate: (record: AnalysisRecord) => void;
  onRecordsChange: (records: AnalysisRecord[]) => void;
}

export const GeneratePage: React.FC<GeneratePageProps> = ({
  record,
  onRecordUpdate,
  onRecordsChange,
}) => {
  const shots = record.editedShots || record.analysis.shots;
  const aspectRatio = record.analysis.aspect_ratio || '16x9';
  const batchId = record.batchId || `va_${record.id}`;

  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const imageModels = useSelectableModels('image');
  const videoModels = useSelectableModels('video');
  const [imageModel, setImageModel] = useState('');
  const [videoModel, setVideoModelState] = useState(
    () => record.productInfo?.videoModel || 'veo3'
  );
  const [segmentDuration, setSegmentDuration] = useState<number>(
    () => record.productInfo?.segmentDuration || parseInt(getVideoModelConfig(record.productInfo?.videoModel || 'veo3').defaultDuration, 10) || 8
  );

  // 视频模型时长选项
  const durationOptions = useMemo(() => {
    return getVideoModelConfig(videoModel).durationOptions;
  }, [videoModel]);

  const setVideoModel = useCallback((model: string) => {
    setVideoModelState(model);
    const cfg = getVideoModelConfig(model);
    setSegmentDuration(parseInt(cfg.defaultDuration, 10) || 8);
  }, []);

  // 参考图 URL 列表（用于传给生成接口）
  const refImageUrls = useMemo(() => refImages.map(img => img.url).filter(Boolean), [refImages]);

  // 确保 batchId 已保存
  const ensureBatchId = useCallback(async () => {
    if (!record.batchId) {
      const updated = await updateRecord(record.id, { batchId });
      onRecordsChange(updated);
      onRecordUpdate({ ...record, batchId });
    }
  }, [record, batchId, onRecordUpdate, onRecordsChange]);

  // 单镜头生成图片
  const handleShotGenerateImage = useCallback(async (shot: VideoShot) => {
    if (!shot.visual_prompt) return;
    await ensureBatchId();
    await mcpRegistry.executeTool(
      { name: 'generate_image', arguments: {
        prompt: shot.visual_prompt, count: 1, size: aspectRatio,
        referenceImages: refImageUrls.length > 0 ? refImageUrls : undefined,
        batchId,
        ...(imageModel ? { model: imageModel } : {}),
      }},
      { mode: 'queue' }
    );
  }, [aspectRatio, refImageUrls, batchId, ensureBatchId, imageModel]);

  // 单镜头生成视频
  const handleShotGenerateVideo = useCallback(async (shot: VideoShot) => {
    const prompt = buildVideoPrompt(shot);
    if (!prompt) return;
    await ensureBatchId();
    const size = aspectRatioToVideoSize(aspectRatio);
    const seconds = String(segmentDuration);
    await mcpRegistry.executeTool(
      { name: 'generate_video', arguments: {
        prompt, size, seconds, count: 1, batchId, model: videoModel,
        referenceImages: refImageUrls.length > 0 ? refImageUrls : undefined,
      }},
      { mode: 'queue' }
    );
  }, [aspectRatio, batchId, videoModel, ensureBatchId, segmentDuration, refImageUrls]);

  // 批量生成
  const handleGenerateAllImages = useCallback(async () => {
    await ensureBatchId();
    for (const shot of shots.filter(s => s.visual_prompt)) {
      await mcpRegistry.executeTool(
        { name: 'generate_image', arguments: {
          prompt: shot.visual_prompt, count: 1, size: aspectRatio,
          referenceImages: refImageUrls.length > 0 ? refImageUrls : undefined,
          batchId,
          ...(imageModel ? { model: imageModel } : {}),
        }},
        { mode: 'queue' }
      );
    }
  }, [shots, aspectRatio, refImageUrls, batchId, ensureBatchId, imageModel]);

  const handleGenerateAllVideos = useCallback(async () => {
    await ensureBatchId();
    const size = aspectRatioToVideoSize(aspectRatio);
    const seconds = String(segmentDuration);
    for (const shot of shots) {
      const prompt = buildVideoPrompt(shot);
      if (!prompt) continue;
      await mcpRegistry.executeTool(
        { name: 'generate_video', arguments: {
          prompt, size, seconds, count: 1, batchId, model: videoModel,
          referenceImages: refImageUrls.length > 0 ? refImageUrls : undefined,
        }},
        { mode: 'queue' }
      );
    }
  }, [shots, aspectRatio, batchId, videoModel, ensureBatchId, segmentDuration, refImageUrls]);

  return (
    <div className="va-page">
      {/* 参考图 */}
      <ReferenceImageUpload
        images={refImages}
        onImagesChange={setRefImages}
        multiple
        label="参考图 (可选)"
      />

      {/* 模型选择 */}
      <div className="va-product-form">
        <div className="va-model-select">
          <label className="va-model-label">图片模型</label>
          <ModelDropdown
            variant="form"
            selectedModel={imageModel}
            onSelect={setImageModel}
            models={imageModels}
            placement="down"
            placeholder="选择图片模型"
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
            placeholder="选择视频模型"
          />
          <div className="va-segment-duration-select">
            <label className="va-model-label">单段</label>
            <select
              className="va-form-select"
              value={String(segmentDuration)}
              onChange={e => setSegmentDuration(parseInt(e.target.value, 10))}
              disabled={durationOptions.length <= 1}
            >
              {durationOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 镜头列表 */}
      <div className="va-shots">
        {shots.map((shot, i) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            index={i}
            actions={
              <>
                {shot.visual_prompt && (
                  <button onClick={() => handleShotGenerateImage(shot)}>生成图片</button>
                )}
                {(shot.description || shot.video_prompt || shot.visual_prompt) && (
                  <button onClick={() => handleShotGenerateVideo(shot)}>生成视频</button>
                )}
              </>
            }
          />
        ))}
      </div>

      {/* 批量操作 */}
      <div className="va-page-actions">
        <button onClick={handleGenerateAllImages}>全部→生成图片</button>
        <button onClick={handleGenerateAllVideos}>全部→生成视频</button>
      </div>
    </div>
  );
};
