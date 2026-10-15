import { AssistantController, AssistantProvider, AssistantSurface } from "@assistant/assistant-sdk";
import type { RawHostContext } from "@assistant/context";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export interface DemoEntity {
  readonly id: "orders" | "customers";
  readonly name: string;
  readonly kind: string;
  readonly route: string;
  readonly owner: string;
  readonly records: string;
  readonly quality: number;
  readonly freshness: string;
  readonly status: string;
}

export interface DemoActivity {
  readonly time: string;
  readonly title: string;
  readonly detail: string;
  readonly tone: "good" | "warn" | "neutral";
}

export interface DemoProductConfig {
  readonly productCode: "A" | "B";
  readonly brand: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly accent: string;
  readonly accentStrong: string;
  readonly canvas: string;
  readonly panel: string;
  readonly navItems: readonly string[];
  readonly activeNav: string;
  readonly entities: readonly [DemoEntity, DemoEntity];
  readonly activities: readonly DemoActivity[];
}

function contextFor(config: DemoProductConfig, entity: DemoEntity): RawHostContext {
  return {
    page: { route: entity.route, title: entity.name, type: "asset-detail" },
    object: { type: entity.kind, rawId: entity.id, name: entity.name },
    business: {
      domain: config.productCode === "A" ? "data-governance" : "asset-operations",
      module: "quality",
    },
    metadata: { demoProduct: config.productCode, environment: "demo" },
  };
}

function Metric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <article className="product-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

interface ModelDisplay {
  readonly label: string;
  readonly badge: string;
}

function modelDisplay(value: unknown): ModelDisplay {
  if (typeof value !== "object" || value === null)
    return { label: "模型状态未知", badge: "AI DEMO" };
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0)
    return { label: "模型状态未知", badge: "AI DEMO" };
  const model = items[0];
  if (typeof model !== "object" || model === null)
    return { label: "模型状态未知", badge: "AI DEMO" };
  const provider = (model as { provider?: unknown }).provider;
  const modelName = (model as { model?: unknown }).model;
  if (typeof provider !== "string" || typeof modelName !== "string") {
    return { label: "模型状态未知", badge: "AI DEMO" };
  }
  if (provider === "offline") return { label: "Fake Model", badge: "OFFLINE DEMO" };
  if (provider === "deepseek") return { label: `DeepSeek · ${modelName}`, badge: "LIVE DEEPSEEK" };
  return { label: `${provider} · ${modelName}`, badge: "LIVE AI" };
}

