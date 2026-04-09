/**
 * 文本生成 MCP 工具
 *
 * 复用现有文本模型执行链，为 AI 输入栏文本模式提供统一工具入口。
 */

import type {
  MCPExecuteOptions,
  MCPResult,
  MCPTaskResult,
  MCPTool,
} from '../types';
import { executorFactory } from '../../services/media-executor';
import { taskQueueService } from '../../services/task-queue';
import { TaskType } from '../../types/task.types';
import { geminiSettings, type ModelRef } from '../../utils/settings-manager';
import { getDefaultTextModel } from '../../constants/model-config';

export interface TextGenerationParams {
  prompt: string;
  model?: string;
  modelRef?: ModelRef | null;
  referenceImages?: string[];
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
  globalIndex?: number;
  autoInsertToCanvas?: boolean;
  params?: Record<string, unknown>;
}

export function getCurrentTextModel(): string {
  const settings = geminiSettings.get();
  return settings?.textModelName || getDefaultTextModel();
}

async function executeAsync(
  params: TextGenerationParams,
  options: MCPExecuteOptions = {}
): Promise<MCPResult> {
  if (!params.prompt || typeof params.prompt !== 'string') {
    return {
      success: false,
      error: '缺少必填参数 prompt',
      type: 'error',
    };
  }

  try {
    const fallbackExecutor = executorFactory.getFallbackExecutor();
    const result = await fallbackExecutor.generateText(
      {
        prompt: params.prompt,
        model: params.model || getCurrentTextModel(),
        modelRef: params.modelRef || null,
        referenceImages: params.referenceImages,
        params: params.params,
      },
      options
    );

    return {
      success: true,
      data: result,
      type: 'text',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '文本生成失败',
      type: 'error',
    };
  }
}

function executeQueue(
  params: TextGenerationParams,
  options: MCPExecuteOptions = {}
): MCPTaskResult {
  if (!params.prompt || typeof params.prompt !== 'string') {
    return {
      success: false,
      error: '缺少必填参数 prompt',
      type: 'error',
    };
  }

  try {
    const task = taskQueueService.createTask(
      {
        prompt: params.prompt,
        model: params.model || getCurrentTextModel(),
        modelRef: params.modelRef || null,
        referenceImages: params.referenceImages,
        batchId: params.batchId || options.batchId,
        batchIndex: params.batchIndex ?? 1,
        batchTotal: params.batchTotal ?? 1,
        globalIndex: params.globalIndex ?? options.globalIndex ?? 1,
        autoInsertToCanvas: params.autoInsertToCanvas ?? true,
        ...(params.params ? { params: params.params } : {}),
      },
      TaskType.CHAT
    );

    return {
      success: true,
      data: {
        taskId: task.id,
        prompt: params.prompt,
        model: params.model || getCurrentTextModel(),
      },
      type: 'text',
      taskId: task.id,
      task,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '文本任务创建失败',
      type: 'error',
    };
  }
}

export async function generateText(
  params: TextGenerationParams,
  options: MCPExecuteOptions = {}
): Promise<MCPResult> {
  const mode = options.mode || 'async';
  if (mode === 'queue') {
    return executeQueue(params, options);
  }
  return executeAsync(params, options);
}

export const textGenerationTool: MCPTool = {
  name: 'generate_text',
  description: '生成纯文本内容，可用于文章、摘要、说明、Markdown 等文本直出场景',
  supportedModes: ['async', 'queue'],
  execute: async (
    params: Record<string, unknown>,
    options?: MCPExecuteOptions
  ) => generateText(params as TextGenerationParams, options),
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '文本生成提示词',
      },
      model: {
        type: 'string',
        description: '文本模型 ID，默认使用当前文本路由模型',
      },
      referenceImages: {
        type: 'array',
        description: '参考图片 URL 列表，用于图像理解后输出文本',
        items: {
          type: 'string',
        },
      },
      params: {
        type: 'object',
        description: '文本模型额外参数，如 temperature、top_p、max_tokens',
      },
    },
    required: ['prompt'],
  },
};
