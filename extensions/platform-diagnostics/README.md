# 平台诊断扩展

本目录为独立版本的第一方参考扩展，用于演示受治理的平台扩展运行时。提供一个只读 Tool 与一个 Skill，说明平台扩展与系统 MCP 业务能力之间的边界。

本包是实现用样例，不是业务集成。

构建工作区后，可使用以下固定部署批准启用参考扩展：

```text
PLATFORM_EXTENSIONS=[{"moduleSpecifier":"@assistant/platform-diagnostics-extension","approval":{"id":"platform-diagnostics","version":"1.0.0","manifestDigest":"fa23b410b2da7847be364bb6289054e3d4cee4d0b6c8fb8b0b7c6f145e998fd5"}}]
```

Manifest 或 Skill 有任何变更都必须重新计算并审核摘要；批准信息与实现不一致时，服务会拒绝启动。
