import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  MoreOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { RawHostContext } from "@assistant/context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Flex,
  Layout,
  Menu,
  Progress,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

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

interface ModelDisplay {
  readonly label: string;
  readonly badge: string;
  readonly live: boolean;
}

function contextFor(config: DemoProductConfig, entity: DemoEntity): RawHostContext {
  return {
    page: { route: entity.route, title: entity.name, type: "asset-detail" },
    object: { type: entity.kind, rawId: entity.id, name: entity.name },
    business: { domain: "data-governance", module: "quality" },
    metadata: { demoProduct: config.productCode, environment: "demo" },
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

const menuIcons = [
  <AppstoreOutlined key="overview" />,
  <DatabaseOutlined key="catalog" />,
  <SafetyCertificateOutlined key="quality" />,
  <AlertOutlined key="issue" />,
  <AuditOutlined key="audit" />,
];

export function DemoProductShell({ config }: { config: DemoProductConfig }) {
  const [entityId, setEntityId] = useState<DemoEntity["id"]>(config.entities[0].id);
  const [model, setModel] = useState<ModelDisplay>({
    label: "正在连接模型",
    badge: "AI CONNECTING",
    live: false,
  });
  const selected = config.entities.find((entity) => entity.id === entityId) ?? config.entities[0];

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("enterprise-assistant:context", {
        detail: contextFor(config, selected),
      }),
    );
  }, [config, selected]);

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

  const navItems = config.navItems.map((label, index) => ({
    key: label,
    icon: menuIcons[index],
    label,
  }));

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0f8f70",
          borderRadius: 10,
          fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
          colorText: "#17322b",
        },
      }}
    >
      <Layout className="aurora-app">
        <Sider className="aurora-sider" width={244} breakpoint="lg" collapsedWidth={0}>
          <div className="brand-lockup">
            <span className="brand-glyph">A</span>
            <div>
              <strong>{config.brand}</strong>
              <small>DATA GOVERNANCE CLOUD</small>
            </div>
          </div>
          <Text className="menu-label">工作空间</Text>
          <Menu
            className="aurora-menu"
            mode="inline"
            theme="dark"
            selectedKeys={[config.activeNav]}
            items={navItems}
          />
          <div className="sider-spacer" />
          <Card className="governance-score" bordered={false}>
            <Flex justify="space-between" align="center">
              <Text>治理成熟度</Text>
              <Tag color="green">本月 +4.2%</Tag>
            </Flex>
            <strong>LEVEL 4</strong>
            <Progress percent={82} showInfo={false} strokeColor="#63d9ae" trailColor="#29453f" />
          </Card>
          <div className="sider-status">
            <Badge status={model.live ? "success" : "warning"} />
            <div>
              <strong>演示环境在线</strong>
              <small>{model.label}</small>
            </div>
          </div>
        </Sider>

        <Layout className="aurora-main">
          <Header className="aurora-header">
            <div>
              <Text type="secondary">数据治理中心 / 运营总览</Text>
              <strong>华东生产环境</strong>
            </div>
            <Space size={12}>
              <Tag className={model.live ? "model-tag model-tag--live" : "model-tag"}>
                <span /> {model.badge}
              </Tag>
              <Tooltip title="系统通知">
                <Button aria-label="通知" shape="circle" icon={<BellOutlined />} />
              </Tooltip>
              <Tooltip title="全局设置">
                <Button aria-label="设置" shape="circle" icon={<SettingOutlined />} />
              </Tooltip>
              <Avatar className="user-avatar">陈</Avatar>
              <div className="user-meta">
                <strong>陈思远</strong>
                <small>数据治理管理员</small>
              </div>
            </Space>
          </Header>

          <Content className="aurora-content">
            <section className="page-heading">
              <div>
                <Text className="eyebrow">{config.eyebrow}</Text>
                <Title level={1}>{config.title}</Title>
                <Text>{config.description}</Text>
              </div>
              <Space>
                <Button icon={<FileSearchOutlined />}>导出治理报告</Button>
                <Button type="primary" icon={<SafetyCertificateOutlined />}>
                  新建质量规则
                </Button>
              </Space>
            </section>

            <div className="workspace-grid">
              <div className="governance-column">
                <section className="metric-row" aria-label="数据治理指标">
                  <Card className="metric-card" bordered={false}>
                    <Statistic title="综合质量评分" value={selected.quality} suffix="%" />
                    <Text className="metric-delta positive">↑ 2.4% 较上周</Text>
                    <SafetyCertificateOutlined className="metric-watermark" />
                  </Card>
                  <Card className="metric-card" bordered={false}>
                    <Statistic title="活跃质量规则" value={1284} />
                    <Text className="metric-delta">今日执行 24,680 次</Text>
                    <LineChartOutlined className="metric-watermark" />
                  </Card>
                  <Card className="metric-card" bordered={false}>
                    <Statistic title="待处理问题" value={18} />
                    <Text className="metric-delta warning">5 项将在 24h 内超时</Text>
                    <AlertOutlined className="metric-watermark" />
                  </Card>
                  <Card className="metric-card" bordered={false}>
                    <Statistic title="责任人覆盖率" value="98.6" suffix="%" />
                    <Text className="metric-delta positive">已覆盖 642 个对象</Text>
                    <TeamOutlined className="metric-watermark" />
                  </Card>
                </section>

                <Card className="asset-focus-card" bordered={false}>
                  <Flex className="card-titlebar" justify="space-between" align="center">
                    <div>
                      <Text className="section-code">CURRENT GOVERNANCE OBJECT</Text>
                      <Title level={3}>当前治理对象</Title>
                    </div>
                    <Button type="text" icon={<MoreOutlined />} aria-label="更多对象操作" />
                  </Flex>
                  <div className="entity-switcher" aria-label="选择业务对象">
                    {config.entities.map((entity) => (
                      <button
                        className={
                          entity.id === selected.id ? "entity-option active" : "entity-option"
                        }
                        key={entity.id}
                        onClick={() => setEntityId(entity.id)}
                        type="button"
                      >
                        <span className="entity-icon">
                          <DatabaseOutlined />
                        </span>
                        <span className="entity-copy">
                          <strong>{entity.name}</strong>
                          <small>{entity.owner}</small>
                        </span>
                        <span className="entity-score">
                          {entity.quality}
                          <small>分</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="context-strip">
                    <CheckCircleFilled />
                    <span>助手已同步当前页面上下文</span>
                    <strong>{selected.name}</strong>
                    <code>{selected.route}</code>
                  </div>
                </Card>

                <div className="analysis-grid">
                  <Card className="trend-card" bordered={false}>
                    <Flex className="card-titlebar" justify="space-between" align="start">
                      <div>
                        <Text className="section-code">QUALITY TREND · 7 DAYS</Text>
                        <Title level={3}>{selected.name}质量趋势</Title>
                      </div>
                      <Tag color="green">{selected.status}</Tag>
                    </Flex>
                    <div className="quality-chart" aria-label={`质量评分 ${selected.quality}%`}>
                      <span className="chart-label chart-label--top">100</span>
                      <span className="chart-label chart-label--middle">95</span>
                      <span className="chart-label chart-label--bottom">90</span>
                      <svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img">
                        <defs>
                          <linearGradient id="qualityArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#17a47d" stopOpacity=".26" />
                            <stop offset="1" stopColor="#17a47d" stopOpacity="0" />
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
                        <circle cx="600" cy="63" r="6" />
                      </svg>
                      <div className="chart-days">
                        <span>10/10</span>
                        <span>10/11</span>
                        <span>10/12</span>
                        <span>10/13</span>
                        <span>10/14</span>
                        <span>10/15</span>
                        <span>今天</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="signals-card" bordered={false}>
                    <Flex className="card-titlebar" justify="space-between" align="start">
                      <div>
                        <Text className="section-code">RECENT SIGNALS</Text>
                        <Title level={3}>治理动态</Title>
                      </div>
                      <Button type="link">查看全部</Button>
                    </Flex>
                    <div className="signal-list">
                      {config.activities.map((activity) => (
                        <div className="signal-item" key={`${activity.time}-${activity.title}`}>
                          <span className={`signal-dot signal-dot--${activity.tone}`} />
                          <div>
                            <Flex justify="space-between">
                              <strong>{activity.title}</strong>
                              <time>{activity.time}</time>
                            </Flex>
                            <Text>{activity.detail}</Text>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
