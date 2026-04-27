# 循环依赖治理经验

更新日期：2026-04-27

## 背景

本轮目标是继续收敛项目里的循环依赖：运行时静态 import 已经为 0，但 type-only import 仍形成 3 个 `static-all` SCC。动态 import 形成的大 SCC 暂不治理，避免把懒加载边界和产品模块重排混在一起。

## 本轮结论

### 1. 循环依赖要分层看

推荐至少区分三层：

- `runtime-static`：运行时静态 import/export，必须作为失败项。
- `static-all`：运行时静态 + type-only import/export，适合作为架构洁净度检查。
- `dynamic`：动态 import 造成的懒加载图回边，适合单独专题治理。

经验：不要只看“有没有环”，要先判断它会不会影响初始化顺序、chunk 分包、首屏边界或类型层耦合。

### 2. type-only 环也值得收敛

TypeScript 的 type-only import 不会直接进入运行时代码，但它会暴露模块职责不清的问题。本轮剩余问题主要来自：

- workflow converter 同时承载类型和转换逻辑。
- settings manager 同时承载配置类型、常量和运行时管理器。
- model adapter barrel 带有默认注册副作用，被类型引用误触。

经验：类型环通常不需要大改逻辑，优先抽出中立纯类型模块，让业务模块都向下依赖。

### 3. 桶文件不是类型边界

`index.ts` barrel 很方便，但如果 barrel 同时 re-export 有副作用的运行时模块，就不适合作为纯类型 import 来源。

推荐做法：

- 类型引用直连 `types` 或低层纯类型模块。
- 有副作用的 barrel 只给运行时功能入口用。
- 公共 API 需要兼容时，在旧入口 re-export 类型，但内部新代码不要再从旧入口回引。

本轮例子：

- `audio-api-service` 的结果类型改为直连 `model-adapters/types`。
- `gemini-api/types` 改为直连 `provider-routing/types`。
- `settings-manager` 继续 re-export `settings-types`，但 provider-routing 内部不再回引它。

### 4. 中立类型模块要保持“轻”

抽出的类型模块只应依赖更底层的纯类型或常量类型，不应引入服务、单例、注册表、存储读写或 UI 组件。

本轮新增的边界：

- `workflow-types`：只承载 workflow 数据形状。
- `settings-types`：只承载 settings 数据形状和纯常量。

经验：中立模块一旦混入运行时逻辑，很快会变成新的公共泥球。

### 5. 检查脚本默认要保守

`pnpm check:cycles` 继续只检查运行时静态环，避免突然扩大 CI 失败面。新增 `pnpm check:cycles:types` 专门检查 type-only 环，适合在架构收敛或重构后复跑。

经验：检查项升级要分阶段，让默认门禁稳定，再逐步把更严格模式纳入常规流程。

## 验证清单

基础检查：

```bash
NPM_TOKEN=${NPM_TOKEN:-dummy} pnpm check:cycles
NPM_TOKEN=${NPM_TOKEN:-dummy} pnpm check:cycles:types
NPM_TOKEN=${NPM_TOKEN:-dummy} pnpm typecheck
```

如果改动触及 Vite manual chunk、入口预取或重包懒加载，再跑：

```bash
NPM_TOKEN=${NPM_TOKEN:-dummy} pnpm exec nx build web
NPM_TOKEN=${NPM_TOKEN:-dummy} pnpm verify:startup
```

## 后续建议

1. 新增核心类型时，优先放到纯类型模块，不要顺手放进服务实现文件。
2. 从 barrel import 前先确认该 barrel 是否包含运行时副作用。
3. `dynamic import` SCC 不要和静态环一起治理，应按工具窗口、SW、媒体插入等边界拆专题。
4. 保持旧导出兼容，但内部依赖逐步迁到低层入口。
5. 每次拆环都先跑 `check:cycles:types`，再跑 `typecheck`，避免只修图不修类型。

## 一句话结论

循环依赖治理最稳的方式是先分清运行时、类型层和动态懒加载，再用中立纯类型模块打断高风险边界。✅
