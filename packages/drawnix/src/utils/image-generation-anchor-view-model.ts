import { RectangleClient } from '@plait/core';
import type { WorkflowMessageData } from '../types/chat.types';
import {
  TaskExecutionPhase,
  TaskStatus,
  TaskType,
  type Task,
} from '../types/task.types';
import type {
  ImageGenerationAnchorPhase,
  ImageGenerationAnchorViewModel,
  PlaitImageGenerationAnchor,
} from '../types/image-generation-anchor.types';
import { resolveImageTaskDisplayProgress } from './image-task-progress';

const PHASE_LABELS: Record<ImageGenerationAnchorPhase, string> = {
  submitted: '已提交',
  queued: '排队中',
  generating: '生成中',
  developing: '显影中',
  inserting: '插入中',
  completed: '已完成',
  failed: '失败',
};

const PHASE_SUBTITLES: Record<ImageGenerationAnchorPhase, string> = {
  submitted: '正在创建生成锚点',
  queued: '请求已受理，等待执行',
  generating: '图片正在生成，请稍候',
  developing: '结果已返回，正在准备显影',
  inserting: '正在放入画布',
  completed: '图片已稳定落位',
  failed: '生成失败，可从当前位置重试',
};

const clampProgress = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
};

export interface BuildImageGenerationAnchorViewModelOptions {
  anchor: PlaitImageGenerationAnchor;
  task?: Task | null;
  workflow?: WorkflowMessageData | null;
  postProcessingStatus?: WorkflowMessageData['postProcessingStatus'];
  isInserting?: boolean;
  hasInserted?: boolean;
  taskDisplayProgress?: number | null;
}

export function deriveImageGenerationAnchorPhase(
  options: BuildImageGenerationAnchorViewModelOptions
): ImageGenerationAnchorPhase {
  const { anchor, task, workflow, postProcessingStatus, isInserting, hasInserted } =
    options;

  if (task?.status === TaskStatus.FAILED || workflow?.status === 'failed') {
    return 'failed';
  }

  if (
    postProcessingStatus === 'failed' ||
    workflow?.postProcessingStatus === 'failed'
  ) {
    return 'failed';
  }

  if (hasInserted || workflow?.postProcessingStatus === 'completed') {
    return 'completed';
  }

  if (isInserting) {
    return 'inserting';
  }

  if (
    postProcessingStatus === 'processing' ||
    workflow?.postProcessingStatus === 'processing'
  ) {
    return 'developing';
  }

  if (task?.status === TaskStatus.COMPLETED || workflow?.status === 'completed') {
    return 'developing';
  }

  if (task?.status === TaskStatus.PROCESSING) {
    if (task.executionPhase === TaskExecutionPhase.SUBMITTING) {
      return 'queued';
    }

    return 'generating';
  }

  if (task?.status === TaskStatus.PENDING || workflow?.status === 'pending') {
    return 'submitted';
  }

  return anchor.phase;
}

export function buildImageGenerationAnchorViewModel(
  options: BuildImageGenerationAnchorViewModelOptions
): ImageGenerationAnchorViewModel {
  const { anchor, task, taskDisplayProgress, workflow } = options;
  const phase = deriveImageGenerationAnchorPhase(options);
  const rectangle = RectangleClient.getRectangleByPoints(anchor.points);
  const fallbackProgress = clampProgress(task?.progress ?? anchor.progress);
  const resolvedProgress =
    task?.type === TaskType.IMAGE &&
    task.status === TaskStatus.PROCESSING &&
    (phase === 'queued' || phase === 'generating')
      ? resolveImageTaskDisplayProgress({
          startedAt: task.startedAt,
          fallbackProgress,
        })
      : fallbackProgress;
  const progress = clampProgress(taskDisplayProgress ?? resolvedProgress);
  const subtitle =
    anchor.subtitle && anchor.phase === phase
      ? anchor.subtitle
      : PHASE_SUBTITLES[phase];

  const tone: ImageGenerationAnchorViewModel['tone'] =
    phase === 'failed'
      ? 'danger'
      : phase === 'completed'
      ? 'success'
      : phase === 'queued' || phase === 'developing'
      ? 'warning'
      : 'default';

  const progressMode: ImageGenerationAnchorViewModel['progressMode'] =
    phase === 'queued' || phase === 'generating'
      ? progress != null
        ? 'determinate'
        : 'indeterminate'
      : phase === 'submitted'
      ? 'indeterminate'
      : 'hidden';

  const primaryAction =
    phase === 'failed'
      ? { type: 'retry' as const, label: '重试' }
      : { type: 'details' as const, label: '详情' };

  const secondaryAction =
    phase === 'failed'
      ? { type: 'dismiss' as const, label: '关闭' }
      : undefined;

  return {
    id: anchor.id,
    anchorType: anchor.anchorType,
    phase,
    title: anchor.title || workflow?.name || '图片生成',
    subtitle,
    previewImageUrl: anchor.previewImageUrl,
    progress,
    progressMode,
    phaseLabel: PHASE_LABELS[phase],
    tone,
    geometry: {
      position: anchor.points[0],
      width: rectangle.width,
      height: rectangle.height,
    },
    transitionMode: anchor.transitionMode,
    primaryAction,
    secondaryAction,
    error: anchor.error || workflow?.error,
    isTerminal: phase === 'completed' || phase === 'failed',
  };
}
