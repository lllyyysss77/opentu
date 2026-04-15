import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import { useImageGenerationAnchorSync } from '../useImageGenerationAnchorSync';
import { TaskExecutionPhase, TaskStatus, TaskType, type Task } from '../../types/task.types';
import type { PlaitImageGenerationAnchor } from '../../types/image-generation-anchor.types';

const taskListeners: Array<(event: { task: Task }) => void> = [];
const completionListeners: Array<(event: { taskId: string }) => void> = [];
const taskState = {
  tasks: [] as Task[],
};
const completionState = {
  byTaskId: new Map<
    string,
    {
      taskId: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      type: 'direct_insert';
      firstElementPosition?: [number, number];
      error?: string;
    }
  >(),
};

vi.mock('../../services/task-queue', () => ({
  taskQueueService: {
    getAllTasks: () => taskState.tasks,
    observeTaskUpdates: () => ({
      subscribe: (listener: (event: { task: Task }) => void) => {
        taskListeners.push(listener);
        return {
          unsubscribe: () => {
            const index = taskListeners.indexOf(listener);
            if (index >= 0) {
              taskListeners.splice(index, 1);
            }
          },
        };
      },
    }),
  },
}));

vi.mock('../../services/workflow-completion-service', () => ({
  workflowCompletionService: {
    getPostProcessingStatus: (taskId: string) =>
      completionState.byTaskId.get(taskId),
    observeCompletionEvents: () => ({
      subscribe: (listener: (event: { taskId: string }) => void) => {
        completionListeners.push(listener);
        return {
          unsubscribe: () => {
            const index = completionListeners.indexOf(listener);
            if (index >= 0) {
              completionListeners.splice(index, 1);
            }
          },
        };
      },
    }),
  },
}));

vi.mock('../../plugins/with-image-generation-anchor', () => ({
  ImageGenerationAnchorTransforms: {
    getAnchorById: (board: PlaitBoard, anchorId: string) =>
      ((board as unknown as { children: PlaitImageGenerationAnchor[] }).children ?? []).find(
        (anchor) => anchor.id === anchorId
      ) ?? null,
    getAllAnchors: (board: PlaitBoard) =>
      ((board as unknown as { children: PlaitImageGenerationAnchor[] }).children ?? []),
    getAnchorByTaskId: (board: PlaitBoard, taskId: string) =>
      ((board as unknown as { children: PlaitImageGenerationAnchor[] }).children ?? []).find(
        (anchor) => anchor.taskIds.includes(taskId)
      ) ?? null,
    getAnchorByWorkflowId: (board: PlaitBoard, workflowId: string) =>
      ((board as unknown as { children: PlaitImageGenerationAnchor[] }).children ?? []).find(
        (anchor) => anchor.workflowId === workflowId
      ) ?? null,
    updateAnchor: (
      board: PlaitBoard,
      anchorId: string,
      patch: Partial<PlaitImageGenerationAnchor>
    ) => {
      const boardState = board as unknown as {
        children: PlaitImageGenerationAnchor[];
      };
      const index = boardState.children.findIndex((anchor) => anchor.id === anchorId);
      if (index >= 0) {
        boardState.children[index] = {
          ...boardState.children[index],
          ...patch,
        };
      }
    },
    removeAnchor: (board: PlaitBoard, anchorId: string) => {
      const boardState = board as unknown as {
        children: PlaitImageGenerationAnchor[];
      };
      boardState.children = boardState.children.filter(
        (anchor) => anchor.id !== anchorId
      );
    },
  },
}));

function createAnchor(
  overrides: Partial<PlaitImageGenerationAnchor> = {}
): PlaitImageGenerationAnchor {
  return {
    id: 'anchor-1',
    type: 'generation-anchor',
    points: [
      [10, 20],
      [330, 200],
    ],
    angle: 0,
    anchorType: 'ratio',
    phase: 'submitted',
    title: '图片生成',
    subtitle: '已提交，等待执行',
    progress: null,
    error: undefined,
    transitionMode: 'hold',
    createdAt: 1,
    workflowId: 'wf-1',
    taskIds: [],
    primaryTaskId: undefined,
    expectedInsertPosition: [10, 20],
    targetFrameId: undefined,
    targetFrameDimensions: undefined,
    requestedSize: '16x9',
    requestedCount: 1,
    zoom: 1,
    children: [],
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.PENDING,
    params: {
      prompt: '生成图片',
      workflowId: 'wf-1',
      size: '16x9',
    },
    createdAt: 1,
    updatedAt: 1,
    insertedToCanvas: false,
    ...overrides,
  };
}

