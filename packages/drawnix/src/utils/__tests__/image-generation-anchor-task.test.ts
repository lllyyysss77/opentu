import { describe, expect, it } from 'vitest';
import type { PlaitImageGenerationAnchor } from '../../types/image-generation-anchor.types';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import { doesTaskBelongToImageGenerationAnchor } from '../image-generation-anchor-task';

function createAnchor(
  overrides: Partial<PlaitImageGenerationAnchor> = {}
): PlaitImageGenerationAnchor {
  return {
    id: 'anchor-1',
    type: 'generation-anchor',
    points: [
      [0, 0],
      [320, 180],
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
    batchId: undefined,
    batchIndex: undefined,
    batchTotal: undefined,
    expectedInsertPosition: [0, 0],
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

describe('image-generation-anchor-task', () => {
  it('matches a single anchor by workflow id when no batch metadata exists', () => {
    expect(
      doesTaskBelongToImageGenerationAnchor(createAnchor(), createTask())
    ).toBe(true);
  });

  it('matches a batched independent anchor only when batch slot matches', () => {
    const anchor = createAnchor({
      batchId: 'wf_batch_wf-1',
      batchIndex: 2,
      batchTotal: 4,
    });

    expect(
      doesTaskBelongToImageGenerationAnchor(
        anchor,
        createTask({
          params: {
            prompt: '生成图片',
            workflowId: 'wf-1',
            batchId: 'wf_batch_wf-1',
            batchIndex: 2,
            batchTotal: 4,
            size: '16x9',
          },
        })
      )
    ).toBe(true);

    expect(
      doesTaskBelongToImageGenerationAnchor(
        anchor,
        createTask({
          id: 'task-2',
          params: {
            prompt: '生成图片',
            workflowId: 'wf-1',
            batchId: 'wf_batch_wf-1',
            batchIndex: 1,
            batchTotal: 4,
            size: '16x9',
          },
        })
      )
    ).toBe(false);
  });
});
