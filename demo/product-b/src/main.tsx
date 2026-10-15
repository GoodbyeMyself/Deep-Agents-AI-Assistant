import "antd/dist/reset.css";
import "@assistant/demo-product-shell/styles.css";

import { DemoProductShell, type DemoProductConfig } from "@assistant/demo-product-shell";
import { createRoot } from "react-dom/client";

const config: DemoProductConfig = {
  productCode: "B",
  brand: "NORTHSTAR OPS",
  eyebrow: "Product B · 数据资产运营",
  title: "数据资产驾驶舱",
  description:
    "面向资产运营团队的可信业务入口。Product B 使用不同的原始接口和比例字段，助手仍以同一标准契约返回可追溯结果。",
  accent: "#ef784d",
  accentStrong: "#3156a3",
  canvas: "#eef1f7",
  panel: "#ffffff",
  assistantOrigin: "http://127.0.0.1:5512",
  navItems: ["资产驾驶舱", "资产目录", "消费分析", "风险雷达", "服务管理"],
  activeNav: "资产驾驶舱",
  entities: [
    {
      id: "orders",
      name: "交易订单资产",
      kind: "data_asset",
      route: "/assets/catalog/orders",
      owner: "交易资产组 · 周航",
      records: "2.48M",
      quality: 96,
      freshness: "8 分钟前",
      status: "可持续服务",
    },
    {
      id: "customers",
      name: "客户画像资产",
      kind: "data_asset",
      route: "/assets/catalog/customers",
      owner: "客户资产组 · 林希",
      records: "684K",
      quality: 96,
      freshness: "12 分钟前",
      status: "可持续服务",
    },
  ],
  activities: [
    {
      time: "09:46",
      title: "资产服务健康检查通过",
      detail: "近 24 小时可用性 99.98%",
      tone: "good",
    },
    {
      time: "09:21",
      title: "消费量达到日常峰值",
      detail: "来自 6 个已授权业务应用",
      tone: "neutral",
    },
    { time: "08:48", title: "质量阈值接近预警线", detail: "地址标准化指标需要复核", tone: "warn" },
  ],
};

createRoot(document.getElementById("root")!).render(<DemoProductShell config={config} />);
