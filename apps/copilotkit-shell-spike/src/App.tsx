import { AssistantApiError, AssistantApiTransport } from "@assistant/assistant-transport";
import { CopilotChat, CopilotKit, HttpAgent } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useState } from "react";

const AGENT_ID = "enterprise-assistant";

type ProfileId = "user-a" | "user-b" | "admin";

interface Profile {
  id: ProfileId;
  label: string;
  token: string;
  object: { id: string; type: "dataset"; name: string };
}

interface RuntimeBinding {
  sessionId: string;
  snapshotId: string;
  agent: HttpAgent;
}

const profiles: readonly Profile[] = [
  {
    id: "user-a",
    label: "业务用户 A",
    token: "mock-token-user-a",
    object: { id: "orders", type: "dataset", name: "订单数据集" },
  },
  {
    id: "user-b",
    label: "业务用户 B",
    token: "mock-token-user-b",
    object: { id: "customers", type: "dataset", name: "客户数据集" },
  },
  {
    id: "admin",
    label: "平台管理员",
    token: "mock-token-admin",
    object: { id: "orders", type: "dataset", name: "订单数据集" },
  },
] as const;

const profileById: Record<ProfileId, Profile> = Object.fromEntries(
  profiles.map((profile) => [profile.id, profile]),
) as Record<ProfileId, Profile>;

function errorMessage(error: unknown): string {
  if (error instanceof AssistantApiError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : "初始化失败";
}

function shortId(value: string | undefined): string {
  if (value === undefined) return "pending";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}

function ProtocolStep({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <li className="protocol-step">
      <span className="step-index">{index}</span>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </li>
  );
}

export function App() {
  const [profileId, setProfileId] = useState<ProfileId>("user-a");
  const [binding, setBinding] = useState<RuntimeBinding>();
  const [setupError, setSetupError] = useState<string>();
  const profile = profileById[profileId];
  const transport = useMemo(
    () => new AssistantApiTransport({ getAccessCredential: () => profile.token }),
    [profile.token],
  );

  useEffect(() => {
    let disposed = false;
    setBinding(undefined);
    setSetupError(undefined);

    void Promise.all([
      transport.createSession({ title: `CopilotKit Spike · ${profile.label}`, mode: "standalone" }),
      transport.createContextSnapshot(
        {
          page: {
            type: "copilotkit-shell-spike",
            route: "/",
            title: "AG-UI Compatibility Console",
          },
          object: {
            type: profile.object.type,
            rawId: profile.object.id,
            name: profile.object.name,
          },
          business: { domain: "data-governance", module: "quality" },
        },
        "standalone",
      ),
    ])
      .then(([session, snapshot]) => {
        if (disposed) return;
        setBinding({
          sessionId: session.id,
          snapshotId: snapshot.id,
          agent: new HttpAgent({
            agentId: AGENT_ID,
            threadId: session.id,
            url: "/api/v1/ag-ui",
            headers: { Authorization: `Bearer ${profile.token}` },
          }),
        });
      })
      .catch((error: unknown) => {
        if (!disposed) setSetupError(errorMessage(error));
      });

    return () => {
      disposed = true;
    };
  }, [profile, transport]);

  return (
    <main className="console-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            A/G
          </span>
          <div>
            <p className="eyebrow">SHARED CHAT CORE · COMPATIBILITY LAB</p>
            <h1>AG-UI / CopilotKit Shell Spike</h1>
          </div>
        </div>
        <div className="masthead-status">
          <span className={`signal ${binding === undefined ? "signal-waiting" : ""}`} />
          {setupError === undefined
            ? binding === undefined
              ? "PROVISIONING"
              : "LINK READY"
            : "LINK FAILED"}
        </div>
      </header>

      <section className="console-grid">
        <aside className="rail protocol-rail" aria-label="协议链路">
          <p className="rail-kicker">EVENT PATH</p>
          <ol className="protocol-list">
            <ProtocolStep index="01" title="CopilotChat" detail="optional shell" />
            <ProtocolStep index="02" title="HttpAgent" detail="AG-UI client" />
            <ProtocolStep index="03" title="/api/v1/ag-ui" detail="standard command" />
            <ProtocolStep index="04" title="agent-runtime" detail="governed run" />
          </ol>
          <div className="rail-note">
            <span>CONTRACT</span>
            <strong>AG-UI 1.0</strong>
            <small>Shell 可替换，服务端边界不变</small>
          </div>
        </aside>

        <section className="chat-stage" aria-label="CopilotKit 对话验证">
          <div className="stage-toolbar">
            <div>
              <p className="eyebrow">LIVE PROBE</p>
              <h2>{profile.object.name}</h2>
            </div>
            <label className="profile-picker">
              <span>MOCK IDENTITY</span>
              <select
                value={profileId}
                onChange={(event) => setProfileId(event.target.value as ProfileId)}
              >
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="binding-strip">
            <span>
              SESSION <b>{shortId(binding?.sessionId)}</b>
            </span>
            <span>
              SNAPSHOT <b>{shortId(binding?.snapshotId)}</b>
            </span>
            <span>
              ENDPOINT <b>POST /api/v1/ag-ui</b>
            </span>
          </div>

          <div className="chat-frame">
            {setupError !== undefined && (
              <div className="state-panel state-error" role="alert">
                <p>无法建立验证链路</p>
                <code>{setupError}</code>
                <small>请确认 agent-server 已在 127.0.0.1:3000 运行。</small>
              </div>
            )}
            {setupError === undefined && binding === undefined && (
              <div className="state-panel" aria-live="polite">
                <span className="loader" aria-hidden="true" />
                <p>正在创建受治理会话与 ContextSnapshot…</p>
              </div>
            )}
            {binding !== undefined && (
              <CopilotKit
                key={`${profile.id}:${binding.sessionId}`}
                agentId={AGENT_ID}
                agents__unsafe_dev_only={{ [AGENT_ID]: binding.agent }}
                properties={{ [AGENT_ID]: { contextSnapshotId: binding.snapshotId } }}
                enableInspector={false}
              >
                <CopilotChat
                  agentId={AGENT_ID}
                  threadId={binding.sessionId}
                  inspectorTools={false}
                  labels={{
                    chatInputPlaceholder: `询问 ${profile.object.name} 的质量情况…`,
                    welcomeMessageText: "AG-UI 链路已就绪。发送一条消息验证标准事件流。",
                  }}
                />
              </CopilotKit>
            )}
          </div>
        </section>

        <aside className="rail boundary-rail" aria-label="验证边界">
          <p className="rail-kicker">SPIKE BOUNDARY</p>
          <div className="boundary-card boundary-pass">
            <span>IN SCOPE</span>
            <ul>
              <li>AG-UI 消息与事件流</li>
              <li>会话 / 快照归属校验</li>
              <li>可替换 Shell 证明</li>
            </ul>
          </div>
          <div className="boundary-card boundary-stop">
            <span>DELIBERATELY OFF</span>
            <ul>
              <li>Copilot Cloud / Runtime</li>
              <li>前端 Tools 与中断恢复</li>
              <li>生产授权与默认切换</li>
            </ul>
          </div>
          <p className="abort-note">
            STOP 中止 AG-UI 流；服务端将断连映射为当前身份下的 durable run cancel。
          </p>
        </aside>
      </section>

      <footer className="console-footer">
        <span>DEV-ONLY ADAPTER</span>
        <span>NO TOKEN PERSISTENCE</span>
        <span>NO CLIENT TOOLS</span>
      </footer>
    </main>
  );
}
