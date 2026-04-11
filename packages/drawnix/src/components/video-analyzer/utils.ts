import type { VideoShot } from './types';

/** 将镜头的多个字段融合为完整的视频生成 prompt */
export function buildVideoPrompt(shot: VideoShot): string {
  const parts: string[] = [];
  if (shot.description) parts.push(shot.description);
  if (shot.camera_movement) parts.push(`运镜方式：${shot.camera_movement}`);
  if (shot.video_prompt && shot.video_prompt !== shot.description) {
    parts.push(shot.video_prompt);
  }
  if (shot.end_frame_description) parts.push(`结尾画面：${shot.end_frame_description}`);
  return parts.join('。') || shot.visual_prompt || '';
}
