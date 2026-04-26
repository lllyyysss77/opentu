import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Sparkles, X } from 'lucide-react';
import { MessagePlugin } from 'tdesign-react';
import { executorFactory } from '../../services/media-executor';
import { ModelDropdown } from '../ai-input-bar/ModelDropdown';
import { useSelectableModels } from '../../hooks/use-runtime-models';
import {
  createModelRef,
  resolveInvocationRoute,
  type ModelRef,
} from '../../utils/settings-manager';
import { LS_KEYS } from '../../constants/storage-keys';
import { getPinnedSelectableModel } from '../../utils/runtime-model-discovery';
import {
  findMatchingSelectableModel,
  getModelRefFromConfig,
  getSelectionKey,
} from '../../utils/model-selection';
import {
  readStoredModelSelection,
  writeStoredModelSelection,
} from './workflow/model-selection-storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeading,
} from '../dialog/dialog';
import {
  buildPromptOptimizationRequest,
  normalizeOptimizedPromptResult,
} from '../ttd-dialog/shared/ai-generation-utils';
import './prompt-optimize-dialog.scss';

export type PromptOptimizeMode = 'polish' | 'structured';
export type PromptOptimizeType = 'image' | 'video' | 'audio' | 'text' | 'agent';

interface PromptOptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPrompt: string;
  language: 'zh' | 'en';
  type: PromptOptimizeType;
  onApply: (prompt: string) => void;
  allowStructuredMode?: boolean;
  defaultMode?: PromptOptimizeMode;
}

