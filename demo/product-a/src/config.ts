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

export const productConfig = {
  productCode: "A" as const,
  brand: "AURORA CONTROL",
  eyebrow: "Product A · 数据治理中心",
  title: "数据质量运营台",
  description:
    "面向治理团队的统一数据质量视图。助手会继承当前用户权限和正在查看的数据对象，通过标准能力获取趋势与证据。",
  accent: "#18a67f",
  navItems: ["运营总览", "数据目录", "质量规则", "问题工单", "审计中心"] as const,
  activeNav: "运营总览",
  entities: [
    {
      id: "orders",
      name: "订单明细表",
      kind: "data_table",
      route: "/governance/tables/orders",
      owner: "交易数据域 · 王宁",
      records: "2.48M",
      quality: 96,
      freshness: "8 分钟前",
      status: "质量稳定",
    },
    {
      id: "customers",
      name: "客户主数据表",
      kind: "data_table",
      route: "/governance/tables/customers",
      owner: "客户数据域 · 李然",
      records: "684K",
      quality: 96,
      freshness: "12 分钟前",
      status: "质量稳定",
    },
  ] as const satisfies readonly DemoEntity[],
  activities: [
    {
      time: "09:42",
      title: "完整性规则执行完成",
      detail: "18 项规则通过，2 项需要关注",
      tone: "good",
    },
    {
      time: "09:18",
      title: "字段空值率轻微上升",
      detail: "shipping_address 较昨日增加 0.4%",
      tone: "warn",
    },
    { time: "08:55", title: "血缘同步完成", detail: "已更新 7 个下游消费节点", tone: "neutral" },
  ] as const satisfies readonly DemoActivity[],
};
