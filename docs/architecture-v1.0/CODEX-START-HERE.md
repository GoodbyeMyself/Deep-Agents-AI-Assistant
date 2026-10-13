# Codex 立刻开始：V1.0 开发总入口

**当前项目尚未编码。默认只执行 M0，不允许顺手做 M1—M5。**

## 第一步：将文档放进新仓库

建议将本包所有文档放进：`docs/architecture-v1.0/`，并将其中 `AGENTS.md` 复制到仓库根目录（注意与已有仓库 AGENTS.md 合并，勿覆盖原有用户约束）。

## 第二步：直接给 Codex 发送这段指令

```text
我希望你根据 docs/architecture-v1.0/ 文档包开发通用 AI Assistant。
从 M0 开始：先阅读根目录 AGENTS.md，和
00-README.md、01-架构基线与边界.md、02-需求追踪矩阵.md、
03-工程结构与依赖规则.md、06-DeepAgents运行时设计.md、
10-M0-工程初始化与框架验证.md、16-测试体系与质量门禁.md。

要求：直接使用官方 Deep Agents TypeScript SDK，而不是重新开发 Harness；
React + Ant Design X 双 Web 模式、启动自动扫描插件、标准 Capability、
A/B/C 独立部署是全局不可更改的架构目标，但本轮只实施 M0。

先检查仓库和官方依赖实际接口，给出简洁执行计划；然后真实编码、
编写测试、执行 lint/typecheck/test/build；把真实可用 API 和版本写入
 docs/deepagents-compatibility.md；不要编造 API，不能将 Mock 冒充生产验证。
最终给出 M0 验收报告并停止，不要继续实施 M1。
```

## 第三步：后续阶段如何继续

确认 M0 阶段门禁通过后，对 Codex 发：

```text
现在执行 M1。阅读 docs/architecture-v1.0/11-M1-插件自动挂载POC.md
及其引用的规范，先检查 M0 现状，仅完成 M1 的 T01~T06，执行测试，
输出验收报告并停止；不得自动推进 M2。
```

M2～M5 同理，将文件名替换为对应阶段。阶段任务入口见 `17-Codex执行手册.md`。

## 成功后的最终标志

不修改 Agent Factory/Chat UI，仅更换当前实例安装的业务插件就能执行标准工具，并在 React/JS/iframe/独立 Web 中使用同一聊天与展示协议；A/B 实例的 Session、模型配置、授权与数据相互隔离。