export const PromptOptimizeDialog: React.FC<PromptOptimizeDialogProps> = ({
  open,
  onOpenChange,
  originalPrompt,
  language,
  type,
  onApply,
  allowStructuredMode = false,
  defaultMode = 'polish',
}) => {
  const currentPromptId = useId();
  const requirementsId = useId();
  const draftPromptId = useId();
  const [requirements, setRequirements] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState(originalPrompt);
  const [optimizedDraft, setOptimizedDraft] = useState('');
  const [mode, setMode] = useState<PromptOptimizeMode>(defaultMode);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const optimizationAbortRef = useRef<AbortController | null>(null);

  const textModels = useSelectableModels('text');

  const resolveStoredOptimizerModel = useCallback(() => {
    const route = resolveInvocationRoute('text');
    const routeModelRef = createModelRef(route.profileId, route.modelId);
    const fallbackModelId = route.modelId || textModels[0]?.id || '';
    const fallbackModelRef =
      routeModelRef ||
      (fallbackModelId ? createModelRef(null, fallbackModelId) : null);
    const stored = readStoredModelSelection(
      LS_KEYS.PROMPT_OPTIMIZE_TEXT_MODEL,
      fallbackModelId,
      fallbackModelRef
    );
    const matchedModel =
      findMatchingSelectableModel(textModels, stored.modelId, stored.modelRef) ||
      getPinnedSelectableModel('text', stored.modelId, stored.modelRef);
    const modelId = matchedModel?.id || stored.modelId || fallbackModelId;
    const modelRef =
      getModelRefFromConfig(matchedModel) ||
      stored.modelRef ||
      fallbackModelRef ||
      (modelId ? createModelRef(null, modelId) : null);

    return { modelId, modelRef };
  }, [textModels]);

  const [optimizerModel, setOptimizerModel] = useState(
    () => resolveStoredOptimizerModel().modelId
  );
  const [optimizerModelRef, setOptimizerModelRef] = useState<ModelRef | null>(
    () => resolveStoredOptimizerModel().modelRef
  );

  const visibleTextModels = useMemo(() => {
    const matchedModel = findMatchingSelectableModel(
      textModels,
      optimizerModel,
      optimizerModelRef
    );
    if (matchedModel || !optimizerModel) {
      return textModels;
    }

    const pinnedModel = getPinnedSelectableModel(
      'text',
      optimizerModel,
      optimizerModelRef
    );
    return pinnedModel ? [pinnedModel, ...textModels] : textModels;
  }, [optimizerModel, optimizerModelRef, textModels]);

  const syncOptimizerModelFromStorage = useCallback(() => {
    const nextSelection = resolveStoredOptimizerModel();
    setOptimizerModel(nextSelection.modelId);
    setOptimizerModelRef(nextSelection.modelRef);
  }, [resolveStoredOptimizerModel]);

  const handleClose = useCallback(() => {
    optimizationAbortRef.current?.abort();
    optimizationAbortRef.current = null;
    setIsOptimizing(false);
    setRequirements('');
    setOptimizedDraft('');
    setMode(defaultMode);
    onOpenChange(false);
  }, [defaultMode, onOpenChange]);

  const handleOptimizePrompt = useCallback(async () => {
    const rawPrompt = currentPrompt.trim();
    if (!rawPrompt) {
      MessagePlugin.warning(
        language === 'zh'
          ? '请先填写当前提示词'
          : 'Please enter the current prompt first'
      );
      return;
    }

    const controller = new AbortController();
    optimizationAbortRef.current?.abort();
    optimizationAbortRef.current = controller;
    setIsOptimizing(true);

    try {
      const optimizedPrompt = normalizeOptimizedPromptResult(
        (
          await executorFactory.getFallbackExecutor().generateText(
            {
              prompt: buildPromptOptimizationRequest({
                originalPrompt: rawPrompt,
                optimizationRequirements: requirements,
                language,
                type,
                mode,
              }),
              model: optimizerModel || undefined,
              modelRef: optimizerModelRef,
            },
            {
              signal: controller.signal,
            }
          )
        ).content
      );

      if (!optimizedPrompt) {
        throw new Error('Empty optimized prompt');
      }

      setOptimizedDraft(optimizedPrompt);
      MessagePlugin.success(
        language === 'zh'
          ? mode === 'structured'
            ? '结构化提示词已生成，可继续优化或回填'
            : '提示词优化完成，可继续优化或回填'
          : mode === 'structured'
          ? 'Structured prompt generated. You can refine again or apply it.'
          : 'Prompt optimized. You can refine again or apply it.'
      );
      setRequirements('');
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('[PromptOptimizeDialog] Failed to optimize prompt:', error);
      MessagePlugin.error(
        language === 'zh'
          ? mode === 'structured'
            ? '结构化提示词生成失败，请稍后重试'
            : '提示词优化失败，请稍后重试'
          : mode === 'structured'
          ? 'Failed to generate structured prompt, please try again later'
          : 'Failed to optimize prompt, please try again later'
      );
    } finally {
      if (optimizationAbortRef.current === controller) {
        optimizationAbortRef.current = null;
      }
      setIsOptimizing(false);
    }
  }, [
    currentPrompt,
    language,
    mode,
    optimizerModel,
    optimizerModelRef,
    requirements,
    type,
  ]);

  const handleUseDraftAsCurrent = useCallback(() => {
    const draft = optimizedDraft.trim();
    if (!draft) {
      return;
    }
    setCurrentPrompt(draft);
    setRequirements('');
  }, [optimizedDraft]);

  const handleApplyPrompt = useCallback(() => {
    const promptToApply = optimizedDraft.trim();
    if (!promptToApply) {
      MessagePlugin.warning(
        language === 'zh'
          ? '没有可回填的提示词'
          : 'There is no prompt to apply'
      );
      return;
    }
    onApply(promptToApply);
    handleClose();
  }, [handleClose, language, onApply, optimizedDraft]);

  useEffect(() => {
    if (!open) {
      return;
    }
    syncOptimizerModelFromStorage();
    setCurrentPrompt(originalPrompt);
    setOptimizedDraft('');
    setRequirements('');
    setMode(defaultMode);
  }, [defaultMode, open, originalPrompt, syncOptimizerModelFromStorage]);

  useEffect(() => {
    return () => {
      optimizationAbortRef.current?.abort();
      optimizationAbortRef.current = null;
    };
  }, []);

  const description =
    language === 'zh'
      ? mode === 'structured'
        ? '把需求整理成可复用的 JSON 结构化提示词，结果先生成草稿，不会自动回填。'
        : '编辑当前提示词并输入优化方向，结果先生成草稿，不会自动回填。'
      : mode === 'structured'
      ? 'Turn the request into a reusable JSON structured prompt. The result is drafted here and will not apply automatically.'
      : 'Edit the current prompt and describe how to refine it. The result is drafted here and will not apply automatically.';

  const requirementsPlaceholder =
    language === 'zh'
      ? mode === 'structured'
        ? '例如：突出时间轴结构、把区域与数量拆开、保留标题与图例、输出 JSON 不要解释...'
        : '例如：更电影感、补充镜头语言、减少冗余、强调主体与光线...'
      : mode === 'structured'
      ? 'For example: emphasize timeline structure, split regions and counts, preserve titles and legends, output JSON only...'
      : 'For example: make it more cinematic, add camera language, reduce redundancy, emphasize subject and lighting...';
  const canOptimize = currentPrompt.trim().length > 0;
  const canApply = optimizedDraft.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
        className={`Dialog prompt-optimize-dialog ${
          optimizedDraft ? 'prompt-optimize-dialog--split' : ''
        }`}
      >
        <div className="prompt-optimize-dialog__header">
          <div className="prompt-optimize-dialog__headline">
            <DialogHeading className="prompt-optimize-dialog__title">
              {language === 'zh'
                ? mode === 'structured'
                  ? '结构化提示词'
                  : '提示词优化'
                : mode === 'structured'
                ? 'Structured Prompt'
                : 'Prompt Optimization'}
            </DialogHeading>
            <DialogDescription className="prompt-optimize-dialog__description">
              {description}
            </DialogDescription>
          </div>
          <button
            type="button"
            className="prompt-optimize-dialog__close"
            onClick={handleClose}
            aria-label={language === 'zh' ? '关闭' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <div
          className={`prompt-optimize-dialog__body ${
            optimizedDraft ? 'prompt-optimize-dialog__body--split' : ''
          }`}
        >
          <div className="prompt-optimize-dialog__form-pane">
            {allowStructuredMode && (
              <div className="prompt-optimize-dialog__section">
                <span className="prompt-optimize-dialog__label">
                  {language === 'zh' ? '输出模式' : 'Output Mode'}
                </span>
                <div className="prompt-optimize-dialog__mode-switch">
                  <button
                    type="button"
                    className={`prompt-optimize-dialog__mode-btn ${
                      mode === 'polish'
                        ? 'prompt-optimize-dialog__mode-btn--active'
                        : ''
                    }`}
                    onClick={() => setMode('polish')}
                    disabled={isOptimizing}
                  >
                    <Sparkles size={14} />
                    <span>{language === 'zh' ? '普通润色' : 'Polish'}</span>
                  </button>
                  <button
                    type="button"
                    className={`prompt-optimize-dialog__mode-btn ${
                      mode === 'structured'
                        ? 'prompt-optimize-dialog__mode-btn--active'
                        : ''
                    }`}
                    onClick={() => setMode('structured')}
                    disabled={isOptimizing}
                  >
                    <span>
                      {language === 'zh' ? '结构化 JSON' : 'Structured JSON'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="prompt-optimize-dialog__section">
              <label
                className="prompt-optimize-dialog__label"
                htmlFor={currentPromptId}
              >
                {language === 'zh' ? '当前提示词' : 'Current Prompt'}
              </label>
              <textarea
                id={currentPromptId}
                className="prompt-optimize-dialog__textarea prompt-optimize-dialog__textarea--current"
                value={currentPrompt}
                onChange={(event) => setCurrentPrompt(event.target.value)}
                placeholder={
                  language === 'zh'
                    ? '输入或编辑要优化的提示词...'
                    : 'Enter or edit the prompt to optimize...'
                }
                rows={5}
                disabled={isOptimizing}
              />
            </div>

            <div className="prompt-optimize-dialog__section">
              <label
                className="prompt-optimize-dialog__label"
                htmlFor={requirementsId}
              >
                {language === 'zh' ? '补充要求' : 'Additional Requirements'}
              </label>
              <textarea
                id={requirementsId}
                className="prompt-optimize-dialog__textarea"
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                placeholder={requirementsPlaceholder}
                rows={4}
                disabled={isOptimizing}
              />
            </div>

            <div className="prompt-optimize-dialog__section">
              <span className="prompt-optimize-dialog__label">
                {language === 'zh' ? '文本模型' : 'Text Model'}
              </span>
              <div className="prompt-optimize-dialog__model">
                <ModelDropdown
                  variant="form"
                  selectedModel={optimizerModel}
                  selectedSelectionKey={getSelectionKey(
                    optimizerModel,
                    optimizerModelRef
                  )}
                  onSelect={(modelId, modelRef) => {
                    const nextModelRef = modelRef || null;
                    setOptimizerModel(modelId);
                    setOptimizerModelRef(nextModelRef);
                    writeStoredModelSelection(
                      LS_KEYS.PROMPT_OPTIMIZE_TEXT_MODEL,
                      modelId,
                      nextModelRef
                    );
                  }}
                  onSelectModel={(model) => {
                    const nextModelRef = getModelRefFromConfig(model);
                    setOptimizerModel(model.id);
                    setOptimizerModelRef(nextModelRef);
                    writeStoredModelSelection(
                      LS_KEYS.PROMPT_OPTIMIZE_TEXT_MODEL,
                      model.id,
                      nextModelRef
                    );
                  }}
                  language={language}
                  models={visibleTextModels}
                  placement="down"
                  disabled={isOptimizing}
                  placeholder={
                    language === 'zh'
                      ? '选择文本模型'
                      : 'Select text model'
                  }
                />
              </div>
            </div>
          </div>

          {optimizedDraft && (
            <div className="prompt-optimize-dialog__result-pane">
              <div className="prompt-optimize-dialog__section prompt-optimize-dialog__section--result">
                <div className="prompt-optimize-dialog__result-header">
                  <label
                    className="prompt-optimize-dialog__label"
                    htmlFor={draftPromptId}
                  >
                    {language === 'zh' ? '优化结果草稿' : 'Optimized Draft'}
                  </label>
                  <button
                    type="button"
                    className="prompt-optimize-dialog__inline-btn"
                    onClick={handleUseDraftAsCurrent}
                    disabled={isOptimizing}
                  >
                    {language === 'zh'
                      ? '用结果继续优化'
                      : 'Use Draft to Refine'}
                  </button>
                </div>
                <textarea
                  id={draftPromptId}
                  className="prompt-optimize-dialog__textarea prompt-optimize-dialog__textarea--draft"
                  value={optimizedDraft}
                  onChange={(event) => setOptimizedDraft(event.target.value)}
                  rows={6}
                  disabled={isOptimizing}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className={`prompt-optimize-dialog__footer ${
            optimizedDraft ? 'prompt-optimize-dialog__footer--split' : ''
          }`}
        >
          <div className="prompt-optimize-dialog__footer-actions prompt-optimize-dialog__footer-actions--form">
            <button
              type="button"
              className="prompt-optimize-dialog__footer-btn prompt-optimize-dialog__footer-btn--secondary"
              onClick={handleClose}
              disabled={isOptimizing}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              type="button"
              className="prompt-optimize-dialog__footer-btn prompt-optimize-dialog__footer-btn--primary"
              onClick={() => void handleOptimizePrompt()}
              disabled={isOptimizing || !canOptimize}
            >
              {language === 'zh'
                ? isOptimizing
                  ? mode === 'structured'
                    ? '生成中...'
                    : '优化中...'
                  : mode === 'structured'
                  ? '生成结构化提示词'
                  : '开始优化'
                : isOptimizing
                ? mode === 'structured'
                  ? 'Generating...'
                  : 'Optimizing...'
                : mode === 'structured'
                ? 'Generate Structured Prompt'
                : 'Optimize'}
            </button>
          </div>
          {optimizedDraft && (
            <div className="prompt-optimize-dialog__footer-actions prompt-optimize-dialog__footer-actions--result">
              <button
                type="button"
                className="prompt-optimize-dialog__footer-btn prompt-optimize-dialog__footer-btn--apply"
                onClick={handleApplyPrompt}
                disabled={isOptimizing || !canApply}
              >
                {language === 'zh' ? '回填' : 'Apply'}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromptOptimizeDialog;
