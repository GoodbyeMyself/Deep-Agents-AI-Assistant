# 平台扩展（extensions）

`extensions/` 存放经部署审核的平台扩展。每个 Extension 必须独占一个目录和 npm 包，并独立维护
版本、Manifest、Tools、Skills 与测试。

```text
extensions/
  <extension-id>/
    package.json
    src/
      index.ts
    skills/
      <skill-id>/
        SKILL.md
```

## 边界

- Extension 只扩展平台能力；业务 Tool、业务 Schema、业务权限和产品 API 映射必须进入对应系统 MCP。
- Extension 不得通过相对路径或 `file:` 依赖接入运行时；部署时必须以已安装包名装载。
- 新增或升级 Extension 必须更新版本、内容摘要、Manifest 摘要和 `PLATFORM_EXTENSIONS` 批准配置，
  并在重启后生效。
- PEX-1 只开放只读 Platform Tool 和受审核 Skill；其他扩展点需要新的契约、安全评审和 ADR。

参考实现见 [`platform-diagnostics/`](./platform-diagnostics/README.md)；声明式宿主导航见
[`host-navigation/`](./host-navigation/README.md)。运行时契约位于
[`packages/platform-extension-runtime/`](../packages/platform-extension-runtime/README.md)。
