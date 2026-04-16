import { useEffect, useMemo, useState } from 'react';
import { taskQueueService } from '../services/task-queue';
import {
  getImageGenerationAnchorControllerResult,
  type ImageGenerationAnchorControllerOptions as UseImageGenerationAnchorControllerOptions,
  type ImageGenerationAnchorControllerResult,
} from '../utils/image-generation-anchor-controller';
import {
  doesTaskBelongToImageGenerationAnchor,
  getTasksForImageGenerationAnchor,
  selectPrimaryImageGenerationAnchorTask,
} from '../utils/image-generation-anchor-task';
import { useImageTaskProgress } from './useImageTaskProgress';

export function useImageGenerationAnchorController(
  options: UseImageGenerationAnchorControllerOptions
): ImageGenerationAnchorControllerResult {
  const { anchor, task: providedTask } = options;
  const [taskRevision, setTaskRevision] = useState(0);
  const taskIdsKey = anchor.taskIds.join('|');

  useEffect(() => {
    if (providedTask) {
      return;
    }

    const subscription = taskQueueService.observeTaskUpdates().subscribe((event) => {
      if (doesTaskBelongToImageGenerationAnchor(anchor, event.task)) {
        setTaskRevision((value) => value + 1);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [anchor, providedTask, taskIdsKey]);

  const resolvedTask = useMemo(() => {
    if (providedTask) {
      return providedTask;
    }

    const allTasks = taskQueueService.getAllTasks();
    const relatedTasks = getTasksForImageGenerationAnchor(anchor, allTasks);
    return selectPrimaryImageGenerationAnchorTask(anchor, relatedTasks);
  }, [anchor, providedTask, taskIdsKey, taskRevision]);

  const { displayProgress } = useImageTaskProgress({
    taskType: resolvedTask?.type,
    taskStatus: resolvedTask?.status,
    startedAt: resolvedTask?.startedAt,
    fallbackProgress: resolvedTask?.progress ?? anchor.progress,
  });

  return useMemo(
    () =>
      getImageGenerationAnchorControllerResult({
        ...options,
        task: resolvedTask ?? providedTask,
        taskDisplayProgress: displayProgress,
      }),
    [displayProgress, options, providedTask, resolvedTask]
  );
}
