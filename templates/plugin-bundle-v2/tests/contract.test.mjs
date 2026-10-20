import assert from "node:assert/strict";
import test from "node:test";

import pluginFactory from "../dist/index.js";

test("bundle exports the declared capability", async () => {
  const plugin = await pluginFactory({
    logger: { info() {}, warn() {}, error() {} },
    config: {},
    credentials: { getSecret: () => Promise.reject(new Error("No test credential.")) },
  });
  assert.deepEqual(
    plugin.capabilities.map((capability) => `${capability.id}@${capability.contractVersion}`),
    ["__NAMESPACE__.metadata.lookup@1.0.0"],
  );
});
