# POC Data Quality Skill

Deep Agents Skills 加载机制使用的数据质量分析样例。运行时读取 `SKILL.md`，指导 Agent 在陈述指标前调用质量趋势工具，并保留警告与 Evidence 引用。

## 文件

- `SKILL.md`：Skill 元数据和运行指令。

## 边界

这是项目运行时的 Deep Agents Skill 样例，不是 Codex 本地技能，也不提供新的授权能力。Skill 只能影响模型行为，不能替代 Capability Executor、业务 API 权限或 Evidence 校验。

## 验证位置

加载与执行测试位于 `packages/agent-runtime/src/runtime.integration.test.ts`。可从仓库根目录执行：

```bash
pnpm --filter @assistant/agent-runtime test
```