function createBoard(anchor: PlaitImageGenerationAnchor): PlaitBoard {
  return {
    children: [anchor],
  } as unknown as PlaitBoard;
}

function emitTaskUpdate(task: Task): void {
  taskListeners.forEach((listener) => listener({ task }));
}

function emitCompletion(taskId: string): void {
  completionListeners.forEach((listener) => listener({ taskId }));
}

describe('useImageGenerationAnchorSync', () => {
  beforeEach(() => {
    taskListeners.length = 0;
    completionListeners.length = 0;
    taskState.tasks = [];
    completionState.byTaskId.clear();
    vi.useRealTimers();
  });

  it('recovers task binding and queued phase on mount via workflowId', () => {
    const board = createBoard(createAnchor());
    taskState.tasks = [
      createTask({
        status: TaskStatus.PROCESSING,
        executionPhase: TaskExecutionPhase.SUBMITTING,
      }),
    ];

    renderHook(() => useImageGenerationAnchorSync({ board, enabled: true }));

    const [anchor] = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchor.taskIds).toEqual(['task-1']);
    expect(anchor.primaryTaskId).toBe('task-1');
    expect(anchor.phase).toBe('queued');
    expect(anchor.subtitle).toBe('请求已受理，等待执行');
  });

  it('updates anchor to failed when post-processing fails', () => {
    const board = createBoard(createAnchor({ taskIds: ['task-1'] }));
    taskState.tasks = [
      createTask({
        status: TaskStatus.COMPLETED,
      }),
    ];
    completionState.byTaskId.set('task-1', {
      taskId: 'task-1',
      status: 'failed',
      type: 'direct_insert',
      error: '插入失败',
    });

    renderHook(() => useImageGenerationAnchorSync({ board, enabled: true }));

    const [anchor] = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchor.phase).toBe('failed');
    expect(anchor.error).toBe('插入失败');
  });

  it('removes anchor after completed insertion settles', () => {
    vi.useFakeTimers();

    const board = createBoard(createAnchor({ taskIds: ['task-1'], phase: 'inserting' }));
    taskState.tasks = [
      createTask({
        status: TaskStatus.COMPLETED,
        insertedToCanvas: true,
      }),
    ];
    completionState.byTaskId.set('task-1', {
      taskId: 'task-1',
      status: 'completed',
      type: 'direct_insert',
      firstElementPosition: [120, 240],
    });

    renderHook(() => useImageGenerationAnchorSync({ board, enabled: true }));

    let anchors = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchors[0]?.phase).toBe('completed');
    expect(anchors[0]?.transitionMode).toBe('morph');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    anchors = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchors).toHaveLength(0);
  });

  it('reconciles on task and completion events after mount', () => {
    const board = createBoard(createAnchor());
    taskState.tasks = [createTask()];

    renderHook(() => useImageGenerationAnchorSync({ board, enabled: true }));

    const processingTask = createTask({
      status: TaskStatus.PROCESSING,
      executionPhase: undefined,
      updatedAt: 2,
    });
    taskState.tasks = [processingTask];

    act(() => {
      emitTaskUpdate(processingTask);
    });

    let [anchor] = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchor.phase).toBe('generating');

    const completedTask = createTask({
      status: TaskStatus.COMPLETED,
      insertedToCanvas: true,
      updatedAt: 3,
    });
    taskState.tasks = [completedTask];
    completionState.byTaskId.set('task-1', {
      taskId: 'task-1',
      status: 'completed',
      type: 'direct_insert',
      firstElementPosition: [200, 300],
    });

    act(() => {
      emitCompletion('task-1');
    });

    [anchor] = (board as unknown as { children: PlaitImageGenerationAnchor[] })
      .children;
    expect(anchor.phase).toBe('completed');
    expect(anchor.expectedInsertPosition).toEqual([200, 300]);
  });
});
