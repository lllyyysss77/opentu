import { useEffect, useRef, type MutableRefObject } from 'react';
import type { PlaitBoard, Point } from '@plait/core';
import { taskQueueService } from '../services/task-queue';
import {
  workflowCompletionService,
  type WorkflowPostProcessingStatus,
  type WorkflowPostProcessingResult,
} from '../services/workflow-completion-service';
import { ImageGenerationAnchorTransforms } from '../plugins/with-image-generation-anchor';
import type { PlaitImageGenerationAnchor } from '../types/image-generation-anchor.types';
import { TaskStatus, TaskType, type Task } from '../types/task.types';
import { getImageGenerationAnchorControllerResult } from '../utils/image-generation-anchor-controller';
import { parseSizeToPixels } from '../utils/size-ratio';

export interface UseImageGenerationAnchorSyncOptions {
  board: PlaitBoard | null;
  enabled?: boolean;
}

const COMPLETED_REMOVAL_DELAY = 1200;

function getTaskWorkflowId(task: Task): string | undefined {
  return typeof task.params.workflowId === 'string'
    ? task.params.workflowId
    : undefined;
}

function isImageTask(task: Task): boolean {
  return task.type === TaskType.IMAGE;
}

function mergeTaskIds(
  anchor: PlaitImageGenerationAnchor,
  tasks: Task[]
): string[] {
  const ids = new Set(anchor.taskIds);

  tasks.forEach((task) => {
    ids.add(task.id);
  });

  return Array.from(ids);
}

function shallowEqualIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

