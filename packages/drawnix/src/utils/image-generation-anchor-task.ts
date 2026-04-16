import type { PlaitImageGenerationAnchor } from '../types/image-generation-anchor.types';
import { TaskStatus, TaskType, type Task } from '../types/task.types';

export function getImageGenerationAnchorTaskWorkflowId(
  task: Task
): string | undefined {
  return typeof task.params.workflowId === 'string'
    ? task.params.workflowId
    : undefined;
}

function isImageTask(task: Task): boolean {
  return task.type === TaskType.IMAGE;
}

export function doesTaskBelongToImageGenerationAnchor(
  anchor: PlaitImageGenerationAnchor,
  task: Task
): boolean {
  if (!isImageTask(task)) {
    return false;
  }

  const taskIdSet = new Set<string>(anchor.taskIds);
  if (anchor.primaryTaskId) {
    taskIdSet.add(anchor.primaryTaskId);
  }

  if (taskIdSet.has(task.id)) {
    return true;
  }

  return (
    getImageGenerationAnchorTaskWorkflowId(task) === anchor.workflowId
  );
}

export function getTasksForImageGenerationAnchor(
  anchor: PlaitImageGenerationAnchor,
  allTasks: Task[]
): Task[] {
  return allTasks.filter((task) =>
    doesTaskBelongToImageGenerationAnchor(anchor, task)
  );
}

export function mergeImageGenerationAnchorTaskIds(
  anchor: PlaitImageGenerationAnchor,
  tasks: Task[]
): string[] {
  const ids = new Set(anchor.taskIds);

  tasks.forEach((task) => {
    ids.add(task.id);
  });

  return Array.from(ids);
}

export function selectPrimaryImageGenerationAnchorTask(
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
