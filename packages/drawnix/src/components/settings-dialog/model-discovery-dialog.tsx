import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent } from '../dialog/dialog';
import {
  getModelsByVendor,
  getModelTypeColor,
  getVendorOrder,
  VENDOR_NAMES,
  type ModelConfig,
  type ModelType,
  type ModelVendor,
} from '../../constants/model-config';
import { VendorTabPanel, type VendorTab } from '../shared/VendorTabPanel';
import './model-discovery-dialog.scss';

type ModelTypeFilter = 'all' | ModelType;

const MODEL_TYPE_LABELS: Record<ModelTypeFilter, string> = {
  all: '全部',
  image: '图片',
  video: '视频',
  text: '文本',
};

interface ModelDiscoveryDialogProps {
  open: boolean;
  container: HTMLElement | null;
  models: ModelConfig[];
  selectedModelIds: string[];
  onClose: () => void;
  onConfirm: (modelIds: string[]) => void;
}

export const ModelDiscoveryDialog: React.FC<ModelDiscoveryDialogProps> = ({
  open,
  container,
  models,
  selectedModelIds,
  onClose,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<ModelTypeFilter>('all');
  const [activeVendor, setActiveVendor] = useState<ModelVendor | null>(null);
  const [draftSelection, setDraftSelection] =
    useState<string[]>(selectedModelIds);

  useEffect(() => {
    if (!open) return;
    setSearchQuery('');
    setActiveType('all');
    setActiveVendor(models[0]?.vendor ?? null);
    setDraftSelection(selectedModelIds);
  }, [models, open, selectedModelIds]);

  const typeScopedModels = useMemo(() => {
    if (activeType === 'all') {
      return models;
    }
    return models.filter((model) => model.type === activeType);
  }, [activeType, models]);

  const typeCounts = useMemo(
    () => ({
      all: models.length,
      image: models.filter((model) => model.type === 'image').length,
      video: models.filter((model) => model.type === 'video').length,
      text: models.filter((model) => model.type === 'text').length,
    }),
    [models]
  );

  const vendorTabs = useMemo((): VendorTab[] => {
    const vendorMap = getModelsByVendor(typeScopedModels);
    const order = getVendorOrder(typeScopedModels);
    return order.map((vendor) => ({
      vendor,
      count: vendorMap.get(vendor)?.length ?? 0,
    }));
  }, [typeScopedModels]);

  useEffect(() => {
    if (vendorTabs.length === 0) {
      setActiveVendor(null);
      return;
    }

    if (
      !activeVendor ||
      !vendorTabs.some((tab) => tab.vendor === activeVendor)
    ) {
      setActiveVendor(vendorTabs[0].vendor);
    }
  }, [activeVendor, vendorTabs]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      return typeScopedModels.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.label.toLowerCase().includes(query) ||
          model.shortLabel?.toLowerCase().includes(query) ||
          model.shortCode?.toLowerCase().includes(query) ||
          model.description?.toLowerCase().includes(query)
      );
    }

    if (!activeVendor) {
      return typeScopedModels;
    }

    return typeScopedModels.filter((model) => model.vendor === activeVendor);
  }, [activeVendor, searchQuery, typeScopedModels]);

  const selectedCount = draftSelection.length;
  const selectedTypeCounts = useMemo(
    () => ({
      image: models.filter(
        (model) => model.type === 'image' && draftSelection.includes(model.id)
      ).length,
      video: models.filter(
        (model) => model.type === 'video' && draftSelection.includes(model.id)
      ).length,
      text: models.filter(
        (model) => model.type === 'text' && draftSelection.includes(model.id)
      ).length,
    }),
    [draftSelection, models]
  );

  const allVisibleSelected =
    filteredModels.length > 0 &&
    filteredModels.every((model) => draftSelection.includes(model.id));

  const toggleModel = (modelId: string) => {
    setDraftSelection((prev) =>
      prev.includes(modelId)
        ? prev.filter((item) => item !== modelId)
        : [...prev, modelId]
    );
  };

  const toggleVisibleModels = () => {
    const visibleIds = filteredModels.map((model) => model.id);
    const visibleSelected = visibleIds.every((modelId) =>
      draftSelection.includes(modelId)
    );

    setDraftSelection((prev) => {
      if (visibleSelected) {
        return prev.filter((modelId) => !visibleIds.includes(modelId));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="model-discovery-dialog"
        container={container}
        data-testid="model-discovery-dialog"
      >
        <div className="model-discovery-dialog__header">
          <h3 className="model-discovery-dialog__title">获取模型</h3>
          <div className="model-discovery-dialog__header-stats">
            <span className="model-discovery-dialog__header-pill">
              已发现 {models.length}
            </span>
            <span className="model-discovery-dialog__header-pill model-discovery-dialog__header-pill--accent">
              已选 {selectedCount}
            </span>
          </div>
          <button
            type="button"
            className="model-discovery-dialog__close"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="model-discovery-dialog__toolbar">
          <label className="model-discovery-dialog__search">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索模型名称或 ID"
            />
          </label>
          <div className="model-discovery-dialog__toolbar-actions">
            <button
              type="button"
              className="model-discovery-dialog__ghost-button"
              onClick={toggleVisibleModels}
              disabled={filteredModels.length === 0}
            >
              {allVisibleSelected ? '取消当前结果' : '添加当前结果'}
            </button>
            <button
              type="button"
              className="model-discovery-dialog__ghost-button model-discovery-dialog__ghost-button--muted"
              onClick={() => setDraftSelection([])}
              disabled={draftSelection.length === 0}
            >
              清空已选
            </button>
          </div>
        </div>

        <div className="model-discovery-dialog__type-tabs">
          {(Object.keys(MODEL_TYPE_LABELS) as ModelTypeFilter[]).map((type) => {
            const isActive = activeType === type;
            return (
              <button
                key={type}
                type="button"
                className={`model-discovery-dialog__type-tab ${
                  isActive ? 'model-discovery-dialog__type-tab--active' : ''
                }`}
                onClick={() => setActiveType(type)}
              >
                <span>{MODEL_TYPE_LABELS[type]}</span>
                <span className="model-discovery-dialog__type-tab-count">
                  {typeCounts[type]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="model-discovery-dialog__body">
          <VendorTabPanel
            tabs={vendorTabs}
            activeVendor={activeVendor}
            onVendorChange={setActiveVendor}
            searchQuery={searchQuery}
            compact
          >
            <div className="model-discovery-dialog__list">
              {filteredModels.length === 0 ? (
                <div className="model-discovery-dialog__empty">
                  {searchQuery.trim() ? '没有匹配的模型' : '暂无模型'}
                </div>
              ) : (
                filteredModels.map((model) => {
                  const checked = draftSelection.includes(model.id);
                  return (
                    <label
                      key={model.id}
                      className={`model-discovery-dialog__item ${
                        checked ? 'model-discovery-dialog__item--checked' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModel(model.id)}
                      />
                      <div className="model-discovery-dialog__item-body">
                        <div className="model-discovery-dialog__item-top">
                          <div className="model-discovery-dialog__item-heading">
                            <span className="model-discovery-dialog__item-label">
                              {model.shortLabel || model.label}
                            </span>
                            {checked ? (
                              <span className="model-discovery-dialog__added-tag">
                                已选
                              </span>
                            ) : null}
                          </div>
                          <span
                            className="model-discovery-dialog__type-tag"
                            style={{ color: getModelTypeColor(model.type) }}
                          >
                            {MODEL_TYPE_LABELS[model.type]}
                          </span>
                        </div>
                        <div className="model-discovery-dialog__item-id">
                          {model.id}
                        </div>
                        <div className="model-discovery-dialog__item-meta">
                          <span>{VENDOR_NAMES[model.vendor]}</span>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </VendorTabPanel>
        </div>

        <div className="model-discovery-dialog__footer">
          <span className="model-discovery-dialog__selection-count">
            已选 {selectedCount} 个{' · '}图 {selectedTypeCounts.image} / 视{' '}
            {selectedTypeCounts.video} / 文 {selectedTypeCounts.text}
          </span>
          <div className="model-discovery-dialog__actions">
            <button
              type="button"
              className="model-discovery-dialog__button model-discovery-dialog__button--secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="model-discovery-dialog__button model-discovery-dialog__button--primary"
              onClick={() => onConfirm(draftSelection)}
            >
              添加模型
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
