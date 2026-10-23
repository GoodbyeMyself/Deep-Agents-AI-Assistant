# Platform Extension Runtime

This package loads explicitly configured, deployment-trusted platform extension modules. It validates an immutable
manifest approval, creates guarded read-only platform Tools, and copies approved Skills into an isolated startup
snapshot.

It does not define business capabilities. Product data and operations continue to enter the platform only through an
approved system MCP.

Extension modules are ordinary Node.js code and are not a sandbox. The loader therefore accepts only installed bare
package names from trusted deployment configuration; it rejects paths, URLs, runtime uploads, and hot reload.
