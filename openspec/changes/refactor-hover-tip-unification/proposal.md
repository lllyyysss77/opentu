# Change: refactor hover tip unification

## Why

当前项目里的 hover 提示交互分散在 `tdesign-react Tooltip`、`ToolButton title`、自定义 `HoverPopover`、`data-tooltip` 和原生 `title` 等多套实现中，导致样式、延迟、z-index、可访问性和维护成本都不一致。

这类交互是高频基础能力，如果不统一到共享组件，后续功能继续扩展时会不断复制分叉实现，稳定性和普适性都无法保证。

## What Changes

- 新增共享 hover 组件层，提供 `HoverTip` 与 `HoverCard`
- 将 `ToolButton` 与现有媒体预览 hover 基座统一到共享组件
- 将直接使用 `tdesign-react Tooltip` 的组件迁移到 `HoverTip`
- 收敛高频原生 `title` / `data-tooltip` 的 hover 提示场景到共享组件
- 增加静态检查，阻止在组件层继续直接引入 `Tooltip`

## Impact

- Affected specs: `hover-feedback`
- Affected code:
  - `packages/drawnix/src/components/shared/`
  - `packages/drawnix/src/components/tool-button.tsx`
  - `packages/drawnix/src/components/shared/media-preview/`
  - `packages/drawnix/src/components/audio-node-element/`
  - `packages/drawnix/src/components/canvas-search/`
