import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Sender } from "@ant-design/x";
import { Tag } from "antd";
import { useState } from "react";

export function ChatComposer({
  loading,
  disabled,
  objectName,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  disabled?: boolean;
  objectName: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="assistant-composer">
      <Sender
        value={value}
        loading={loading}
        disabled={disabled ?? false}
        placeholder={disabled ? "请先选择业务对象" : `询问 ${objectName} 的数据情况`}
        onChange={setValue}
        onCancel={onCancel}
        onSubmit={(message) => {
          const trimmed = message.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
          setValue("");
        }}
        prefix={
          <Tag icon={<SafetyCertificateOutlined />} color="cyan">
            权限已继承
          </Tag>
        }
      />
      <p>回答可能包含模型生成内容；已验证事实会附带可追溯证据。</p>
    </div>
  );
}
