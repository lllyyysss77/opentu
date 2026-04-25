/**
 * FramePanel Component
 *
 * 在项目抽屉中展示当前画布的 Frame 列表
 * 支持点击聚焦到对应 Frame 视图
 */

import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
} from 'react';
import classNames from 'classnames';
import { Input, Button, MessagePlugin, Loading, Dropdown } from 'tdesign-react';
import { Check, LayoutGrid, Presentation } from 'lucide-react';
import {
  SearchIcon,
  EditIcon,
  DeleteIcon,
  AddIcon,
  PlayCircleIcon,
  ImageIcon,
  FileCopyIcon,
} from 'tdesign-icons-react';
import {
  PlaitBoard,
  PlaitElement,
  Path,
  BoardTransforms,
  RectangleClient,
  Transforms,
  clearSelectedElement,
  addSelectedElement,
  getSelectedElements,
} from '@plait/core';
import {
  PlaitFrame,
  getFrameDisplayName,
  isFrameElement,
} from '../../types/frame.types';
import { FrameTransforms } from '../../plugins/with-frame';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { useDragSort } from '../../hooks/use-drag-sort';
import { AddFrameDialog } from './AddFrameDialog';
import { FrameSlideshow } from './FrameSlideshow';
import {
  findPPTSlideImage,
  getPPTSlidePrompt,
  insertMediaIntoFrame,
  replacePPTSlideImage,
  setFramePPTMeta,
} from '../../utils/frame-insertion-utils';
import {
  type PPTFrameMeta,
  type PPTSlideImageHistoryItem,
  getPPTFrameGridPosition,
  loadPPTFrameLayoutColumns,
  sanitizePPTFrameLayoutColumns,
  savePPTFrameLayoutColumns,
} from '../../services/ppt';
import { duplicateFrame, focusFrame } from '../../utils/frame-duplicate';
import {
  getFrameAwareSelection,
  moveElementWithFrameRelations,
} from '../../transforms/frame-aware';
import { useI18n } from '../../i18n';
import { AIImageIcon, DownloadIcon } from '../icons';
import { exportAllPPTFrames } from '../../services/ppt/ppt-export-service';
import {
  ContextMenu,
  useContextMenuState,
  type ContextMenuEntry,
} from '../shared';
import { useConfirmDialog } from '../dialog/ConfirmDialog';
import { HoverTip } from '../shared';
import { useThumbnailUrl } from '../../hooks/useThumbnailUrl';

interface FrameInfo {
  frame: PlaitFrame;
  path: Path;
  listKey: string;
  isRoot: boolean;
  childCount: number;
  width: number;
  height: number;
  /** PPT 元数据（如果有） */
  pptMeta?: PPTFrameMeta;
  slideImageUrl?: string;
  slideImageElementId?: string;
  slidePrompt?: string;
}

const PPT_HISTORY_PROMPT_PREVIEW_LENGTH = 36;
const PPT_LAYOUT_COLUMN_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => index + 1
);
const DEFAULT_FRAME_NAME_REGEXP = /^(?:Frame|Slide|PPT\s*页面)\s*\d+$/i;
type PPTPageInsertPlacement = 'before' | 'after';

function getPPTPageFrameName(pageIndex: number): string {
  return `PPT 页面 ${pageIndex}`;
}

function isDefaultFrameName(name?: string): boolean {
  return DEFAULT_FRAME_NAME_REGEXP.test((name || '').trim());
}

function getOrderedPPTFrameInfos(frameInfos: FrameInfo[]): FrameInfo[] {
  const sourceOrder = new Map(
    frameInfos.map((info, index) => [info.frame.id, index])
  );

  return [...frameInfos].sort((left, right) => {
    const leftIndex = left.pptMeta?.pageIndex;
    const rightIndex = right.pptMeta?.pageIndex;
    const hasLeftIndex =
      typeof leftIndex === 'number' && !Number.isNaN(leftIndex);
    const hasRightIndex =
      typeof rightIndex === 'number' && !Number.isNaN(rightIndex);

    if (hasLeftIndex && hasRightIndex && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (hasLeftIndex !== hasRightIndex) {
      return hasLeftIndex ? -1 : 1;
    }
    return (
      (sourceOrder.get(left.frame.id) ?? 0) -
      (sourceOrder.get(right.frame.id) ?? 0)
    );
  });
}

function areStringSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function getSlideImageHistory(
  frameInfo: FrameInfo
): PPTSlideImageHistoryItem[] {
  const history = (frameInfo.pptMeta?.slideImageHistory || []).filter(
    (item) => !!item.imageUrl
  );

  if (!frameInfo.slideImageUrl) {
    return history;
  }

  const hasCurrentImage = history.some((item) => {
    if (
      frameInfo.slideImageElementId &&
      item.elementId === frameInfo.slideImageElementId
    ) {
      return true;
    }
    return item.imageUrl === frameInfo.slideImageUrl;
  });

  if (hasCurrentImage) {
    return history;
  }

  return [
    {
      id: `current-${frameInfo.frame.id}-${
        frameInfo.slideImageElementId || frameInfo.slideImageUrl
      }`,
      imageUrl: frameInfo.slideImageUrl,
      ...(frameInfo.slideImageElementId
        ? { elementId: frameInfo.slideImageElementId }
        : {}),
      ...(frameInfo.slidePrompt ? { prompt: frameInfo.slidePrompt } : {}),
      createdAt: 0,
    },
    ...history,
  ];
}

function formatHistoryCreatedAt(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return '';
  }
  return new Date(createdAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PPTSlideHistoryMenuLabel: React.FC<{
  item: PPTSlideImageHistoryItem;
  index: number;
}> = ({ item, index }) => {
  const prompt = item.prompt?.trim();
  const promptPreview =
    prompt && prompt.length > PPT_HISTORY_PROMPT_PREVIEW_LENGTH
      ? `${prompt.slice(0, PPT_HISTORY_PROMPT_PREVIEW_LENGTH)}…`
      : prompt;

  return (
    <span className="frame-panel__history-menu-item">
      <img
        src={item.imageUrl}
        alt={`历史图片 ${index + 1}`}
        loading="lazy"
        className="frame-panel__history-menu-thumb"
      />
      <span className="frame-panel__history-menu-text">
        <span className="frame-panel__history-menu-title">
          历史图片 {index + 1}
          {formatHistoryCreatedAt(item.createdAt)
            ? ` · ${formatHistoryCreatedAt(item.createdAt)}`
            : ''}
        </span>
        {promptPreview ? (
          <span className="frame-panel__history-menu-prompt">
            {promptPreview}
          </span>
        ) : null}
      </span>
      <span className="frame-panel__history-menu-preview">
        <img
          src={item.imageUrl}
          alt={`历史图片 ${index + 1} 预览`}
          loading="lazy"
          decoding="async"
        />
      </span>
    </span>
  );
};

const PPTSlidePreview: React.FC<{
  imageUrl?: string;
  title: string;
  status?: PPTFrameMeta['slideImageStatus'] | PPTFrameMeta['imageStatus'];
}> = ({ imageUrl, title, status }) => {
  const thumbnailUrl = useThumbnailUrl(imageUrl, 'image', 'small');
  const emptyText =
    status === 'loading'
      ? '生成中'
      : status === 'failed'
        ? '生成失败'
        : '空白页';

  return (
    <div className="frame-panel__slide-preview">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          loading="lazy"
          className="frame-panel__slide-preview-img"
        />
      ) : (
        <div className="frame-panel__slide-preview-empty">{emptyText}</div>
      )}
    </div>
  );
};