function selectPrimaryTask(
  anchor: PlaitImageGenerationAnchor,
  tasks: Task[]
): Task | null {
  if (anchor.primaryTaskId) {
    const primaryTask = tasks.find((task) => task.id === anchor.primaryTaskId);
    if (primaryTask) {
      return primaryTask;
    }
  }

  const activeTask = tasks
    .filter(
      (task) =>
        task.status === TaskStatus.PENDING ||
        task.status === TaskStatus.PROCESSING
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  if (activeTask) {
    return activeTask;
  }

  return tasks.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

function getTasksForAnchor(
  anchor: PlaitImageGenerationAnchor,
  allTasks: Task[]
): Task[] {
  const taskIdSet = new Set<string>(anchor.taskIds);
  if (anchor.primaryTaskId) {
    taskIdSet.add(anchor.primaryTaskId);
  }

  return allTasks.filter((task) => {
    if (!isImageTask(task)) {
      return false;
    }

    if (taskIdSet.has(task.id)) {
      return true;
    }

    const workflowId = getTaskWorkflowId(task);
    return workflowId === anchor.workflowId;
  });
}

function derivePostProcessingStatus(
  tasks: Task[]
): WorkflowPostProcessingStatus | undefined {
  if (tasks.length === 0) {
    return undefined;
  }

  const results = tasks
    .map((task) => workflowCompletionService.getPostProcessingStatus(task.id))
    .filter((result): result is NonNullable<typeof result> => Boolean(result));

  if (results.some((result) => result.status === 'failed')) {
    return 'failed';
  }

  if (results.some((result) => result.status === 'processing')) {
    return 'processing';
  }

  const allInserted = tasks.every(
    (task) =>
      Boolean(task.insertedToCanvas) ||
      workflowCompletionService.getPostProcessingStatus(task.id)?.status ===
        'completed'
  );

  if (allInserted) {
    return 'completed';
  }

  return undefined;
}

function deriveAnchorError(
  anchor: PlaitImageGenerationAnchor,
  primaryTask: Task | null,
  tasks: Task[]
): string | undefined {
  const failedPostProcessing = tasks
    .map((task) => workflowCompletionService.getPostProcessingStatus(task.id))
    .find((result) => result?.status === 'failed');

  return (
    failedPostProcessing?.error ||
    primaryTask?.error?.message ||
    primaryTask?.error?.details?.originalError ||
    anchor.error
  );
}

function isSamePoint(left?: Point, right?: Point): boolean {
  if (!left || !right) {
    return left === right;
  }

  return left[0] === right[0] && left[1] === right[1];
}

function getAnchorResultDimensions(
  anchor: PlaitImageGenerationAnchor,
  primaryTask: Task | null
): { width: number; height: number } | undefined {
  if (anchor.anchorType === 'stack') {
    return undefined;
  }

  const taskResult = primaryTask?.result as
    | { width?: number; height?: number }
    | undefined;

  if (
    typeof taskResult?.width === 'number' &&
    typeof taskResult?.height === 'number' &&
    taskResult.width > 0 &&
    taskResult.height > 0
  ) {
    return {
      width: taskResult.width,
      height: taskResult.height,
    };
  }

  return (
    anchor.targetFrameDimensions ||
    parseSizeToPixels(anchor.requestedSize)
  );
}

function buildAnchorGeometryPatch(
  anchor: PlaitImageGenerationAnchor,
  position: Point | undefined,
  size?: { width: number; height: number }
): Partial<PlaitImageGenerationAnchor> {
  const patch: Partial<PlaitImageGenerationAnchor> = {};

  if (position && !isSamePoint(anchor.expectedInsertPosition, position)) {
    patch.expectedInsertPosition = position;
  }

  if (position && size) {
    const nextPoints: PlaitImageGenerationAnchor['points'] = [
      position,
      [position[0] + size.width, position[1] + size.height],
    ];

    const [anchorStart, anchorEnd] = anchor.points;
    const samePoints =
      isSamePoint(anchorStart, nextPoints[0]) && isSamePoint(anchorEnd, nextPoints[1]);

    if (!samePoints) {
      patch.points = nextPoints;
    }
  }

  return patch;
}

function scheduleCompletedRemoval(
  board: PlaitBoard,
  anchorId: string,
  timersRef: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>
): void {
  if (timersRef.current.has(anchorId)) {
    return;
  }

  const timer = setTimeout(() => {
    timersRef.current.delete(anchorId);
    const latestAnchor = ImageGenerationAnchorTransforms.getAnchorById(
      board,
      anchorId
    );
    if (!latestAnchor || latestAnchor.phase !== 'completed') {
      return;
    }

    ImageGenerationAnchorTransforms.removeAnchor(board, anchorId);
  }, COMPLETED_REMOVAL_DELAY);

  timersRef.current.set(anchorId, timer);
}

function cancelScheduledRemoval(
  anchorId: string,
  timersRef: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>
): void {
  const timer = timersRef.current.get(anchorId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  timersRef.current.delete(anchorId);
}

export function useImageGenerationAnchorSync({
  board,
  enabled = true,
}: UseImageGenerationAnchorSyncOptions): void {
  const removalTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!board || !enabled) {
      return;
    }

    const removalTimers = removalTimersRef.current;

    const reconcileAnchor = (anchorId: string) => {
      const anchor = ImageGenerationAnchorTransforms.getAnchorById(board, anchorId);
      if (!anchor) {
        cancelScheduledRemoval(anchorId, removalTimersRef);
        return;
      }

      const allTasks = taskQueueService.getAllTasks();
      const relatedTasks = getTasksForAnchor(anchor, allTasks);
      const primaryTask = selectPrimaryTask(anchor, relatedTasks);
      const mergedTaskIds = mergeTaskIds(anchor, relatedTasks);
      const primaryTaskId = anchor.primaryTaskId || primaryTask?.id;
      const postProcessingStatus = derivePostProcessingStatus(relatedTasks);
      const primaryPostProcessingResult =
        (primaryTaskId
          ? workflowCompletionService.getPostProcessingStatus(primaryTaskId)
          : undefined) ||
        relatedTasks
          .map((task) => workflowCompletionService.getPostProcessingStatus(task.id))
          .find(
            (
              result
            ): result is WorkflowPostProcessingResult =>
              Boolean(result)
          );
      const hasInserted =
        relatedTasks.length > 0 &&
        relatedTasks.every(
          (task) =>
            Boolean(task.insertedToCanvas) ||
            workflowCompletionService.getPostProcessingStatus(task.id)?.status ===
              'completed'
        );
      const nextError = deriveAnchorError(anchor, primaryTask, relatedTasks);

      const controllerResult = getImageGenerationAnchorControllerResult({
        anchor: {
          ...anchor,
          taskIds: mergedTaskIds,
          primaryTaskId,
          error: nextError,
        },
        task: primaryTask ?? undefined,
        postProcessingStatus,
        isInserting:
          anchor.phase === 'inserting' && postProcessingStatus === 'processing',
        hasInserted,
      });
      const { viewModel, nextPatch } = controllerResult;

      const patch: Partial<PlaitImageGenerationAnchor> = {};

      if (!shallowEqualIds(anchor.taskIds, mergedTaskIds)) {
        patch.taskIds = mergedTaskIds;
      }

      if (primaryTaskId && primaryTaskId !== anchor.primaryTaskId) {
        patch.primaryTaskId = primaryTaskId;
      }

      if (anchor.phase !== nextPatch.phase) {
        patch.phase = nextPatch.phase;
      }

      if ((anchor.progress ?? null) !== (nextPatch.progress ?? null)) {
        patch.progress = nextPatch.progress;
      }

      if ((anchor.subtitle ?? '') !== (nextPatch.subtitle ?? '')) {
        patch.subtitle = nextPatch.subtitle;
      }

      if ((anchor.error ?? undefined) !== (nextPatch.error ?? undefined)) {
        patch.error = nextPatch.error;
      }

      const geometryPatch = buildAnchorGeometryPatch(
        anchor,
        primaryPostProcessingResult?.firstElementPosition,
        getAnchorResultDimensions(anchor, primaryTask)
      );

      Object.assign(patch, geometryPatch);

      if (
        primaryPostProcessingResult?.firstElementPosition &&
        anchor.transitionMode !== (anchor.anchorType === 'frame' ? 'hold' : 'morph')
      ) {
        patch.transitionMode =
          anchor.anchorType === 'frame' ? 'hold' : 'morph';
      }

      if (Object.keys(patch).length > 0) {
        ImageGenerationAnchorTransforms.updateAnchor(board, anchor.id, patch);
      }

      if (viewModel.phase === 'completed' && hasInserted) {
        scheduleCompletedRemoval(board, anchor.id, removalTimersRef);
      } else {
        cancelScheduledRemoval(anchor.id, removalTimersRef);
      }
    };

    const reconcileAllAnchors = () => {
      ImageGenerationAnchorTransforms.getAllAnchors(board).forEach((anchor) => {
        reconcileAnchor(anchor.id);
      });
    };

    const reconcileTaskRelatedAnchors = (task: Task) => {
      const candidateAnchorIds = new Set<string>();

      const byTaskId = ImageGenerationAnchorTransforms.getAnchorByTaskId(
        board,
        task.id
      );
      if (byTaskId) {
        candidateAnchorIds.add(byTaskId.id);
      }

      const workflowId = getTaskWorkflowId(task);
      if (workflowId) {
        const byWorkflowId = ImageGenerationAnchorTransforms.getAnchorByWorkflowId(
          board,
          workflowId
        );
        if (byWorkflowId) {
          candidateAnchorIds.add(byWorkflowId.id);
        }
      }

      if (candidateAnchorIds.size === 0) {
        reconcileAllAnchors();
        return;
      }

      candidateAnchorIds.forEach((anchorId) => reconcileAnchor(anchorId));
    };

    reconcileAllAnchors();

    const taskSubscription = taskQueueService.observeTaskUpdates().subscribe((event) => {
      if (!isImageTask(event.task)) {
        return;
      }

      reconcileTaskRelatedAnchors(event.task);
    });

    const completionSubscription = workflowCompletionService
      .observeCompletionEvents()
      .subscribe((event) => {
        const byTaskId = ImageGenerationAnchorTransforms.getAnchorByTaskId(
          board,
          event.taskId
        );

        if (byTaskId) {
          reconcileAnchor(byTaskId.id);
          return;
        }

        reconcileAllAnchors();
      });

    return () => {
      taskSubscription.unsubscribe();
      completionSubscription.unsubscribe();
      removalTimers.forEach((timer) => clearTimeout(timer));
      removalTimers.clear();
    };
  }, [board, enabled]);
}
