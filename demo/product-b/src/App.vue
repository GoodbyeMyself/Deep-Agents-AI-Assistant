<script setup lang="ts">
import { AssistantApiTransport } from "@assistant/assistant-transport";
import type { RawHostContext } from "@assistant/context";
import { createIframeHostBridge } from "@assistant/iframe-bridge";
import {
  ElAside,
  ElBadge,
  ElButton,
  ElCard,
  ElContainer,
  ElHeader,
  ElMain,
  ElProgress,
  ElTag,
} from "element-plus";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface AssetEntity {
  readonly id: "orders" | "customers";
  readonly name: string;
  readonly code: string;
  readonly route: string;
  readonly owner: string;
  readonly records: string;
  readonly quality: number;
  readonly freshness: string;
  readonly calls: string;
}

interface ModelDisplay {
  readonly label: string;
  readonly badge: string;
  readonly live: boolean;
}

const assets: readonly AssetEntity[] = [
  {
    id: "orders",
    name: "交易订单资产",
    code: "ASSET-TRADE-001",
    route: "/assets/catalog/orders",
    owner: "交易资产组 · 周航",
    records: "2.48M",
    quality: 96,
    freshness: "8 分钟前",
    calls: "18.6K",
  },
  {
    id: "customers",
    name: "客户画像资产",
    code: "ASSET-CDP-017",
    route: "/assets/catalog/customers",
    owner: "客户资产组 · 林希",
    records: "684K",
    quality: 96,
    freshness: "12 分钟前",
    calls: "9.2K",
  },
];

const selectedId = ref<AssetEntity["id"]>("orders");
const selected = computed(
  () => assets.find((asset) => asset.id === selectedId.value) ?? assets[0]!,
);
const model = ref<ModelDisplay>({ label: "正在连接模型", badge: "AI CONNECTING", live: false });
const frameStatus = ref<"connecting" | "ready" | "error">("connecting");
const iframe = ref<HTMLIFrameElement>();
const assistantOrigin = "http://127.0.0.1:5512";
const channelId = crypto.randomUUID();
const transport = new AssistantApiTransport({ getAccessCredential: () => "mock-token-admin" });
let bridge: ReturnType<typeof createIframeHostBridge> | undefined;

const context = computed<RawHostContext>(() => ({
  page: { route: selected.value.route, title: selected.value.name, type: "asset-detail" },
  object: { type: "data_asset", rawId: selected.value.id, name: selected.value.name },
  business: { domain: "asset-operations", module: "quality" },
  metadata: { demoProduct: "B", environment: "demo", assetCode: selected.value.code },
}));

const frameSrc = `${assistantOrigin}/?hostOrigin=${encodeURIComponent(location.origin)}&channelId=${channelId}`;

