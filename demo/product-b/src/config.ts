export interface AssetEntity {
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

export const productConfig = {
  brand: "NORTHSTAR OPS",
  subtitle: "数据资产运营平台",
  kicker: "ASSET INTELLIGENCE · PRODUCT B",
  title: "数据资产驾驶舱",
  description: "连接资产、服务与消费场景，让可信数据在组织中持续流动。",
  navItems: [
    { key: "workspace", label: "工作台" },
    { key: "assets", label: "资产目录" },
    { key: "service", label: "数据服务" },
    { key: "risk", label: "风险中心" },
  ] as const,
  activeNav: "assets",
  assets: [
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
  ] as const satisfies readonly AssetEntity[],
  activities: [
    {
      tone: "good" as const,
      title: "服务健康检查通过",
      detail: "可用性保持在 99.98%",
      time: "09:46",
    },
    {
      tone: "neutral" as const,
      title: "消费量达到业务峰值",
      detail: "6 个授权应用正在调用",
      time: "09:21",
    },
    {
      tone: "warn" as const,
      title: "质量阈值接近预警线",
      detail: "地址标准化指标待复核",
      time: "08:48",
    },
  ],
};
