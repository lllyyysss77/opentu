import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useImageGenerationAnchorController } from '../../hooks/useImageGenerationAnchorController';
import { getCanvasBoard } from '../../services/canvas-operations';
import { ImageGenerationAnchorTransforms } from '../../plugins/with-image-generation-anchor';
import {
  IMAGE_GENERATION_ANCHOR_RETRY_EVENT,
  type ImageGenerationAnchorActionType,
  type PlaitImageGenerationAnchor,
} from '../../types/image-generation-anchor.types';
import { buildImageGenerationAnchorPresentationPatch } from '../../utils/image-generation-anchor-state';
import './image-generation-anchor.scss';

interface ImageGenerationAnchorContentProps {
  element: PlaitImageGenerationAnchor;
  selected: boolean;
}

export const ImageGenerationAnchorContent: React.FC<
  ImageGenerationAnchorContentProps
> = ({ element, selected }) => {
  const { viewModel } = useImageGenerationAnchorController({ anchor: element });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isGhost = viewModel.anchorType === 'ghost';
  const isFrameLike =
    viewModel.anchorType === 'frame' || viewModel.anchorType === 'ratio';
  const isStack = viewModel.anchorType === 'stack';
  const showActions =
    !isGhost || viewModel.phase === 'failed' || detailsOpen;
  const progressValue =
    viewModel.progress != null
      ? `${Math.round(viewModel.progress)}%`
      : viewModel.phase === 'failed'
      ? '!'
      : '...';
  const progressWidth = `${viewModel.progress ?? (viewModel.phase === 'failed' ? 100 : 24)}%`;
  const primaryActionLabel = detailsOpen &&
    viewModel.primaryAction.type === 'details'
    ? '收起'
    : viewModel.primaryAction.label;
  const secondaryActionLabel = detailsOpen &&
    viewModel.secondaryAction?.type === 'details'
    ? '收起'
    : viewModel.secondaryAction?.label;
  const secondaryActionType = viewModel.secondaryAction?.type;
  const detailItems = useMemo(
    () => [
      { label: '阶段', value: viewModel.phaseLabel },
      { label: '类型', value: viewModel.anchorType },
      {
        label: '任务',
        value: element.primaryTaskId || (element.taskIds[0] ?? '待绑定'),
      },
      { label: '工作流', value: element.workflowId },
    ],
    [
      element.primaryTaskId,
      element.taskIds,
      element.workflowId,
      viewModel.anchorType,
      viewModel.phaseLabel,
    ]
  );

  const stopPointer = useCallback((event: React.PointerEvent | React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  const handleAction = useCallback(
    (actionType: ImageGenerationAnchorActionType) => {
      if (actionType === 'none') {
        return;
      }

      if (actionType === 'details') {
        setDetailsOpen((value) => !value);
        return;
      }

      if (actionType === 'retry') {
        const taskId = element.primaryTaskId || element.taskIds[0];
        if (!taskId) {
          return;
        }

        const board = getCanvasBoard();
        if (board) {
          ImageGenerationAnchorTransforms.updateAnchor(
            board,
            element.id,
            buildImageGenerationAnchorPresentationPatch('retrying')
          );
        }

        window.dispatchEvent(
          new CustomEvent(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, {
            detail: { taskId },
          })
        );
        return;
      }

      if (actionType === 'dismiss') {
        const board = getCanvasBoard();
        if (board) {
          ImageGenerationAnchorTransforms.removeAnchor(board, element.id);
        }
      }
    },
    [element.id, element.primaryTaskId, element.taskIds]
  );

  return (
    <div
      className={classNames(
        'image-generation-anchor',
        `image-generation-anchor--${viewModel.anchorType}`,
        `image-generation-anchor--${viewModel.tone}`,
        `image-generation-anchor--phase-${viewModel.phase}`,
        {
          'image-generation-anchor--selected': selected,
          'image-generation-anchor--terminal': viewModel.isTerminal,
          'image-generation-anchor--details-open': detailsOpen,
        }
      )}
    >
      <div className="image-generation-anchor__glow" />
      {isGhost ? (
        <>
          <div className="image-generation-anchor__ghost">
            <div className="image-generation-anchor__ghost-ring" />
            <div className="image-generation-anchor__ghost-core">
              <span className="image-generation-anchor__ghost-label">
                {viewModel.phaseLabel}
              </span>
              <span className="image-generation-anchor__ghost-value">
                {progressValue}
              </span>
            </div>
          </div>

          <div className="image-generation-anchor__ghost-copy">
            <span className="image-generation-anchor__title">
              {viewModel.title}
            </span>
            <span className="image-generation-anchor__subtitle">
              {viewModel.subtitle}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="image-generation-anchor__header">
            <div className="image-generation-anchor__heading">
              <span className="image-generation-anchor__eyebrow">
                {isFrameLike
                  ? '结果外壳'
                  : isStack
                  ? '候选组'
                  : '结果锚点'}
              </span>
              <span className="image-generation-anchor__title">
                {viewModel.title}
              </span>
            </div>
            <span className="image-generation-anchor__phase">
              {viewModel.phaseLabel}
            </span>
          </div>

          <div className="image-generation-anchor__surface">
            <div className="image-generation-anchor__surface-grid" />
            <div className="image-generation-anchor__surface-status">
              <span className="image-generation-anchor__badge">
                {viewModel.anchorType}
              </span>
              <span className="image-generation-anchor__badge">
                {viewModel.transitionMode}
              </span>
            </div>
            <div className="image-generation-anchor__surface-center">
              <span className="image-generation-anchor__surface-title">
                {viewModel.phaseLabel}
              </span>
              <span className="image-generation-anchor__surface-subtitle">
                {viewModel.subtitle}
              </span>
            </div>
            {isStack ? (
              <div className="image-generation-anchor__stack-layers">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="image-generation-anchor__progress">
        <div className="image-generation-anchor__progress-bar">
          <span
            className="image-generation-anchor__progress-fill"
            style={{ width: progressWidth }}
          />
        </div>
        <span className="image-generation-anchor__progress-value">
          {progressValue}
        </span>
      </div>

      {viewModel.error ? (
        <div className="image-generation-anchor__error">{viewModel.error}</div>
      ) : null}

      {detailsOpen ? (
        <div className="image-generation-anchor__details">
          {detailItems.map((item) => (
            <div key={item.label} className="image-generation-anchor__detail-row">
              <span className="image-generation-anchor__detail-label">
                {item.label}
              </span>
              <span className="image-generation-anchor__detail-value">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {showActions ? (
        <div className="image-generation-anchor__actions">
          <button
            type="button"
            className="image-generation-anchor__action"
            onPointerDown={stopPointer}
            onMouseDown={stopPointer}
            onClick={(event) => {
              stopPointer(event);
              handleAction(viewModel.primaryAction.type);
            }}
          >
            {primaryActionLabel}
          </button>
          {viewModel.secondaryAction ? (
            <button
              type="button"
              className="image-generation-anchor__action image-generation-anchor__action--secondary"
              onPointerDown={stopPointer}
              onMouseDown={stopPointer}
              onClick={(event) => {
                stopPointer(event);
                if (secondaryActionType) {
                  handleAction(secondaryActionType);
                }
              }}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
