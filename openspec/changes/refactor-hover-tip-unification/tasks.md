## 1. Shared Hover Foundation

- [x] 1.1 新增 `HoverTip`，统一默认 theme、delay、z-index 与去除原生 `title`
- [x] 1.2 新增 `HoverCard`，统一 hover 打开/关闭延迟与可停留浮层行为
- [x] 1.3 为共享 hover 组件补充基础测试

## 2. Compatibility Refactor

- [x] 2.1 将 `ToolButton` 迁移到共享 `HoverTip`
- [x] 2.2 将现有 `HoverPopover` 收敛为 `HoverCard` 兼容层
- [x] 2.3 将直接 `Tooltip` 用法批量迁移为 `HoverTip`

## 3. High-Frequency Native Hover Cleanup

- [x] 3.1 收敛画布搜索按钮的原生 `title`
- [x] 3.2 收敛音频播放器控制按钮的 `data-tooltip`
- [x] 3.3 收敛提示词列表的原生 `title`

## 4. Guard Rails

- [x] 4.1 增加组件层 hover 用法检查脚本，禁止继续直接引入 `Tooltip`
- [x] 4.2 将检查脚本接入 `drawnix` lint

## 5. Validation

- [x] 5.1 运行共享 hover 单测
- [ ] 5.2 运行 `drawnix` typecheck
- [ ] 5.3 运行 `drawnix` lint

> 说明：`5.2 / 5.3` 当前被仓库既有基线问题阻塞，失败项与本次 hover 改造无直接关联，需在独立修复中处理。
