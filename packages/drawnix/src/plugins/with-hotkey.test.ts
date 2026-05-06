import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';

const {
  updatePointerTypeMock,
  setCreationModeMock,
  updateAppStateMock,
  globalKeyDownMock,
  keyDownMock,
  getMovingPointInBoardMock,
  isMovingPointInBoardMock,
  hasBeenTextEditingMock,
  getSelectedElementsMock,
} = vi.hoisted(() => ({
  updatePointerTypeMock: vi.fn(),
  setCreationModeMock: vi.fn(),
  updateAppStateMock: vi.fn(),
  globalKeyDownMock: vi.fn(),
  keyDownMock: vi.fn(),
  getMovingPointInBoardMock: vi.fn(),
  isMovingPointInBoardMock: vi.fn(),
  hasBeenTextEditingMock: vi.fn(),
  getSelectedElementsMock: vi.fn(),
}));

vi.mock('@plait/core', () => ({
  BoardTransforms: {
    updatePointerType: updatePointerTypeMock,
  },
  getSelectedElements: getSelectedElementsMock,
  PlaitBoard: {
    getMovingPointInBoard: getMovingPointInBoardMock,
    isMovingPointInBoard: isMovingPointInBoardMock,
    hasBeenTextEditing: hasBeenTextEditingMock,
    isPointer: vi.fn(),
    isInPointer: vi.fn((board: { pointer?: string }, pointers: string[]) =>
      pointers.includes(board.pointer || '')
    ),
  },
  PlaitPointerType: {
    hand: 'hand',
    selection: 'selection',
  },
}));

vi.mock('@plait/common', () => ({
  BoardCreationMode: {
    drawing: 'drawing',
    dnd: 'dnd',
  },
  setCreationMode: setCreationModeMock,
}));

vi.mock('@plait/mind', () => ({
  MindPointerType: {
    mind: 'mind',
  },
}));

vi.mock('./freehand/type', () => ({
  FreehandShape: {
    feltTipPen: 'felt-tip-pen',
    mask: 'mask',
    eraser: 'eraser',
    laserPointer: 'laser-pointer',
  },
}));

vi.mock('./pen/type', () => ({
  PenShape: {
    pen: 'pen',
  },
}));

vi.mock('@plait/draw', () => ({
  ArrowLineShape: {
    straight: 'arrow-straight',
  },
  BasicShapes: {
    rectangle: 'rectangle',
    ellipse: 'ellipse',
    text: 'text',
  },
}));

vi.mock('../utils/image', () => ({
  addImage: vi.fn(),
  saveAsImage: vi.fn(),
}));

vi.mock('../data/json', () => ({
  saveAsJSON: vi.fn(),
}));

vi.mock('../transforms/alignment', () => ({
  AlignmentTransforms: {
    alignLeft: vi.fn(),
    alignCenter: vi.fn(),
    alignRight: vi.fn(),
    alignTop: vi.fn(),
    alignMiddle: vi.fn(),
    alignBottom: vi.fn(),
  },
}));

vi.mock('../transforms/distribute', () => ({
  DistributeTransforms: {
    distributeHorizontal: vi.fn(),
    distributeVertical: vi.fn(),
    autoArrange: vi.fn(),
  },
}));

vi.mock('../transforms/boolean', () => ({
  BooleanTransforms: {
    union: vi.fn(),
    subtract: vi.fn(),
    intersect: vi.fn(),
    exclude: vi.fn(),
    flatten: vi.fn(),
  },
}));

vi.mock('./with-frame', () => ({
  FramePointerType: 'frame',
}));

vi.mock('./with-lasso-selection', () => ({
  LassoPointerType: 'lasso',
}));

import { buildDrawnixHotkeyPlugin } from './with-hotkey';

type TestBoard = PlaitBoard & {
  globalKeyDown: (event: KeyboardEvent) => void;
  keyDown: (event: KeyboardEvent) => void;
  undo: () => void;
  redo: () => void;
};

function createBoard(): TestBoard {
  return {
    globalKeyDown: globalKeyDownMock,
    keyDown: keyDownMock,
    undo: vi.fn(),
    redo: vi.fn(),
  } as unknown as TestBoard;
}

describe('buildDrawnixHotkeyPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMovingPointInBoardMock.mockReturnValue([0, 0]);
    isMovingPointInBoardMock.mockReturnValue(false);
    hasBeenTextEditingMock.mockReturnValue(false);
    getSelectedElementsMock.mockReturnValue([]);
  });

  it('switches to vector pen on Shift+P', () => {
    const board = buildDrawnixHotkeyPlugin(updateAppStateMock)(createBoard()) as TestBoard;
    const event = new KeyboardEvent('keydown', {
      key: 'P',
      shiftKey: true,
      cancelable: true,
    });

    board.globalKeyDown(event);

    expect(setCreationModeMock).toHaveBeenCalledWith(board, 'drawing');
    expect(updatePointerTypeMock).toHaveBeenCalledWith(board, 'pen');
    expect(updateAppStateMock).toHaveBeenCalledWith({ pointer: 'pen' });
    expect(event.defaultPrevented).toBe(true);
    expect(globalKeyDownMock).not.toHaveBeenCalled();
  });

  it.each(['felt-tip-pen', 'mask', 'eraser', 'laser-pointer'])(
    'switches %s back to selection on Escape',
    (pointer) => {
      const board = buildDrawnixHotkeyPlugin(updateAppStateMock)({
        ...createBoard(),
        pointer,
      } as TestBoard & { pointer: string }) as TestBoard;
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
      });

      board.globalKeyDown(event);

      expect(updatePointerTypeMock).toHaveBeenCalledWith(board, 'selection');
      expect(updateAppStateMock).toHaveBeenCalledWith({ pointer: 'selection' });
      expect(event.defaultPrevented).toBe(true);
      expect(globalKeyDownMock).not.toHaveBeenCalled();
    }
  );

  it('does not switch drawing tool to selection while typing Escape', () => {
    const board = buildDrawnixHotkeyPlugin(updateAppStateMock)({
      ...createBoard(),
      pointer: 'eraser',
    } as TestBoard & { pointer: string }) as TestBoard;
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: input });

    board.globalKeyDown(event);

    expect(updatePointerTypeMock).not.toHaveBeenCalled();
    expect(updateAppStateMock).not.toHaveBeenCalled();
    expect(globalKeyDownMock).toHaveBeenCalledWith(event);
  });
});
