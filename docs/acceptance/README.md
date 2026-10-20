# 验收记录索引

本目录保存已完成阶段的历史验收证据，包括实际执行命令、测试结果、Mock 边界、安全校验和退出门禁。当前实施状态以 [implementation-status.md](../implementation-status.md) 为准；验收报告用于追溯“当时如何验证”，不代表生产环境已上线。

## M0～M5：架构基线实施

- [M0：工程初始化与框架验证](milestones/m0-acceptance-report.md)
- [M1：插件自动发现与双 Adapter POC](milestones/m1-acceptance-report.md)
- [M2：企业可信执行闭环](milestones/m2-acceptance-report.md)
- [M3：React 独立 Web 与共享聊天](milestones/m3-acceptance-report.md)
- [M4：嵌入式助手与多宿主 SDK](milestones/m4-acceptance-report.md)
- [M5：独立部署与系统验收](milestones/m5-acceptance-report.md)

## E0～E5：插件化扩展演进

- [E0：决策固化与回归基线](evolution/e0-acceptance-report.md)
- [E1：Capability SDK 与动态 Catalog](evolution/e1-acceptance-report.md)
- [E2：Plugin Bundle V2 与事务式装载](evolution/e2-acceptance-report.md)
- [E3：Plugin Skill 自动发现](evolution/e3-acceptance-report.md)
- [E4：标准能力包拆分与 Adapter 迁移](evolution/e4-acceptance-report.md)
- [E5：系统验收、发布流程与文档收口](evolution/e5-acceptance-report.md)

## 维护规则

- 新的阶段验收报告应放入对应分类，不再平铺到 `docs/` 根目录。
- 报告保留当时的真实命令与结果，不使用后续结果覆盖历史证据。
- 实现状态、上线边界或能力契约变化时，同步更新 `implementation-status.md` 及相关 ADR。
