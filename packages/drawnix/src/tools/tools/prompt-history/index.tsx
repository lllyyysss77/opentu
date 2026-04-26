import React, { lazy, Suspense, type CSSProperties } from 'react';
import { History } from 'lucide-react';
import type { ToolPluginModule } from '../../registry';
import { ToolCategory } from '../../../types/toolbox.types';

const PromptHistoryTool = lazy(
  () => import('../../../components/prompt-history/PromptHistoryTool')
);

const containerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 200,
      color: '#999',
      fontSize: 14,
    }}
  >
    加载中...
  </div>
);

export const PromptHistoryToolComponent: React.FC<Record<string, unknown>> = () => (
  <div style={containerStyle}>
    <Suspense fallback={<LoadingFallback />}>
      <PromptHistoryTool />
    </Suspense>
  </div>
);

export const promptHistoryTool: ToolPluginModule = {
  manifest: {
    id: 'prompt-history',
    name: '我的提示词',
    description: '按任务分类管理初始提示词、发送提示词和生成结果预览',
    icon: <History size={18} strokeWidth={1.75} />,
    category: ToolCategory.CONTENT_TOOLS,
    component: 'prompt-history',
    defaultWidth: 1120,
    defaultHeight: 680,
  },
  Component: PromptHistoryToolComponent,
};
