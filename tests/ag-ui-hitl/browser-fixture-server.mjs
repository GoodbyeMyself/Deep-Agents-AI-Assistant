import {
  AgentService,
  ContextService,
  InMemoryAgentStore,
  MockContextAuthorizer,
  MockIdentityProvider,
  createApiHandler,
  createNodeHttpServer,
} from "../../apps/agent-server/dist/index.js";

const store = new InMemoryAgentStore("ag-ui-hitl-browser-fixture@1");
const runner = {
  start(run) {
    const interrupt = {
      id: `approval-${run.id}`,
      reason: "business_write",
      message: "即将执行测试业务操作。是否确认继续？",
    };
    store.setRunStatus(run.id, "running");
    store.appendEvent(run.id, "run.started", { modelConfigVersion: "hitl-fixture@1" });
    store.appendEvent(run.id, "message.delta", {
      delta: "我已经准备好执行测试业务操作，需要你进行二次确认。",
    });
    store.addMessage({
      sessionId: run.sessionId,
      runId: run.id,
      role: "assistant",
      content: "我已经准备好执行测试业务操作，需要你进行二次确认。",
      evidenceRefs: [],
    });
    store.registerInterrupts(run.id, [interrupt]);
    store.appendEvent(run.id, "approval.required", interrupt);
    store.setRunStatus(run.id, "interrupted");
    store.appendEvent(run.id, "run.interrupted", { interrupts: [interrupt] });
  },
  resume(run, _principal, response) {
    store.setRunStatus(run.id, "running");
    store.appendEvent(run.id, "run.started", {
      modelConfigVersion: "hitl-fixture@1",
      resumedFromRunId: run.resumedFromRunId,
    });
    const message =
      response.status === "resolved"
        ? "已收到确认，测试业务操作已继续并完成。"
        : "你已拒绝，本次测试业务操作没有执行。";
    store.appendEvent(run.id, "message.delta", { delta: message });
    store.addMessage({
      sessionId: run.sessionId,
      runId: run.id,
      role: "assistant",
      content: message,
      evidenceRefs: [],
    });
    store.setRunStatus(run.id, "completed");
    store.appendEvent(run.id, "run.completed", { evidenceRefs: [] });
  },
  cancel() {},
};

const service = new AgentService(
  store,
  new ContextService(new MockContextAuthorizer()),
  runner,
);
const server = createNodeHttpServer(
  createApiHandler({ identity: new MockIdentityProvider(), service }),
);

server.listen(3000, "127.0.0.1", () => {
  console.log("AG-UI HITL browser fixture listening on http://127.0.0.1:3000");
});

function close() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
