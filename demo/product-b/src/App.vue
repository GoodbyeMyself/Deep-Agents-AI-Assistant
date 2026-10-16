<script setup lang="ts">
import type { RawHostContext } from "@assistant/context";
import { computed, onMounted, ref, watch } from "vue";

import { productConfig, type AssetEntity } from "./config";

interface ModelDisplay {
  readonly label: string;
  readonly badge: string;
  readonly live: boolean;
}

const selectedId = ref<AssetEntity["id"]>("orders");
const selected = computed(
  () =>
    productConfig.assets.find((asset) => asset.id === selectedId.value) ?? productConfig.assets[0]!,
);
const model = ref<ModelDisplay>({ label: "正在连接模型", badge: "AI CONNECTING", live: false });

const context = computed<RawHostContext>(() => ({
  page: { route: selected.value.route, title: selected.value.name, type: "asset-detail" },
  object: { type: "data_asset", rawId: selected.value.id, name: selected.value.name },
  business: { domain: "asset-operations", module: "quality" },
  metadata: { demoProduct: "B", environment: "demo", assetCode: selected.value.code },
}));

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
});

watch(
  context,
  (nextContext) =>
    window.dispatchEvent(new CustomEvent("enterprise-assistant:context", { detail: nextContext })),
  { immediate: true },
);
</script>

<template>
  <el-container class="art-pro-layout">
    <el-aside class="art-pro-sider" width="240px">
      <div class="art-pro-brand">
        <span class="art-pro-brand-mark">N</span>
        <div>
          <strong>{{ productConfig.brand }}</strong>
          <small>{{ productConfig.subtitle }}</small>
        </div>
      </div>
      <el-menu :default-active="productConfig.activeNav" class="art-pro-menu">
        <el-menu-item v-for="item in productConfig.navItems" :key="item.key" :index="item.key">
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="art-pro-main-wrap">
      <el-header class="art-pro-header" height="56px">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>数据资产</el-breadcrumb-item>
          <el-breadcrumb-item>资产目录</el-breadcrumb-item>
          <el-breadcrumb-item>华东区域 · 生产数据空间</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="art-pro-header-actions">
          <el-tag :type="model.live ? 'success' : 'warning'" effect="plain" round>{{
            model.badge
          }}</el-tag>
          <el-button circle aria-label="搜索">⌕</el-button>
        </div>
      </el-header>

      <el-main class="art-pro-main">
        <section class="art-pro-page-head">
          <div>
            <span class="art-pro-kicker">{{ productConfig.kicker }}</span>
            <h1>{{ productConfig.title }}</h1>
            <p>{{ productConfig.description }}</p>
          </div>
          <el-card shadow="never" class="art-pro-hero-score">
            <span>资产健康指数</span>
            <strong>92.8</strong>
            <small>较昨日 <b>+1.6%</b></small>
          </el-card>
        </section>

        <section class="art-pro-section-head">
          <div>
            <span class="art-pro-kicker">ASSET OPERATIONS</span>
            <h2>核心资产运行态势</h2>
          </div>
          <el-radio-group model-value="7d" size="small">
            <el-radio-button label="today">今日</el-radio-button>
            <el-radio-button label="7d">近 7 天</el-radio-button>
            <el-radio-button label="30d">近 30 天</el-radio-button>
          </el-radio-group>
        </section>

        <section class="art-pro-asset-picker" aria-label="选择业务对象">
          <el-button
            v-for="asset in productConfig.assets"
            :key="asset.id"
            :type="selectedId === asset.id ? 'primary' : 'default'"
            class="art-pro-asset-btn"
            @click="selectedId = asset.id"
          >
            <span class="art-pro-asset-copy">
              <small>{{ asset.code }}</small>
              <strong>{{ asset.name }}</strong>
              <span>{{ asset.owner }}</span>
            </span>
            <span class="art-pro-asset-score">
              <b>{{ asset.quality }}</b>
              <small>质量分</small>
            </span>
          </el-button>
        </section>

        <div class="art-pro-context-strip">
          <span>助手已同步当前资产上下文</span>
          <strong>{{ selected.name }}</strong>
          <code>{{ selected.route }}</code>
        </div>

        <section class="art-pro-metrics">
          <el-card shadow="hover" class="art-pro-metric">
            <span>今日服务调用</span>
            <strong>{{ selected.calls }}</strong>
            <small class="up">↗ 12.4%</small>
          </el-card>
          <el-card shadow="hover" class="art-pro-metric">
            <span>资产数据量</span>
            <strong>{{ selected.records }}</strong>
            <small>授权范围内</small>
          </el-card>
          <el-card shadow="hover" class="art-pro-metric">
            <span>数据新鲜度</span>
            <strong>{{ selected.freshness }}</strong>
            <small class="up">同步正常</small>
          </el-card>
          <el-card shadow="hover" class="art-pro-metric">
            <span>综合质量</span>
            <strong>{{ selected.quality }}%</strong>
            <small>运行稳定</small>
          </el-card>
        </section>

        <div class="art-pro-panels">
          <el-card shadow="never" class="art-pro-panel">
            <template #header>
              <div class="art-pro-panel-head">
                <div>
                  <span class="art-pro-kicker">FLOW TOPOLOGY</span>
                  <h3>资产消费链路</h3>
                </div>
                <el-tag type="success" effect="light" round>运行正常</el-tag>
              </div>
            </template>
            <div class="art-pro-topology">
              <div class="art-pro-node">业务交易库 · 8 张表</div>
              <div class="art-pro-flow">→</div>
              <div class="art-pro-node art-pro-node--core">
                {{ selected.name }} · {{ selected.code }}
              </div>
              <div class="art-pro-flow">→</div>
              <div class="art-pro-node">经营分析服务 · 12 消费者</div>
            </div>
          </el-card>

          <el-card shadow="never" class="art-pro-panel">
            <template #header>
              <div class="art-pro-panel-head">
                <div>
                  <span class="art-pro-kicker">QUALITY SIGNAL</span>
                  <h3>质量维度</h3>
                </div>
                <b>{{ selected.quality }}%</b>
              </div>
            </template>
            <div class="art-pro-quality-row">
              <span>完整性</span>
              <el-progress :percentage="98" :show-text="false" />
              <b>98</b>
            </div>
            <div class="art-pro-quality-row">
              <span>准确性</span>
              <el-progress :percentage="96" :show-text="false" color="#36cfc9" />
              <b>96</b>
            </div>
            <div class="art-pro-quality-row">
              <span>一致性</span>
              <el-progress :percentage="94" :show-text="false" color="#73d13d" />
              <b>94</b>
            </div>
          </el-card>

          <el-card shadow="never" class="art-pro-panel">
            <template #header>
              <div class="art-pro-panel-head">
                <div>
                  <span class="art-pro-kicker">LIVE ACTIVITY</span>
                  <h3>实时动态</h3>
                </div>
                <el-button link type="primary">全部</el-button>
              </div>
            </template>
            <div
              v-for="item in productConfig.activities"
              :key="item.time"
              class="art-pro-activity"
            >
              <i :class="item.tone" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.detail }}</span>
              </div>
              <time>{{ item.time }}</time>
            </div>
          </el-card>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>
