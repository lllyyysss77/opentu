# PostHog PPT 与提示词能力报表

本文档用于在 PostHog 中搭建「PPT / 提示词新功能使用分析」看板。所有事件都通过 `analytics.track()` 异步脱敏上报，不上传原始 prompt、PPT 文本、图片 URL 或文件名。

当前看板：

- 名称：`PPT 与提示词能力分析`
- 地址：`https://us.posthog.com/project/263621/dashboard/1511704`
- 创建日期：2026-04-26
- 图表数量：9

## 事件口径

### `ppt_action`

用于分析 PPT 大纲、页面编辑、批量生图、素材替换、导出播放等动作。

核心字段：

- `action`: 动作，例如 `generate_outline`、`mindmap_to_ppt`、`generate_outline_slides`、`export_all`
- `source`: 来源，例如 `mcp_generate_ppt`、`project_drawer_outline`、`popup_toolbar`
- `status`: `start` / `success` / `failed` / `cancelled`
- `pageCount`、`frameCount`、`selectedCount`、`successCount`、`failedCount`
- `durationMs`、`serialMode`、`model`
- `prompt_length_bucket`、`prompt_line_count`、`has_prompt`

### `prompt_action`

用于分析提示词历史、预设、优化、回填等动作。

核心字段：

- `action`: `select`、`pin`、`delete`、`preview_example`、`optimize`、`apply`
- `surface`: `prompt_list`、`prompt_optimize_dialog`、`ppt_common_prompt`
- `promptType`: `image`、`video`、`audio`、`text`、`agent`、`ppt-common`、`ppt-slide`
- `mode`: `polish` / `structured`
- `status`、`model`、`durationMs`
- `prompt_length_bucket`、`requirements_length_bucket`

## 推荐看板

### 1. PPT 功能总览

Insight：Trend

- Event: `ppt_action`
- Filter: `action` in `generate_outline`, `mindmap_to_ppt`, `generate_outline_slides`, `export_all`, `open_slideshow`
- Breakdown: `action`
- Date range: 14d

用途：判断 PPT 新功能是否被发现，以及用户停留在「生成大纲」还是继续进入「生图 / 导出 / 播放」。

### 2. PPT 大纲生成成功率

Insight：Trend 或 HogQL

```sql
select
  action,
  status,
  count() as events
from events
where event = 'ppt_action'
  and action in ('generate_outline', 'mindmap_to_ppt')
  and timestamp > now() - interval 14 day
group by action, status
order by events desc
```

优化判断：

- `generate_outline.failed` 高：优先看文本模型、JSON 解析和画布初始化失败。
- `mindmap_to_ppt.failed` 高：优先优化空思维导图提示、选区判断、图片任务创建失败反馈。

### 3. PPT 生图转化漏斗

Insight：Funnel

1. `ppt_action` where `action = generate_outline` and `status = success`
2. `ppt_action` where `action = generate_outline_slides` and `status = start`
3. `ppt_action` where `action = generate_outline_slides` and `status = success`
4. `ppt_action` where `action = export_all` and `status = success`

优化判断：

- 1 → 2 掉得多：大纲确认/入口不明显，优化 CTA、默认选中页面、提示词可读性。
- 2 → 3 掉得多：图片模型稳定性、串并行策略、失败重试提示需要优化。
- 3 → 4 掉得多：导出入口弱，或用户主要把 PPT 当画布素材使用。

### 4. 提示词优化效果

Insight：Trend

- Event: `prompt_action`
- Filter: `action` in `optimize`, `apply`
- Breakdown: `status`, `promptType`, `mode`

优化判断：

- `optimize.success` 高但 `apply` 低：结果不满意或回填位置不清晰。
- `structured` 模式失败率高：结构化输出提示词或 JSON 清洗需要加强。
- `requirements_length_bucket = 0` 占比高：补充要求入口可能没被理解，可优化占位文案。

### 5. PPT 提示词编辑负担

Insight：Trend

- Event: `ppt_action`
- Filter: `action` in `save_common_prompt`, `save_slide_prompt`, `apply_optimized_prompt`
- Breakdown: `action`, `prompt_length_bucket`

优化判断：

- `save_slide_prompt` 远高于 `apply_optimized_prompt`：用户在手动改每页，建议补批量风格/术语替换。
- 超长 `prompt_length_bucket` 多：公共提示词可能过重，影响可维护性与模型稳定性。

## 版本观察建议

上线后先观察 24 小时，再做产品判断：

1. 看 `ppt_action` 是否有真实流量，确认埋点链路通。
2. 看 `generate_outline_slides` 的 `failedCount / selectedCount`，定位生图失败压力。
3. 看 `prompt_action.apply / prompt_action.optimize.success`，衡量提示词优化是否真正被采用。
4. 若导出少但播放多，优先优化演示模式；若导出多但播放少，优先优化 PPT 文件质量。