export const FramePanel: React.FC = () => {
  const { board, openDialog } = useDrawnix();
  const { language } = useI18n();
  const { confirm, confirmDialog } = useConfirmDialog({
    container: board ? PlaitBoard.getBoardContainer(board) : null,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastSelectedFrameId, setLastSelectedFrameId] = useState<string | null>(
    null
  );
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [slideshowVisible, setSlideshowVisible] = useState(false);
  const {
    contextMenu,
    open: openContextMenu,
    close: closeContextMenu,
  } = useContextMenuState<FrameInfo>();
  const [isExportingAllPPT, setIsExportingAllPPT] = useState(false);
  const [pptLayoutColumns, setPPTLayoutColumns] = useState(() =>
    loadPPTFrameLayoutColumns()
  );

  // 监听画布变化，强制刷新 Frame 列表
  // FramePanel 在 BoardContext（Wrapper）外部渲染，无法通过 BoardContext 的 v 版本号触发重渲染
  // 因此需要通过包装 board.afterChange 来检测 children 变化
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!board) return;
    const originalAfterChange = board.afterChange;
    board.afterChange = () => {
      originalAfterChange();
      setRefreshKey((k) => k + 1);
    };
    return () => {
      board.afterChange = originalAfterChange;
    };
  }, [board]);

  useEffect(() => {
    if (!board) return;

    let animationFrameId = 0;
    let lastRawSelectionKey = '';
    let lastSelectedFrameKey = '';

    const syncCanvasSelection = () => {
      const rawSelectionKey = JSON.stringify(board.selection) || '';
      if (rawSelectionKey === lastRawSelectionKey) {
        animationFrameId = requestAnimationFrame(syncCanvasSelection);
        return;
      }
      lastRawSelectionKey = rawSelectionKey;

      const selectedFrameIdsFromCanvas = getSelectedElements(board)
        .filter(isFrameElement)
        .map((frame) => frame.id);
      const nextSelectionKey = selectedFrameIdsFromCanvas.join('|');

      if (nextSelectionKey !== lastSelectedFrameKey) {
        lastSelectedFrameKey = nextSelectionKey;
        const nextSelectedFrameIds = new Set(selectedFrameIdsFromCanvas);

        setSelectedFrameIds((current) =>
          areStringSetsEqual(current, nextSelectedFrameIds)
            ? current
            : nextSelectedFrameIds
        );

        setLastSelectedFrameId((current) => {
          const nextLastSelectedFrameId =
            selectedFrameIdsFromCanvas[selectedFrameIdsFromCanvas.length - 1] ||
            null;
          return current === nextLastSelectedFrameId
            ? current
            : nextLastSelectedFrameId;
        });
      }

      animationFrameId = requestAnimationFrame(syncCanvasSelection);
    };

    animationFrameId = requestAnimationFrame(syncCanvasSelection);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [board]);

  // 收集画布中的所有 Frame 及其信息（支持嵌套结构）
  const frames: FrameInfo[] = useMemo(() => {
    if (!board || !board.children) return [];

    const result: FrameInfo[] = [];
    const childCountMap = new Map<string, number>();

    const walk = (elements: PlaitElement[], parentPath: Path = []) => {
      elements.forEach((element, index) => {
        const path: Path = [...parentPath, index];
        const frameId = (element as PlaitElement & { frameId?: string })
          .frameId;
        if (frameId) {
          childCountMap.set(frameId, (childCountMap.get(frameId) ?? 0) + 1);
        }

        if (isFrameElement(element)) {
          const frame = element as PlaitFrame;
          const rect = RectangleClient.getRectangleByPoints(frame.points);
          const pptMeta = (frame as any).pptMeta as PPTFrameMeta | undefined;
          const slideImage = findPPTSlideImage(board, frame.id);
          result.push({
            frame,
            path,
            listKey: `${frame.id}-${path.join('.')}`,
            isRoot: parentPath.length === 0,
            childCount: 0,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            pptMeta,
            slideImageUrl: slideImage?.url,
            slideImageElementId: slideImage?.elementId,
            slidePrompt: getPPTSlidePrompt(pptMeta),
          });
        }

        if (element.children && element.children.length > 0) {
          walk(element.children as PlaitElement[], path);
        }
      });
    };

    walk(board.children as PlaitElement[]);

    result.forEach((info) => {
      info.childCount = childCountMap.get(info.frame.id) ?? 0;
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, refreshKey]);

  // 过滤 PPT 页面
  const filteredFrames = useMemo(() => {
    if (!searchQuery.trim()) return frames;
    const query = searchQuery.toLowerCase().trim();
    return frames.filter((f) =>
      getFrameDisplayName(f.frame).toLowerCase().includes(query)
    );
  }, [frames, searchQuery]);

  useEffect(() => {
    const existingFrameIds = new Set(frames.map((info) => info.frame.id));
    setSelectedFrameIds((current) => {
      const next = new Set(
        Array.from(current).filter((id) => existingFrameIds.has(id))
      );
      return next.size === current.size ? current : next;
    });
    if (lastSelectedFrameId && !existingFrameIds.has(lastSelectedFrameId)) {
      setLastSelectedFrameId(null);
    }
  }, [frames, lastSelectedFrameId]);

  const rootFrames = useMemo(() => {
    return frames.filter((item) => item.isRoot);
  }, [frames]);

  const rootIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    rootFrames.forEach((item, index) => {
      map.set(item.listKey, index);
    });
    return map;
  }, [rootFrames]);

  const focusFrameViewport = useCallback(
    (frame: PlaitFrame) => {
      if (!board) return;

      // 计算 Frame 矩形
      const rect = RectangleClient.getRectangleByPoints(frame.points);
      const padding = 80;

      // 获取画布容器尺寸
      const container = PlaitBoard.getBoardContainer(board);
      let viewportWidth = container.clientWidth;
      let viewportHeight = container.clientHeight;

      // 获取左侧抽屉宽度（如果存在）
      const drawer = document.querySelector('.project-drawer');
      const drawerWidth = drawer ? (drawer as HTMLElement).offsetWidth : 0;

      // 获取底部输入框高度（如果存在）
      const inputBar = document.querySelector('.ai-input-bar');
      const inputBarHeight = inputBar
        ? (inputBar as HTMLElement).offsetHeight
        : 0;

      // 计算实际可见区域尺寸
      const visibleWidth = viewportWidth - drawerWidth;
      const visibleHeight = viewportHeight - inputBarHeight;

      // 计算缩放比例，让 Frame 适应可见区域
      const scaleX = visibleWidth / (rect.width + padding * 2);
      const scaleY = visibleHeight / (rect.height + padding * 2);
      const zoom = Math.min(scaleX, scaleY, 2);

      // 计算 Frame 中心点
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      // 计算可见区域的中心点（考虑抽屉和输入框的偏移）
      const visibleCenterX = drawerWidth + visibleWidth / 2;
      const visibleCenterY = visibleHeight / 2;

      // 计算 origination：使 Frame 中心对齐可见区域中心
      const origination: [number, number] = [
        centerX - visibleCenterX / zoom,
        centerY - visibleCenterY / zoom,
      ];

      BoardTransforms.updateViewport(board, origination, zoom);
    },
    [board]
  );

  const syncCanvasSelectedFrames = useCallback(
    (frameInfos: FrameInfo[]) => {
      if (!board) return;
      clearSelectedElement(board);
      for (const info of frameInfos) {
        addSelectedElement(board, info.frame);
      }
    },
    [board]
  );

  // 点击 Frame：选中并聚焦视图，Shift 连续选择
  const handleFrameClick = useCallback(
    (frameInfo: FrameInfo, e: React.MouseEvent) => {
      if (!board) return;

      const isShift = e.shiftKey;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      let nextSelectedFrameIds = new Set<string>();
      let selectedInfos: FrameInfo[] = [frameInfo];

      if (isShift && lastSelectedFrameId) {
        const startIndex = filteredFrames.findIndex(
          (info) => info.frame.id === lastSelectedFrameId
        );
        const endIndex = filteredFrames.findIndex(
          (info) => info.frame.id === frameInfo.frame.id
        );
        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] =
            startIndex < endIndex
              ? [startIndex, endIndex]
              : [endIndex, startIndex];
          nextSelectedFrameIds = new Set(selectedFrameIds);
          filteredFrames
            .slice(from, to + 1)
            .forEach((info) => nextSelectedFrameIds.add(info.frame.id));
          selectedInfos = frames.filter((info) =>
            nextSelectedFrameIds.has(info.frame.id)
          );
        } else {
          nextSelectedFrameIds.add(frameInfo.frame.id);
        }
      } else if (isCtrlOrCmd) {
        nextSelectedFrameIds = new Set(selectedFrameIds);
        if (nextSelectedFrameIds.has(frameInfo.frame.id)) {
          nextSelectedFrameIds.delete(frameInfo.frame.id);
        } else {
          nextSelectedFrameIds.add(frameInfo.frame.id);
        }
        selectedInfos = frames.filter((info) =>
          nextSelectedFrameIds.has(info.frame.id)
        );
        setLastSelectedFrameId(frameInfo.frame.id);
      } else {
        nextSelectedFrameIds.add(frameInfo.frame.id);
        setLastSelectedFrameId(frameInfo.frame.id);
      }

      setSelectedFrameIds(nextSelectedFrameIds);
      syncCanvasSelectedFrames(selectedInfos);
      focusFrameViewport(frameInfo.frame);
    },
    [
      board,
      filteredFrames,
      focusFrameViewport,
      frames,
      lastSelectedFrameId,
      selectedFrameIds,
      syncCanvasSelectedFrames,
    ]
  );

  // 开始重命名
  const handleStartRename = useCallback(
    (frameInfo: FrameInfo, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingKey(frameInfo.listKey);
      setEditingName(getFrameDisplayName(frameInfo.frame));
    },
    []
  );

  // 完成重命名
  const handleFinishRename = useCallback(
    (frameInfo: FrameInfo) => {
      if (!board) return;
      const newName = editingName.trim();
      if (newName && newName !== frameInfo.frame.name) {
        Transforms.setNode(board, { name: newName } as any, frameInfo.path);
      }
      setEditingKey(null);
      setEditingName('');
    },
    [board, editingName]
  );

  const getFrameDeleteTargets = useCallback(
    (frameInfo: FrameInfo) => {
      if (
        selectedFrameIds.size > 1 &&
        selectedFrameIds.has(frameInfo.frame.id)
      ) {
        const selectedInfos = frames.filter((info) =>
          selectedFrameIds.has(info.frame.id)
        );
        if (selectedInfos.length > 0) {
          return selectedInfos;
        }
      }
      return [frameInfo];
    },
    [frames, selectedFrameIds]
  );

  // 删除 Frame，并删除绑定到 Frame 的画布内容
  const handleDelete = useCallback(
    async (frameInfo: FrameInfo, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!board) return;

      const targets = getFrameDeleteTargets(frameInfo);
      const targetFrameIds = new Set(targets.map((info) => info.frame.id));
      const isBatchDelete = targetFrameIds.size > 1;

      const confirmed = await confirm({
        title: isBatchDelete ? '确认删除选中的 PPT 页面' : '确认删除 PPT 页面',
        description: isBatchDelete
          ? `确定要删除选中的 ${targetFrameIds.size} 个 PPT 页面及其内容吗？此操作不可撤销。`
          : `确定要删除 PPT 页面「${
              getFrameDisplayName(frameInfo.frame)
            }」及其内容吗？此操作不可撤销。`,
        confirmText: '删除',
        cancelText: '取消',
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      const elementsToDelete = FrameTransforms.getFrameContents(
        board,
        targetFrameIds
      );
      if (elementsToDelete.length === 0) {
        MessagePlugin.warning('未找到可删除的 PPT 页面');
        return;
      }

      board.deleteFragment(elementsToDelete);
      setSelectedFrameIds((current) => {
        const next = new Set(current);
        targetFrameIds.forEach((id) => next.delete(id));
        return next;
      });
      setLastSelectedFrameId((current) =>
        current && targetFrameIds.has(current) ? null : current
      );
      MessagePlugin.success(
        isBatchDelete
          ? `已删除 ${targetFrameIds.size} 个 PPT 页面及其内容`
          : '已删除 PPT 页面及其内容'
      );
    },
    [board, confirm, getFrameDeleteTargets]
  );

  // 复制 Frame
  const handleDuplicate = useCallback(
    (frameInfo: FrameInfo, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!board) return;

      const clonedFrame = duplicateFrame(
        board,
        frameInfo.frame,
        language as 'zh' | 'en'
      );

      // 如果复制成功，自动聚焦到新 Frame
      if (clonedFrame) {
        focusFrame(board, clonedFrame);
      }
    },
    [board, language]
  );

  const reorderFrames = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!board) return;

      const framePositions: number[] = [];
      const orderedFrames: PlaitFrame[] = [];

      board.children.forEach((element, index) => {
        if (isFrameElement(element)) {
          framePositions.push(index);
          orderedFrames.push(element as PlaitFrame);
        }
      });

      if (framePositions.length <= 1) return;

      const nextFrames = [...orderedFrames];
      const [moved] = nextFrames.splice(fromIndex, 1);
      nextFrames.splice(toIndex, 0, moved);

      for (let i = framePositions.length - 1; i >= 0; i -= 1) {
        Transforms.removeNode(board, [framePositions[i]]);
      }

      for (let i = 0; i < framePositions.length; i += 1) {
        Transforms.insertNode(board, nextFrames[i], [framePositions[i]]);
      }
    },
    [board]
  );

  const { getDragProps } = useDragSort({
    items: rootFrames,
    getId: (item) => item.listKey,
    onReorder: reorderFrames,
    enabled: !searchQuery.trim() && rootFrames.length > 1,
  });

  const noop = useCallback(() => {}, []);
  const getFrameDragProps = useCallback(
    (info: FrameInfo) => {
      if (!info.isRoot) {
        return {
          draggable: false,
          onDragStart: noop,
          onDragEnd: noop,
          onDragOver: noop,
          onDragEnter: noop,
          onDragLeave: noop,
          onDrop: noop,
          'data-dragging': false,
          'data-drag-over': false,
          'data-drag-position': undefined,
        };
      }
      const index = rootIndexMap.get(info.listKey) ?? 0;
      return getDragProps(info.listKey, index);
    },
    [getDragProps, rootIndexMap, noop]
  );

  const handleArrangePPTFrames = useCallback(
    (columns = pptLayoutColumns) => {
      if (!board) return;

      const targetFrames = rootFrames.length > 0 ? rootFrames : frames;
      if (targetFrames.length === 0) {
        MessagePlugin.info('当前没有可排列的 PPT 页面');
        return;
      }

      const safeColumns = sanitizePPTFrameLayoutColumns(columns);
      const sortedFrames = getOrderedPPTFrameInfos(targetFrames);
      const frameRects = sortedFrames.map((info) =>
        RectangleClient.getRectangleByPoints(info.frame.points)
      );
      const startPosition: [number, number] = [
        Math.min(...frameRects.map((rect) => rect.x)),
        Math.min(...frameRects.map((rect) => rect.y)),
      ];
      const frameAwareSelection = getFrameAwareSelection(
        board,
        sortedFrames.map((info) => info.frame)
      );
      const movedElementIds = new Set<string>();

      sortedFrames.forEach((info, index) => {
        const rect = RectangleClient.getRectangleByPoints(info.frame.points);
        const targetPosition = getPPTFrameGridPosition(
          startPosition,
          index,
          safeColumns
        );
        moveElementWithFrameRelations(
          board,
          info.frame,
          targetPosition[0] - rect.x,
          targetPosition[1] - rect.y,
          frameAwareSelection.relatedByFrameId,
          movedElementIds
        );
      });

      sortedFrames.forEach((info) => {
        const frame = board.children.find(
          (element) => element.id === info.frame.id && isFrameElement(element)
        );
        if (frame && isFrameElement(frame)) {
          FrameTransforms.updateFrameMembers(board, frame);
        }
      });

      MessagePlugin.success(`已按每行 ${safeColumns} 个排列 PPT 页面`);
    },
    [board, frames, pptLayoutColumns, rootFrames]
  );

  const pptLayoutMenuOptions = useMemo(
    () =>
      PPT_LAYOUT_COLUMN_OPTIONS.map((columns) => ({
        content: `每行 ${columns} 个`,
        value: columns,
        prefixIcon:
          columns === pptLayoutColumns ? (
            <Check size={14} />
          ) : (
            <span className="frame-panel__layout-menu-placeholder" />
          ),
      })),
    [pptLayoutColumns]
  );

  const handlePPTLayoutMenuClick = useCallback(
    (data: { value?: unknown }) => {
      const columns = sanitizePPTFrameLayoutColumns(data.value);
      setPPTLayoutColumns(columns);
      savePPTFrameLayoutColumns(columns);
      handleArrangePPTFrames(columns);
    },
    [handleArrangePPTFrames]
  );

  const reorderRootFramesByIds = useCallback(
    (orderedFrameIds: string[]) => {
      if (!board) return;

      const framePositions: number[] = [];
      const frameById = new Map<string, PlaitFrame>();
      const existingFrameIds: string[] = [];
      board.children.forEach((element, index) => {
        if (!isFrameElement(element)) return;
        framePositions.push(index);
        frameById.set(element.id, element as PlaitFrame);
        existingFrameIds.push(element.id);
      });

      if (framePositions.length <= 1) return;

      const orderedIdSet = new Set(orderedFrameIds);
      const nextFrames: PlaitFrame[] = [];
      for (const id of orderedFrameIds) {
        const frame = frameById.get(id);
        if (frame) {
          nextFrames.push(frame);
        }
      }
      for (const id of existingFrameIds) {
        if (orderedIdSet.has(id)) continue;
        const frame = frameById.get(id);
        if (frame) {
          nextFrames.push(frame);
        }
      }

      if (nextFrames.length !== framePositions.length) return;

      for (let i = framePositions.length - 1; i >= 0; i -= 1) {
        Transforms.removeNode(board, [framePositions[i]]);
      }
      for (let i = 0; i < framePositions.length; i += 1) {
        Transforms.insertNode(board, nextFrames[i], [framePositions[i]]);
      }
    },
    [board]
  );

  const renumberPPTFrames = useCallback(
    (orderedFrameIds: string[]) => {
      if (!board) return;

      orderedFrameIds.forEach((frameId, index) => {
        const frameIndex = board.children.findIndex(
          (element) => element.id === frameId && isFrameElement(element)
        );
        if (frameIndex === -1) return;

        const pageIndex = index + 1;
        const frame = board.children[frameIndex] as PlaitFrame & {
          pptMeta?: PPTFrameMeta;
        };
        setFramePPTMeta(board, frameId, {
          pageIndex,
          ...(!frame.pptMeta
            ? { slideImageStatus: 'placeholder' as const }
            : {}),
        });

        if (isDefaultFrameName(frame.name)) {
          Transforms.setNode(
            board,
            { name: getPPTPageFrameName(pageIndex) } as any,
            [frameIndex]
          );
        }
      });
    },
    [board]
  );

  const arrangePPTFramesByIds = useCallback(
    (
      orderedFrameIds: string[],
      startPosition: [number, number],
      columns: number
    ) => {
      if (!board) return;

      const orderedFrames: PlaitFrame[] = [];
      for (const frameId of orderedFrameIds) {
        const frame = board.children.find(
          (element) => element.id === frameId && isFrameElement(element)
        );
        if (frame && isFrameElement(frame)) {
          orderedFrames.push(frame);
        }
      }

      if (orderedFrames.length === 0) return;

      const safeColumns = sanitizePPTFrameLayoutColumns(columns);
      const frameAwareSelection = getFrameAwareSelection(board, orderedFrames);
      const movedElementIds = new Set<string>();

      orderedFrames.forEach((frame, index) => {
        const currentFrame = board.children.find(
          (element) => element.id === frame.id && isFrameElement(element)
        );
        if (!currentFrame || !isFrameElement(currentFrame)) return;

        const rect = RectangleClient.getRectangleByPoints(currentFrame.points);
        const targetPosition = getPPTFrameGridPosition(
          startPosition,
          index,
          safeColumns
        );
        moveElementWithFrameRelations(
          board,
          currentFrame,
          targetPosition[0] - rect.x,
          targetPosition[1] - rect.y,
          frameAwareSelection.relatedByFrameId,
          movedElementIds
        );
      });

      orderedFrameIds.forEach((frameId) => {
        const frame = board.children.find(
          (element) => element.id === frameId && isFrameElement(element)
        );
        if (frame && isFrameElement(frame)) {
          FrameTransforms.updateFrameMembers(board, frame);
        }
      });
    },
    [board]
  );

  const handleInsertPPTPage = useCallback(
    (frameInfo: FrameInfo, placement: PPTPageInsertPlacement) => {
      if (!board) return;
      if (!frameInfo.isRoot) {
        MessagePlugin.warning('暂不支持在嵌套 PPT 页面前后插入新页');
        return;
      }

      const orderedFrames = getOrderedPPTFrameInfos(rootFrames);
      const targetIndex = orderedFrames.findIndex(
        (info) => info.frame.id === frameInfo.frame.id
      );
      if (targetIndex === -1) {
        MessagePlugin.warning('未找到目标 PPT 页');
        return;
      }

      const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1;
      const frameRects = orderedFrames.map((info) =>
        RectangleClient.getRectangleByPoints(info.frame.points)
      );
      const targetRect = RectangleClient.getRectangleByPoints(
        frameInfo.frame.points
      );
      const startPosition: [number, number] = [
        Math.min(...frameRects.map((rect) => rect.x)),
        Math.min(...frameRects.map((rect) => rect.y)),
      ];
      const insertPosition = getPPTFrameGridPosition(
        startPosition,
        insertIndex,
        pptLayoutColumns
      );
      const frame = FrameTransforms.insertFrame(
        board,
        [
          insertPosition,
          [
            insertPosition[0] + targetRect.width,
            insertPosition[1] + targetRect.height,
          ],
        ],
        getPPTPageFrameName(insertIndex + 1)
      );
      setFramePPTMeta(board, frame.id, {
        pageIndex: insertIndex + 1,
        slideImageStatus: 'placeholder',
      });

      const orderedFrameIds = orderedFrames.map((info) => info.frame.id);
      orderedFrameIds.splice(insertIndex, 0, frame.id);
      reorderRootFramesByIds(orderedFrameIds);
      renumberPPTFrames(orderedFrameIds);
      arrangePPTFramesByIds(orderedFrameIds, startPosition, pptLayoutColumns);

      const insertedFrame =
        (board.children.find(
          (element) => element.id === frame.id && isFrameElement(element)
        ) as PlaitFrame | undefined) || frame;
      setSelectedFrameIds(new Set([frame.id]));
      setLastSelectedFrameId(frame.id);
      focusFrame(board, insertedFrame);
      MessagePlugin.success(
        placement === 'before'
          ? '已在前面插入新 PPT 页'
          : '已在后面插入新 PPT 页'
      );
    },
    [
      arrangePPTFramesByIds,
      board,
      pptLayoutColumns,
      renumberPPTFrames,
      reorderRootFramesByIds,
      rootFrames,
    ]
  );

  const handleFrameAdded = useCallback(
    (frame: PlaitFrame) => {
      if (!board) return;
      const pageIndex = board.children.filter((element) =>
        isFrameElement(element)
      ).length;
      setFramePPTMeta(board, frame.id, {
        pageIndex,
        slideImageStatus: 'placeholder',
      });
    },
    [board]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, frameInfo: FrameInfo) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedFrameIds.has(frameInfo.frame.id)) {
        setSelectedFrameIds(new Set([frameInfo.frame.id]));
        setLastSelectedFrameId(frameInfo.frame.id);
        syncCanvasSelectedFrames([frameInfo]);
      }
      openContextMenu(e, frameInfo);
    },
    [openContextMenu, selectedFrameIds, syncCanvasSelectedFrames]
  );

  const handleContextMenuAction = useCallback(
    (
      action:
        | 'rename'
        | 'duplicate'
        | 'insert-before'
        | 'insert-after'
        | 'delete',
      frameInfo: FrameInfo
    ) => {
      if (action === 'rename') {
        setEditingKey(frameInfo.listKey);
        setEditingName(getFrameDisplayName(frameInfo.frame));
      }
      if (action === 'duplicate') {
        handleDuplicate(frameInfo);
      }
      if (action === 'insert-before') {
        handleInsertPPTPage(frameInfo, 'before');
      }
      if (action === 'insert-after') {
        handleInsertPPTPage(frameInfo, 'after');
      }
      if (action === 'delete') {
        void handleDelete(frameInfo);
      }
      closeContextMenu();
    },
    [handleDelete, handleDuplicate, handleInsertPPTPage, closeContextMenu]
  );

  const handleUseHistoryImage = useCallback(
    async (
      frameInfo: FrameInfo,
      historyItem: PPTSlideImageHistoryItem
    ) => {
      if (!board) return;

      const currentSlideImage = findPPTSlideImage(board, frameInfo.frame.id);
      const historyElementIndex = historyItem.elementId
        ? board.children.findIndex(
            (element: any) =>
              element.id === historyItem.elementId &&
              element.type === 'image'
          )
        : -1;

      try {
        if (historyItem.elementId && historyElementIndex !== -1) {
          replacePPTSlideImage(
            board,
            frameInfo.frame.id,
            historyItem.elementId,
            historyItem.imageUrl,
            {
              replaceElementId: currentSlideImage?.elementId,
              prompt: historyItem.prompt || frameInfo.slidePrompt,
            }
          );
        } else {
          const insertResult = await insertMediaIntoFrame(
            board,
            historyItem.imageUrl,
            'image',
            frameInfo.frame.id,
            {
              width: frameInfo.width,
              height: frameInfo.height,
            },
            {
              width: frameInfo.width,
              height: frameInfo.height,
            },
            undefined,
            { fit: 'stretch' }
          );

          if (!insertResult?.elementId) {
            MessagePlugin.error('历史图片插入失败');
            return;
          }

          replacePPTSlideImage(
            board,
            frameInfo.frame.id,
            insertResult.elementId,
            historyItem.imageUrl,
            {
              replaceElementId: currentSlideImage?.elementId,
              prompt: historyItem.prompt || frameInfo.slidePrompt,
            }
          );
        }

        MessagePlugin.success('已切换到历史图片');
      } catch (error) {
        console.error('[FramePanel] Failed to use history image:', error);
        MessagePlugin.error('切换历史图片失败');
      }
    },
    [board]
  );

  const contextMenuItems = useMemo<ContextMenuEntry<FrameInfo>[]>(
    () => [
      {
        key: 'rename',
        label: '重命名',
        icon: <EditIcon />,
        onSelect: (frameInfo) => handleContextMenuAction('rename', frameInfo),
      },
      {
        key: 'duplicate',
        label: '复制',
        icon: <FileCopyIcon />,
        onSelect: (frameInfo) =>
          handleContextMenuAction('duplicate', frameInfo),
      },
      {
        key: 'insert-before',
        label: '在前面插入新页',
        icon: <AddIcon />,
        disabled: (frameInfo) => !frameInfo.isRoot,
        onSelect: (frameInfo) =>
          handleContextMenuAction('insert-before', frameInfo),
      },
      {
        key: 'insert-after',
        label: '在后面插入新页',
        icon: <AddIcon />,
        disabled: (frameInfo) => !frameInfo.isRoot,
        onSelect: (frameInfo) =>
          handleContextMenuAction('insert-after', frameInfo),
      },
      {
        key: 'image-history',
        type: 'submenu',
        label: '生图历史',
        icon: <ImageIcon />,
        disabled: (frameInfo) => getSlideImageHistory(frameInfo).length === 0,
        children: (frameInfo) =>
          getSlideImageHistory(frameInfo).map((historyItem, index) => ({
            key: historyItem.id || `history-${index}`,
            label: (
              <PPTSlideHistoryMenuLabel
                item={historyItem}
                index={index}
              />
            ),
            onSelect: () => {
              void handleUseHistoryImage(frameInfo, historyItem);
            },
          })),
      },
      { key: 'divider-1', type: 'divider' },
      {
        key: 'delete',
        label: (frameInfo) =>
          selectedFrameIds.size > 1 &&
          selectedFrameIds.has(frameInfo.frame.id)
            ? `删除选中 ${selectedFrameIds.size} 项`
            : '删除',
        icon: <DeleteIcon />,
        danger: true,
        onSelect: (frameInfo) => handleContextMenuAction('delete', frameInfo),
      },
    ],
    [handleContextMenuAction, handleUseHistoryImage, selectedFrameIds]
  );

  const handleRegenerateSlide = useCallback(
    (frameInfo: FrameInfo, e?: React.MouseEvent) => {
      e?.stopPropagation();

      openDialog(DialogType.aiImageGeneration, {
        initialPrompt: frameInfo.slidePrompt || '',
        initialImages: frameInfo.slideImageUrl
          ? [
              {
                url: frameInfo.slideImageUrl,
                name: `${frameInfo.frame.name || 'slide'}-reference.png`,
              },
            ]
          : [],
        initialAspectRatio: '16x9',
        initialWidth: frameInfo.width,
        initialHeight: frameInfo.height,
        targetFrameId: frameInfo.frame.id,
        targetFrameDimensions: {
          width: frameInfo.width,
          height: frameInfo.height,
        },
        autoInsertToCanvas: true,
        pptSlideImage: true,
        pptReplaceElementId: frameInfo.slideImageElementId,
      });
    },
    [openDialog]
  );

  // 导出所有 PPT 页面为一个 PPT 文件
  const handleExportAllPPT = useCallback(async () => {
    if (!board) return;
    if (frames.length === 0) {
      MessagePlugin.info('当前没有可导出的 PPT 页面');
      return;
    }

    if (isExportingAllPPT) return;
    setIsExportingAllPPT(true);
    try {
      await exportAllPPTFrames(board, { fileName: 'aitu-ppt' });
      MessagePlugin.success(`已导出 ${frames.length} 页 PPT`);
    } catch (error) {
      console.error('[FramePanel] Export all PPT failed:', error);
      MessagePlugin.error('PPT 导出失败');
    } finally {
      setIsExportingAllPPT(false);
    }
  }, [board, isExportingAllPPT, frames]);

  if (!board) {
    return (
      <div className="frame-panel__empty">
        <p>画布未初始化</p>
      </div>
    );
  }

  return (
    <div className="frame-panel">
      {/* 搜索 */}
      <div className="frame-panel__filter">
        <Input
          placeholder="搜索 PPT 页面..."
          value={searchQuery}
          onChange={setSearchQuery}
          prefixIcon={<SearchIcon />}
          size="small"
        />
      </div>

      {/* 操作栏：icon + hover 文字 */}
      <div className="frame-panel__actions">
        <HoverTip content="添加 PPT 页面">
          <Button
            variant="outline"
            size="small"
            shape="square"
            icon={<AddIcon />}
            onClick={() => setAddDialogVisible(true)}
          />
        </HoverTip>
        <HoverTip
          content={frames.length === 0 ? '没有 PPT 页面可播放' : '播放 PPT'}
        >
          <Button
            variant="outline"
            size="small"
            shape="square"
            icon={<PlayCircleIcon />}
            disabled={frames.length === 0}
            onClick={() => setSlideshowVisible(true)}
          />
        </HoverTip>
        {frames.length > 0 && (
          <HoverTip
            content={
              isExportingAllPPT ? '正在导出 PPT...' : '导出所有 PPT 页面'
            }
          >
            <Button
              variant="outline"
              size="small"
              shape="square"
              icon={
                isExportingAllPPT ? (
                  <Loading size="small" />
                ) : (
                  <DownloadIcon size={16} />
                )
              }
              disabled={isExportingAllPPT}
              onClick={handleExportAllPPT}
            />
          </HoverTip>
        )}
        {frames.length > 0 && (
          <Dropdown
            trigger="click"
            options={pptLayoutMenuOptions}
            onClick={handlePPTLayoutMenuClick}
            minColumnWidth={120}
          >
            <HoverTip content={`排列 PPT 页面（当前每行 ${pptLayoutColumns} 个）`}>
              <Button
                variant="outline"
                size="small"
                shape="square"
                icon={<LayoutGrid size={16} />}
                onClick={() => handleArrangePPTFrames(pptLayoutColumns)}
              />
            </HoverTip>
          </Dropdown>
        )}
      </div>

      {/* PPT 页面列表 */}
      {filteredFrames.length === 0 ? (
        <div className="frame-panel__empty">
          <div className="frame-panel__empty-icon" aria-hidden="true">
            {frames.length === 0 ? (
              <Presentation size={24} strokeWidth={1.8} />
            ) : (
              <SearchIcon />
            )}
          </div>
          <div className="frame-panel__empty-copy">
            {frames.length === 0 ? (
              <>
                <p className="frame-panel__empty-title">
                  当前画布没有 PPT 页面
                </p>
                <p className="frame-panel__empty-hint">
                  可以通过“生成完整PPT”的 SKILL 进行创建
                </p>
              </>
            ) : (
              <p className="frame-panel__empty-title">未找到匹配的 PPT 页面</p>
            )}
          </div>
        </div>
      ) : (
        <div className="frame-panel__list">
          {filteredFrames.map((info) => {
            const dragProps = getFrameDragProps(info);
            return (
              <div
                key={info.listKey}
                className={classNames('frame-panel__item', {
                  'frame-panel__item--active':
                    selectedFrameIds.has(info.frame.id),
                  'frame-panel__item--dragging': dragProps['data-dragging'],
                  'frame-panel__item--drag-over': dragProps['data-drag-over'],
                  'frame-panel__item--drag-before':
                    dragProps['data-drag-position'] === 'before',
                  'frame-panel__item--drag-after':
                    dragProps['data-drag-position'] === 'after',
                })}
                onClick={(e) => handleFrameClick(info, e)}
                onContextMenu={(e) => handleContextMenu(e, info)}
                {...dragProps}
              >
                {info.pptMeta ? (
                  <PPTSlidePreview
                    imageUrl={info.slideImageUrl}
                    title={getFrameDisplayName(info.frame)}
                    status={
                      info.pptMeta.slideImageStatus || info.pptMeta.imageStatus
                    }
                  />
                ) : (
                  <div className="frame-panel__item-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="13"
                        height="13"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeDasharray="3 2"
                        fill="none"
                      />
                    </svg>
                  </div>
                )}

                <div className="frame-panel__item-content">
                  {editingKey === info.listKey ? (
                    <Input
                      value={editingName}
                      onChange={setEditingName}
                      size="small"
                      autofocus
                      onBlur={() => handleFinishRename(info)}
                      onEnter={() => handleFinishRename(info)}
                      onClick={(context: { e: React.MouseEvent }) =>
                        context.e.stopPropagation()
                      }
                    />
                  ) : (
                    <>
                      <span className="frame-panel__item-name">
                        {getFrameDisplayName(info.frame)}
                      </span>
                      <span className="frame-panel__item-meta">
                        {info.width} × {info.height}
                        {info.childCount > 0 && ` · ${info.childCount} 个元素`}
                      </span>
                    </>
                  )}
                </div>

                <div className="frame-panel__item-actions">
                  {info.pptMeta && (
                    <HoverTip
                      content={info.slidePrompt ? '重新生成' : 'AI 图片生成'}
                    >
                      <Button
                        variant="text"
                        size="small"
                        shape="square"
                        icon={<AIImageIcon size={16} />}
                        onClick={(e) =>
                          handleRegenerateSlide(
                            info,
                            e as unknown as React.MouseEvent
                          )
                        }
                      />
                    </HoverTip>
                  )}
                  <HoverTip content="重命名" showArrow={false}>
                    <Button
                      variant="text"
                      size="small"
                      shape="square"
                      icon={<EditIcon />}
                      onClick={(e) =>
                        handleStartRename(
                          info,
                          e as unknown as React.MouseEvent
                        )
                      }
                    />
                  </HoverTip>
                  <HoverTip
                    content={
                      selectedFrameIds.size > 1 &&
                      selectedFrameIds.has(info.frame.id)
                        ? `删除选中 ${selectedFrameIds.size} 项`
                        : '删除'
                    }
                    showArrow={false}
                  >
                    <Button
                      variant="text"
                      size="small"
                      shape="square"
                      theme="danger"
                      icon={<DeleteIcon />}
                      onClick={(e) =>
                        void handleDelete(
                          info,
                          e as unknown as React.MouseEvent
                        )
                      }
                    />
                  </HoverTip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ContextMenu
        state={contextMenu}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />

      {/* 添加 PPT 页面弹窗 */}
      <AddFrameDialog
        visible={addDialogVisible}
        board={board}
        onClose={() => setAddDialogVisible(false)}
        onFrameAdded={handleFrameAdded}
      />

      {/* 幻灯片播放 */}
      <FrameSlideshow
        visible={slideshowVisible}
        board={board}
        onClose={() => setSlideshowVisible(false)}
      />
      {confirmDialog}
    </div>
  );
};