export function DemoProductShell({ config }: { config: DemoProductConfig }) {
  const [entityId, setEntityId] = useState<DemoEntity["id"]>(config.entities[0].id);
  const [model, setModel] = useState<ModelDisplay>({ label: "正在连接模型", badge: "AI DEMO" });
  const selected = config.entities.find((entity) => entity.id === entityId) ?? config.entities[0];
  const context = contextFor(config, selected);
  const controller = useMemo(
    () =>
      new AssistantController({
        presentation: "inline",
        getAccessCredential: () => "mock-token-admin",
        initialContext: contextFor(config, config.entities[0]),
        title: `${config.brand} 智能助手`,
      }),
    [config],
  );

  useEffect(() => controller.updateContext(context), [context, controller]);

  useEffect(() => {
    const abortController = new AbortController();
    void fetch("/api/v1/models", {
      headers: { authorization: "Bearer mock-token-admin" },
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Model status request failed with ${response.status}.`);
        setModel(modelDisplay(await response.json()));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setModel({ label: "模型连接失败", badge: "AI ERROR" });
        }
      });
    return () => abortController.abort();
  }, []);

  const style = {
    "--product-accent": config.accent,
    "--product-accent-strong": config.accentStrong,
    "--product-canvas": config.canvas,
    "--product-panel": config.panel,
  } as CSSProperties;

  return (
    <div className={`product-demo product-demo--${config.productCode.toLowerCase()}`} style={style}>
      <aside className="product-sidebar">
        <div className="product-mark" aria-hidden="true">
          {config.productCode}
        </div>
        <div className="product-brand">
          <strong>{config.brand}</strong>
          <span>ENTERPRISE SUITE</span>
        </div>
        <nav aria-label={`${config.brand} 主导航`}>
          {config.navItems.map((item, index) => (
            <button className={item === config.activeNav ? "active" : ""} key={item} type="button">
              <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
              {item}
            </button>
          ))}
        </nav>
        <div className="product-sidebar-foot">
          <span className="status-dot" />
          <div>
            <strong>演示环境在线</strong>
            <small>Mock Identity · {model.label}</small>
          </div>
        </div>
      </aside>

      <div className="product-page">
        <header className="product-topbar">
          <div>
            <span className="crumb">工作台 / {config.activeNav}</span>
            <strong>{config.eyebrow}</strong>
          </div>
          <div className="product-actions">
            <span className="demo-badge">{model.badge}</span>
            <button type="button" aria-label="通知">
              <span aria-hidden="true">•••</span>
            </button>
            <span className="avatar">陈</span>
          </div>
        </header>

        <main className="product-content">
          <section className="product-intro">
            <div>
              <span className="section-kicker">{config.eyebrow}</span>
              <h1>{config.title}</h1>
              <p>{config.description}</p>
            </div>
            <div className="context-proof">
              <span>助手当前感知</span>
              <strong>{selected.name}</strong>
              <code>{selected.route}</code>
            </div>
          </section>

          <section className="entity-switcher" aria-label="选择业务对象">
            {config.entities.map((entity) => (
              <button
                className={entity.id === selected.id ? "active" : ""}
                key={entity.id}
                onClick={() => setEntityId(entity.id)}
                type="button"
              >
                <span>{entity.kind}</span>
                <strong>{entity.name}</strong>
                <small>{entity.owner}</small>
              </button>
            ))}
          </section>

          <section className="product-grid">
            <div className="product-overview">
              <div className="metrics-grid">
                <Metric label="质量评分" value={`${selected.quality}%`} meta="标准能力实时映射" />
                <Metric label="数据规模" value={selected.records} meta="当前授权对象范围" />
                <Metric label="最近更新" value={selected.freshness} meta="Asia/Shanghai" />
              </div>

              <article className="quality-card">
                <div className="card-heading">
                  <div>
                    <span>QUALITY PULSE</span>
                    <h2>{selected.name}质量趋势</h2>
                  </div>
                  <span className="status-pill">{selected.status}</span>
                </div>
                <div className="trend-stage" aria-label={`质量评分 ${selected.quality}%`}>
                  {[88, 90, 91, 94, 93, selected.quality].map((point, index) => (
                    <div className="trend-column" key={`${point}-${index}`}>
                      <i style={{ height: `${point - 68}%` }} />
                      <span>{index + 9}日</span>
                    </div>
                  ))}
                  <div className="trend-score">
                    <strong>{selected.quality}</strong>
                    <span>当前得分</span>
                  </div>
                </div>
              </article>

              <article className="activity-card">
                <div className="card-heading">
                  <div>
                    <span>RECENT SIGNALS</span>
                    <h2>最近业务信号</h2>
                  </div>
                  <button type="button">查看全部</button>
                </div>
                <div className="activity-list">
                  {config.activities.map((activity) => (
                    <div className="activity-row" key={`${activity.time}-${activity.title}`}>
                      <span className={`activity-tone activity-tone--${activity.tone}`} />
                      <time>{activity.time}</time>
                      <div>
                        <strong>{activity.title}</strong>
                        <small>{activity.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <aside className="assistant-stage" aria-label="嵌入式业务智能助手">
              <div className="assistant-stage-head">
                <div>
                  <span>CONTEXT-AWARE ASSISTANT</span>
                  <h2>业务智能助手</h2>
                </div>
                <span className="live-chip">
                  <i /> 已连接
                </span>
              </div>
              <p className="assistant-hint">
                试着询问“当前数据质量怎么样？”助手会使用右侧已授权对象调用标准能力并返回证据。
              </p>
              <div className="assistant-embedded">
                <AssistantProvider controller={controller}>
                  <AssistantSurface />
                </AssistantProvider>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
