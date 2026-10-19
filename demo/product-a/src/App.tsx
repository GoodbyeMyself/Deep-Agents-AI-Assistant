import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { PageContainer, ProCard, ProLayout, StatisticCard } from "@ant-design/pro-components";
import type { RawHostContext } from "@assistant/context";
import { Avatar, Button, ConfigProvider, Flex, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { productConfig, type DemoEntity } from "./config.js";
import "./app.css";

const { Text, Title } = Typography;

interface ModelDisplay {
  readonly label: string;
  readonly badge: string;
  readonly live: boolean;
}

const menuIcons = [
  <AppstoreOutlined key="overview" />,
  <DatabaseOutlined key="catalog" />,
  <SafetyCertificateOutlined key="quality" />,
  <AlertOutlined key="issue" />,
  <AuditOutlined key="audit" />,
];

function contextFor(entity: DemoEntity): RawHostContext {
  return {
    page: { route: entity.route, title: entity.name, type: "asset-detail" },
    object: { type: entity.kind, rawId: entity.id, name: entity.name },
    business: { domain: "data-governance", module: "quality" },
    metadata: { demoProduct: productConfig.productCode, environment: "demo" },
  };
}

function modelDisplay(value: unknown): ModelDisplay {
  if (typeof value !== "object" || value === null) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const model: unknown = items[0];
  if (typeof model !== "object" || model === null) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const provider = (model as { provider?: unknown }).provider;
  const modelName = (model as { model?: unknown }).model;
  if (typeof provider !== "string" || typeof modelName !== "string") {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  return provider === "deepseek"
    ? { label: `DeepSeek · ${modelName}`, badge: "LIVE DEEPSEEK", live: true }
    : { label: `${provider} · ${modelName}`, badge: "TEST MODEL", live: false };
}

export function App() {
  const [entityId, setEntityId] = useState<DemoEntity["id"]>(productConfig.entities[0].id);
  const [model, setModel] = useState<ModelDisplay>({
    label: "正在连接模型",
    badge: "AI CONNECTING",
    live: false,
  });

  const selected =
    productConfig.entities.find((entity) => entity.id === entityId) ?? productConfig.entities[0];

  const route = useMemo(
    () => ({
      path: "/overview",
      routes: productConfig.navItems.map((name, index) => ({
        path: index === 0 ? "/overview" : `/nav-${index}`,
        name,
        icon: menuIcons[index],
      })),
    }),
    [],
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("enterprise-assistant:context", {
        detail: contextFor(selected),
      }),
    );
  }, [selected]);

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
          setModel({ label: "模型连接失败", badge: "AI ERROR", live: false });
        }
      });
    return () => abortController.abort();
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
        },
      }}
    >
      <ProLayout
        title="AURORA CONTROL"
        logo={
          <div className="pro-demo-logo" aria-hidden>
            A
          </div>
        }
        layout="mix"
        fixSiderbar
        location={{ pathname: "/overview" }}
        route={route}
        menuItemRender={(item, dom) => <span>{dom}</span>}
        siderWidth={228}
        contentStyle={{ minHeight: "calc(100vh - 56px)" }}
        actionsRender={() => [
          <Tag key="model" color={model.live ? "success" : "default"}>
            {model.badge}
          </Tag>,
          <Tooltip key="notify" title="系统通知">
            <Button aria-label="通知" type="text" icon={<BellOutlined />} />
          </Tooltip>,
          <Tooltip key="settings" title="全局设置">
            <Button aria-label="设置" type="text" icon={<SettingOutlined />} />
          </Tooltip>,
          <Avatar key="user">陈</Avatar>,
        ]}
      >
        <PageContainer
          header={{
            title: (
              <div>
                <Text type="secondary">{productConfig.eyebrow}</Text>
                <Title level={1} style={{ margin: "4px 0 8px" }}>
                  {productConfig.title}
                </Title>
                <Text>{productConfig.description}</Text>
              </div>
            ),
            breadcrumb: {
              items: [
                { title: "数据治理中心" },
                { title: productConfig.activeNav },
                { title: "华东生产环境" },
              ],
            },
          }}
        >
          <div className="pro-demo-metrics">
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: "综合质量评分",
                  value: selected.quality,
                  suffix: "%",
                  description: <Text type="success">↑ 2.4% 较上周</Text>,
                }}
                chart={<SafetyCertificateOutlined className="pro-demo-metric-icon" />}
              />
              <StatisticCard
                statistic={{
                  title: "活跃质量规则",
                  value: 1284,
                  description: "今日执行 24,680 次",
                }}
                chart={<LineChartOutlined className="pro-demo-metric-icon" />}
              />
              <StatisticCard
                statistic={{
                  title: "待处理问题",
                  value: 18,
                  description: <Text type="warning">5 项将在 24h 内超时</Text>,
                }}
                chart={<AlertOutlined className="pro-demo-metric-icon" />}
              />
              <StatisticCard
                statistic={{
                  title: "责任人覆盖率",
                  value: "98.6",
                  suffix: "%",
                  description: "已覆盖 642 个对象",
                }}
                chart={<TeamOutlined className="pro-demo-metric-icon" />}
              />
            </StatisticCard.Group>
          </div>

          <ProCard title="当前治理对象" subTitle="CURRENT GOVERNANCE OBJECT" style={{ marginTop: 16 }}>
            <Flex gap={12} wrap="wrap" aria-label="选择业务对象">
              {productConfig.entities.map((entity) => (
                <Button
                  key={entity.id}
                  type={entity.id === selected.id ? "primary" : "default"}
                  className="pro-demo-entity"
                  onClick={() => setEntityId(entity.id)}
                >
                  <Flex align="center" gap={12}>
                    <DatabaseOutlined />
                    <span className="pro-demo-entity-copy">
                      <strong>{entity.name}</strong>
                      <small>{entity.owner}</small>
                    </span>
                    <span className="pro-demo-entity-score">
                      {entity.quality}
                      <small>分</small>
                    </span>
                  </Flex>
                </Button>
              ))}
            </Flex>
            <div className="pro-demo-context-strip">
              <CheckCircleFilled />
              <span>助手已同步当前页面上下文</span>
              <strong>{selected.name}</strong>
              <code>{selected.route}</code>
            </div>
          </ProCard>

          <Flex gap={16} wrap="wrap" style={{ marginTop: 16 }}>
            <ProCard
              className="pro-demo-trend"
              title={`${selected.name}质量趋势`}
              subTitle="QUALITY TREND · 7 DAYS"
              extra={<Tag color="green">{selected.status}</Tag>}
            >
              <div className="quality-chart" aria-label={`质量评分 ${selected.quality}%`}>
                <svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img">
                  <defs>
                    <linearGradient id="qualityArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#1677ff" stopOpacity=".22" />
                      <stop offset="1" stopColor="#1677ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="chart-area"
                    d="M0 150 L100 127 L200 132 L300 89 L400 98 L500 55 L600 63 L600 190 L0 190 Z"
                  />
                  <path
                    className="chart-line"
                    d="M0 150 L100 127 L200 132 L300 89 L400 98 L500 55 L600 63"
                  />
                  <circle cx="600" cy="63" r="6" fill="#1677ff" />
                </svg>
              </div>
            </ProCard>

            <ProCard className="pro-demo-signals" title="治理动态" subTitle="RECENT SIGNALS">
              <div className="signal-list">
                {productConfig.activities.map((activity) => (
                  <div className="signal-item" key={`${activity.time}-${activity.title}`}>
                    <span className={`signal-dot signal-dot--${activity.tone}`} />
                    <div>
                      <Flex justify="space-between">
                        <strong>{activity.title}</strong>
                        <time>{activity.time}</time>
                      </Flex>
                      <Text type="secondary">{activity.detail}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </ProCard>
          </Flex>
        </PageContainer>
      </ProLayout>
    </ConfigProvider>
  );
}
