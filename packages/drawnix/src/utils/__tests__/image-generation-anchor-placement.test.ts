import { describe, expect, it } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import { resolveImageGenerationAnchorAvailablePosition } from '../image-generation-anchor-placement';

function createBoard(children: unknown[]): PlaitBoard {
  return {
    children,
  } as unknown as PlaitBoard;
}

describe('image-generation-anchor-placement', () => {
  it('keeps the desired position when the area is free', () => {
    const board = createBoard([]);

    const position = resolveImageGenerationAnchorAvailablePosition(
      board,
      [100, 120],
      { width: 320, height: 180 }
    );

    expect(position).toEqual([100, 120]);
  });

  it('moves the anchor to a nearby lane when the desired area is occupied', () => {
    const board = createBoard([
      {
        id: 'image-1',
        type: 'image',
        points: [
          [100, 120],
          [420, 300],
        ],
      },
    ]);

    const position = resolveImageGenerationAnchorAvailablePosition(
      board,
      [100, 120],
      { width: 320, height: 180 }
    );

    expect(position).toEqual([460, 120]);
  });

  it('ignores workzones when checking collisions', () => {
    const board = createBoard([
      {
        id: 'workzone-1',
        type: 'workzone',
        points: [
          [100, 120],
          [460, 360],
        ],
      },
    ]);

    const position = resolveImageGenerationAnchorAvailablePosition(
      board,
      [100, 120],
      { width: 320, height: 180 }
    );

    expect(position).toEqual([100, 120]);
  });
});
