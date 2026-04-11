import type { VideoShot } from './types';
import { createModelRef, type ModelRef } from '../../utils/settings-manager';

/** 去除字符串末尾的中英文句号 */
function trimTrailingPeriod(s: string): string {
  return s.replace(/[。.]+$/, '');
}

/** 将镜头的多个字段融合为完整的视频生成 prompt */
export function buildVideoPrompt(shot: VideoShot): string {
  const parts: string[] = [];
  if (shot.description) parts.push(trimTrailingPeriod(shot.description));
  if (shot.camera_movement) parts.push(`运镜方式：${trimTrailingPeriod(shot.camera_movement)}`);
  if (shot.video_prompt && shot.video_prompt !== shot.description) {
    parts.push(trimTrailingPeriod(shot.video_prompt));
  }
  if (shot.end_frame_description) parts.push(`结尾画面：${trimTrailingPeriod(shot.end_frame_description)}`);
  return parts.join('。') || shot.visual_prompt || '';
}

export function readStoredModelSelection(
  key: string,
  fallbackModel: string
): { modelId: string; modelRef: ModelRef | null } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { modelId: fallbackModel, modelRef: null };
    }

    const parsed = JSON.parse(raw) as {
      modelId?: string;
      profileId?: string | null;
    };

    if (typeof parsed.modelId === 'string' && parsed.modelId.trim()) {
      return {
        modelId: parsed.modelId.trim(),
        modelRef: createModelRef(parsed.profileId || null, parsed.modelId),
      };
    }
  } catch {
    // 兼容旧格式：直接存储 modelId 字符串
  }

  return {
    modelId: localStorage.getItem(key) || fallbackModel,
    modelRef: null,
  };
}

export function writeStoredModelSelection(
  key: string,
  modelId: string,
  modelRef?: ModelRef | null
): void {
  localStorage.setItem(
    key,
    JSON.stringify({
      modelId,
      profileId: modelRef?.profileId || null,
    })
  );
}