function parseModel(value: unknown): ModelDisplay {
  if (typeof value !== "object" || value === null) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const item: unknown = items[0];
  if (typeof item !== "object" || item === null) {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  const provider = (item as { provider?: unknown }).provider;
  const modelName = (item as { model?: unknown }).model;
  if (typeof provider !== "string" || typeof modelName !== "string") {
    return { label: "模型状态未知", badge: "AI DEMO", live: false };
  }
  return provider === "deepseek"
    ? { label: `DeepSeek · ${modelName}`, badge: "LIVE DEEPSEEK", live: true }
    : { label: `${provider} · ${modelName}`, badge: "TEST MODEL", live: false };
}

async function loadModel(): Promise<void> {
  try {
    const response = await fetch("/api/v1/models", {
      headers: { authorization: "Bearer mock-token-admin" },
    });
    if (!response.ok) throw new Error(`Model status request failed with ${response.status}.`);
    model.value = parseModel(await response.json());
  } catch {
    model.value = { label: "模型连接失败", badge: "AI ERROR", live: false };
  }
}

onMounted(() => {
  void loadModel();
  if (!iframe.value) return;
  bridge = createIframeHostBridge({
    iframe: iframe.value,
    targetOrigin: assistantOrigin,
    channelId,
    getTicket: async () => (await transport.createEmbedTicket(assistantOrigin)).ticket,
    getContext: () => context.value,
    onReady: () => (frameStatus.value = "ready"),
    onError: () => (frameStatus.value = "error"),
  });
  bridge.start();
});

watch(context, (nextContext) => bridge?.updateContext(nextContext));
onBeforeUnmount(() => bridge?.destroy());
</script>

<template>
  <el-container class="northstar-app">
    <el-aside class="northstar-rail" width="84px">
      <div class="rail-mark">N</div>
      <nav aria-label="主导航">
        <button class="rail-item" type="button" aria-label="工作台">
          <span>⌂</span><small>工作台</small>
        </button>
        <button class="rail-item active" type="button" aria-label="资产">
          <span>◆</span><small>资产</small>
        </button>
        <button class="rail-item" type="button" aria-label="服务">
          <span>↗</span><small>服务</small>
        </button>
        <button class="rail-item" type="button" aria-label="风险">
          <span>△</span><small>风险</small>
        </button>
      </nav>
      <button class="rail-avatar" type="button" aria-label="账户">林</button>
    </el-aside>

    <el-container class="northstar-main">
      <el-header class="northstar-header" height="72px">
        <div class="wordmark">
          <strong>NORTHSTAR OPS</strong>
          <span>数据资产运营平台</span>
        </div>
        <div class="header-center">
          <span class="environment-dot" />
          <span>华东区域 · 生产数据空间</span>
        </div>
        <div class="header-actions">
          <el-tag :type="model.live ? 'success' : 'warning'" effect="plain" round>{{
            model.badge
          }}</el-tag>
          <el-button circle aria-label="搜索">⌕</el-button>
          <el-button circle aria-label="通知"><el-badge is-dot>◎</el-badge></el-button>
        </div>
      </el-header>

      <el-main class="northstar-content">
        <section class="asset-hero">
          <div class="hero-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div class="hero-copy">
            <span class="hero-kicker">ASSET INTELLIGENCE · PRODUCT B</span>
            <h1>数据资产驾驶舱</h1>
            <p>连接资产、服务与消费场景，让可信数据在组织中持续流动。</p>
          </div>
          <div class="hero-score">
            <span>资产健康指数</span>
            <strong>92.8</strong>
            <small>较昨日 <b>+1.6%</b></small>
          </div>
          <div class="hero-meta">
            <span><b>1,286</b> 已上架资产</span>
            <span><b>238</b> 服务中</span>
            <span><b>99.96%</b> 服务可用性</span>
          </div>
        </section>

        <section class="content-heading">
          <div>
            <span class="section-kicker">ASSET OPERATIONS</span>
            <h2>核心资产运行态势</h2>
          </div>
          <div class="period-tabs" aria-label="时间范围">
            <button type="button">今日</button><button class="active" type="button">近 7 天</button
            ><button type="button">近 30 天</button>
          </div>
        </section>

        <div class="operations-grid">
          <div class="asset-column">
            <section class="asset-selector" aria-label="选择业务对象">
              <button
                v-for="asset in assets"
                :key="asset.id"
                :class="['asset-tile', { active: selectedId === asset.id }]"
                type="button"
                @click="selectedId = asset.id"
              >
                <span class="asset-cube"><i /><i /><i /></span>
                <span class="asset-tile-copy">
                  <small>{{ asset.code }}</small>
                  <strong>{{ asset.name }}</strong>
                  <span>{{ asset.owner }}</span>
                </span>
                <span class="asset-tile-score"
                  ><b>{{ asset.quality }}</b
                  ><small>质量分</small></span
                >
              </button>
            </section>

            <section class="metric-grid">
              <el-card shadow="never" class="metric-panel">
                <span>今日服务调用</span><strong>{{ selected.calls }}</strong
                ><small class="up">↗ 12.4%</small>
              </el-card>
              <el-card shadow="never" class="metric-panel">
                <span>资产数据量</span><strong>{{ selected.records }}</strong
                ><small>授权范围内</small>
              </el-card>
              <el-card shadow="never" class="metric-panel">
                <span>数据新鲜度</span><strong>{{ selected.freshness }}</strong
                ><small class="up">同步正常</small>
              </el-card>
            </section>

            <el-card shadow="never" class="topology-card">
              <template #header>
                <div class="panel-heading">
                  <div>
                    <span class="section-kicker">FLOW TOPOLOGY</span>
                    <h3>资产消费链路</h3>
                  </div>
                  <el-tag type="success" effect="dark" round>运行正常</el-tag>
                </div>
              </template>
              <div class="topology-stage">
                <div class="flow-line line-one" />
                <div class="flow-line line-two" />
                <div class="node source">
                  <i>源</i><strong>业务交易库</strong><span>8 张表</span>
                </div>
                <div class="node core">
                  <i>资</i><strong>{{ selected.name }}</strong
                  ><span>{{ selected.code }}</span>
                </div>
                <div class="node target target-a">
                  <i>服</i><strong>经营分析服务</strong><span>12 个消费者</span>
                </div>
                <div class="node target target-b">
                  <i>API</i><strong>实时查询服务</strong><span>6 个应用</span>
                </div>
              </div>
            </el-card>

            <div class="lower-grid">
              <el-card shadow="never" class="quality-panel">
                <template #header
                  ><div class="panel-heading">
                    <div>
                      <span class="section-kicker">QUALITY SIGNAL</span>
                      <h3>质量维度</h3>
                    </div>
                    <b>{{ selected.quality }}%</b>
                  </div></template
                >
                <div class="quality-item">
                  <span>完整性</span
                  ><el-progress :percentage="98" :show-text="false" color="#7ad9be" /><b>98</b>
                </div>
                <div class="quality-item">
                  <span>准确性</span
                  ><el-progress :percentage="96" :show-text="false" color="#55bce8" /><b>96</b>
                </div>
                <div class="quality-item">
                  <span>一致性</span
                  ><el-progress :percentage="94" :show-text="false" color="#b7dc67" /><b>94</b>
                </div>
              </el-card>
              <el-card shadow="never" class="activity-panel">
                <template #header
                  ><div class="panel-heading">
                    <div>
                      <span class="section-kicker">LIVE ACTIVITY</span>
                      <h3>实时动态</h3>
                    </div>
                    <el-button link>全部</el-button>
                  </div></template
                >
                <div class="activity">
                  <i class="good" />
                  <div><strong>服务健康检查通过</strong><span>可用性保持在 99.98%</span></div>
                  <time>09:46</time>
                </div>
                <div class="activity">
                  <i />
                  <div><strong>消费量达到业务峰值</strong><span>6 个授权应用正在调用</span></div>
                  <time>09:21</time>
                </div>
                <div class="activity">
                  <i class="warn" />
                  <div><strong>质量阈值接近预警线</strong><span>地址标准化指标待复核</span></div>
                  <time>08:48</time>
                </div>
              </el-card>
            </div>
          </div>

          <aside class="copilot-panel" aria-label="iframe 嵌入式业务智能助手">
            <header>
              <div>
                <span class="copilot-glyph">✦</span>
                <div><strong>资产运营助手</strong><small>基于当前页面上下文</small></div>
              </div>
              <el-tag type="success" effect="plain" round>安全连接</el-tag>
            </header>
            <div class="context-ribbon">
              <span>正在查看</span><strong>{{ selected.name }}</strong
              ><code>{{ selected.route }}</code>
            </div>
            <div class="assistant-frame-shell">
              <div
                v-if="frameStatus !== 'ready'"
                :class="['assistant-status', `assistant-status--${frameStatus}`]"
                role="status"
              >
                <i />{{ frameStatus === "error" ? "助手连接失败" : "正在建立安全通道" }}
              </div>
              <iframe
                ref="iframe"
                title="企业业务智能助手"
                sandbox="allow-scripts allow-same-origin"
                :src="frameSrc"
              />
            </div>
          </aside>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>
