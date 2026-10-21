/* global console, process */

import {
  AgentService,
  ContextService,
  createApiHandler,
  createNodeHttpServer,
  InMemoryAgentStore,
  MockContextAuthorizer,
  MockIdentityProvider,
} from "../../agent-server/dist/index.js";

const store = new InMemoryAgentStore("copilotkit-browser-fixture@1");
const runner = {
  start(run) {
    store.setRunStatus(run.id, "running");
    store.appendEvent(run.id, "run.started", { modelConfigVersion: "browser-fixture@1" });
    store.appendEvent(run.id, "message.delta", {
      delta: "订单数据集质量趋势稳定，当前模拟质量分为 96%。",
    });
    store.appendEvent(run.id, "run.completed", { evidenceRefs: [] });
    store.setRunStatus(run.id, "completed");
  },
  cancel() {},
};
const service = new AgentService(store, new ContextService(new MockContextAuthorizer()), runner);
const handler = createApiHandler({
  identity: new MockIdentityProvider(),
  service,
});
const server = createNodeHttpServer(handler);

server.listen(3000, "127.0.0.1", () => {
  console.log("CopilotKit browser fixture listening on http://127.0.0.1:3000");
});

function close() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
