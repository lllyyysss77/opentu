import React from 'react';
import { WorkflowStepBar, type WorkflowStepConfig } from './WorkflowStepBar';

export interface WorkflowNavBarProps<TStepId extends string> {
  isHistoryPage: boolean;
  showStarred: boolean;
  recordsCount: number;
  starredCount: number;
  currentStep: string;
  steps: readonly WorkflowStepConfig<TStepId>[];
  onStepNavigate: (step: TStepId) => void;
  onBackFromHistory: () => void;
  onOpenHistory: () => void;
  onOpenStarred: () => void;
  onToggleStarred: () => void;
}

export function WorkflowNavBar<TStepId extends string>({
  isHistoryPage,
  showStarred,
  recordsCount,
  starredCount,
  currentStep,
  steps,
  onStepNavigate,
  onBackFromHistory,
  onOpenHistory,
  onOpenStarred,
  onToggleStarred,
}: WorkflowNavBarProps<TStepId>): React.ReactElement {
  return (
    <div className="va-nav">
      {isHistoryPage ? (
        <>
          <button className="va-nav-back" onClick={onBackFromHistory}>
            ←
          </button>
          <span className="va-nav-title">
            {showStarred ? '收藏' : '历史记录'}
          </span>
          <button
            className={`va-nav-btn ${showStarred ? 'active' : ''}`}
            onClick={onToggleStarred}
          >
            {showStarred ? '★ 收藏' : '☆ 全部'}
          </button>
        </>
      ) : (
        <>
          <WorkflowStepBar
            current={currentStep}
            onNavigate={onStepNavigate}
            steps={steps}
          />
          <div className="va-nav-actions">
            <button className="va-nav-btn" onClick={onOpenHistory}>
              <span role="img" aria-label="history">
                📋
              </span>
              {recordsCount > 0 && (
                <span className="va-nav-count">{recordsCount}</span>
              )}
            </button>
            <button className="va-nav-btn" onClick={onOpenStarred}>
              <span role="img" aria-label="starred">
                ⭐
              </span>
              {starredCount > 0 && (
                <span className="va-nav-count">{starredCount}</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
