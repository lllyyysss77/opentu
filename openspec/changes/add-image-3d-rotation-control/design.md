## Context
图片元素现有模型以 `points` 和二维 `angle` 为主，命中、缩放、导出都依赖该矩形几何。3D 旋转应作为浏览器画布内的视觉变换保存，避免扩大到导出和命中模型。

## Decisions
- 数据保存在图片元素可选字段 `transform3d`，包含 `rotateX`、`rotateY` 和 `perspective`。
- popup-toolbar 面板负责编辑 `rotateX`、`rotateY` 和 `perspective`，中间预览不写历史，确认时提交一次历史。
- 当 `rotateX` 与 `rotateY` 都为 0 时移除 `transform3d`，旧数据保持无感兼容。
- 首版只支持普通图片；视频、音频封面和 PPT 占位图片不显示 3D 控件。
- 逻辑角度允许穿过 `90deg` 到另一侧；渲染时将背面角度折回 `-90..90` 区间，避免 SVG `foreignObject` 对 CSS 3D 背面渲染裁剪。
- 选中带 3D 变换的普通图片作为 AI 参考图时，用共享投影几何在 canvas 中导出轻量快照，避免模型拿到未变换原图。

## Non-Goals
- 不修改 Plait 包源码。
- 不实现 PPT/图片导出的透视渲染。
- 不实现拖拽式画布 3D handle；精确调节先收口在 popup-toolbar 面板。
