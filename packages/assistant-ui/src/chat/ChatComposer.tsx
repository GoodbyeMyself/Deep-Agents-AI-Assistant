import {
  LineChartOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Sender, type SenderProps } from "@ant-design/x";
import { Button, Divider, Dropdown, Flex, type MenuProps } from "antd";
import { useMemo, useState, type ReactNode } from "react";

const SenderSwitch = Sender.Switch;

type AnalysisModeKey = "quality" | "trend" | "anomaly";

interface AnalysisMode {
  readonly icon: ReactNode;
  readonly label: string;
  readonly skill: NonNullable<SenderProps["skill"]>;
  readonly slotConfig: NonNullable<SenderProps["slotConfig"]>;
}

const analysisModes: Record<AnalysisModeKey, AnalysisMode> = {
  quality: {
    icon: <SafetyCertificateOutlined />,
    label: "质量分析",
    skill: {
      value: "quality",
      title: "数据质量分析",
      closable: true,
    },
    slotConfig: [
      { type: "text", value: "请分析" },
      {
        type: "select",
        key: "dimension",
        props: {
          options: ["完整性", "准确性", "一致性"],
          placeholder: "选择质量维度",
        },
      },
      { type: "text", value: "情况，并附可信依据。" },
    ],
  },
  trend: {
    icon: <LineChartOutlined />,
    label: "趋势分析",
    skill: {
      value: "trend",
      title: "趋势分析",
      closable: true,
    },
    slotConfig: [
      { type: "text", value: "请分析最近" },
      {
        type: "select",
        key: "window",
        props: {
          options: ["7 天", "30 天", "90 天"],
          placeholder: "选择时间范围",
        },
      },
      { type: "text", value: "的数据变化趋势。" },
    ],
  },
  anomaly: {
    icon: <WarningOutlined />,
    label: "异常检测",
    skill: {
      value: "anomaly",
      title: "异常检测",
      closable: true,
    },
    slotConfig: [
      { type: "text", value: "请检查是否存在" },
      {
        type: "select",
        key: "signal",
        props: {
          options: ["突增", "突降", "缺失", "延迟"],
          placeholder: "选择异常类型",
        },
      },
      { type: "text", value: "等风险信号。" },
    ],
  },
};

const iconButtonStyle = { fontSize: 16 };

const switchValueStyle = {
  display: "inline-flex",
  width: 28,
  justifyContent: "center",
  alignItems: "center",
};

export function ChatComposer({
  loading,
  disabled,
  objectName,
  placeholder,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  disabled?: boolean;
  objectName: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [trustedEvidence, setTrustedEvidence] = useState(true);
  const [activeModeKey, setActiveModeKey] = useState<AnalysisModeKey | null>(null);

  const activeMode = activeModeKey === null ? undefined : analysisModes[activeModeKey];

  const skill = useMemo(() => {
    if (!activeMode) return undefined;
    return {
      ...activeMode.skill,
      closable: {
        onClose: () => setActiveModeKey(null),
      },
    } satisfies NonNullable<SenderProps["skill"]>;
  }, [activeMode]);

  const modeMenuItems: MenuProps["items"] = useMemo(
    () =>
      (Object.keys(analysisModes) as AnalysisModeKey[]).map((key) => ({
        key,
        icon: analysisModes[key].icon,
        label: analysisModes[key].label,
      })),
    [],
  );

  return (
    <div className="assistant-composer">
      <Sender
        value={value}
        loading={loading}
        disabled={disabled ?? false}
        suffix={false}
        autoSize={{ minRows: 2, maxRows: 6 }}
        {...(skill ? { skill } : {})}
        {...(activeMode ? { slotConfig: activeMode.slotConfig } : {})}
        placeholder={
          disabled
            ? "请先选择业务对象"
            : activeMode
              ? ""
              : (placeholder ?? `询问 ${objectName} 的数据情况`)
        }
        onChange={setValue}
        onCancel={onCancel}
        onSubmit={(message) => {
          const trimmed = message.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
          setValue("");
        }}
        footer={(actionNode) => (
          <Flex justify="space-between" align="center" className="assistant-composer-footer">
            <Flex gap="small" align="center" wrap="wrap">
              <Button
                type="text"
                style={iconButtonStyle}
                icon={<PaperClipOutlined />}
                aria-label="添加附件"
                disabled={disabled ?? false}
              />
              <SenderSwitch
                value={trustedEvidence}
                checkedChildren={
                  <>
                    可信依据：<span style={switchValueStyle}>开</span>
                  </>
                }
                unCheckedChildren={
                  <>
                    可信依据：<span style={switchValueStyle}>关</span>
                  </>
                }
                icon={<SafetyCertificateOutlined />}
                onChange={setTrustedEvidence}
              />
              <Dropdown
                menu={{
                  selectedKeys: activeModeKey ? [activeModeKey] : [],
                  items: modeMenuItems,
                  onClick: (item) => setActiveModeKey(item.key as AnalysisModeKey),
                }}
                disabled={disabled ?? false}
              >
                <SenderSwitch value={Boolean(activeMode)} icon={<LineChartOutlined />}>
                  分析模板
                </SenderSwitch>
              </Dropdown>
            </Flex>
            <Flex align="center">
              <Divider orientation="vertical" />
              {actionNode}
            </Flex>
          </Flex>
        )}
      />
      <p>回答可能包含模型生成内容；已验证事实会附带可追溯证据。</p>
    </div>
  );
}
