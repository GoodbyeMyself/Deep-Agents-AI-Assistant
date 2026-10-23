# Platform Diagnostics Extension

First-party reference extension for the governed Platform Extension Runtime. It contributes one read-only Tool and one
Skill explaining the boundary between platform extensions and system MCP business capabilities.

This package is an implementation fixture, not a business integration.

After building the workspace, the reference extension can be enabled with this exact deployment approval:

```text
PLATFORM_EXTENSIONS=[{"moduleSpecifier":"@assistant/platform-diagnostics-extension","approval":{"id":"platform-diagnostics","version":"1.0.0","manifestDigest":"5870fc5587a10d51f370cb8335ed2ec8070157dd43bd386bc852e5129de1b1fc"}}]
```

Any Manifest or Skill change must produce a new reviewed digest; approval drift intentionally prevents startup.
