# 宿主导航扩展

纯平台扩展：让模型在用户明确要求时，准备一条**声明式宿主导航按钮**。不接收、也不生成 URL；`target` 是不透明的动作键，须由嵌入宿主在用户点击后，经本地白名单映射为实际跳转。

该 Tool 只负责展示数据，不会自动导航，也不授予任何业务授权。

构建工作区后，使用经审核的固定批准配置启用：

```text
PLATFORM_EXTENSIONS=[{"moduleSpecifier":"@assistant/platform-host-navigation-extension","approval":{"id":"host-navigation","version":"1.0.0","manifestDigest":"0c8645da7bb1745266ad75c45b0136df9e9048b6785b4a224dc9097da5447377"}}]
```

嵌入宿主必须监听 `enterprise-assistant:host-action`，并将 `target` 映射到本地白名单；未知 target 必须忽略。
