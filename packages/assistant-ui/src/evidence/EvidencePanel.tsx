import type { AssistantChatAgentPort, EvidenceDto } from "@assistant/assistant-transport";
import { Sources } from "@ant-design/x";
import { Alert, Descriptions, Drawer, Skeleton } from "antd";
import { useState } from "react";

export function EvidencePanel({
  referenceIds,
  transport,
}: {
  referenceIds: readonly string[];
  transport: AssistantChatAgentPort;
}) {
  const [selected, setSelected] = useState<string>();
  const [evidence, setEvidence] = useState<EvidenceDto>();
  const [error, setError] = useState<string>();

  if (referenceIds.length === 0) return null;
  const open = (referenceId: string) => {
    setSelected(referenceId);
    setEvidence(undefined);
    setError(undefined);
    void transport
      .resolveEvidence(referenceId)
      .then(setEvidence)
      .catch(() => setError("证据不可用或当前身份无权访问。"));
  };
  return (
    <>
      <Sources
        title="可信依据"
        items={referenceIds.map((referenceId, index) => ({
          key: referenceId,
          title: `证据 ${index + 1}`,
          description: referenceId,
        }))}
        onClick={(item) => typeof item.key === "string" && open(item.key)}
      />
      <Drawer title="证据详情" open={selected !== undefined} onClose={() => setSelected(undefined)}>
        {error && <Alert type="error" showIcon title={error} />}
        {!error && !evidence && <Skeleton active />}
        {evidence && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="引用 ID">{evidence.referenceId}</Descriptions.Item>
            <Descriptions.Item label="来源类型">{evidence.source.type}</Descriptions.Item>
            <Descriptions.Item label="业务对象">
              {evidence.source.name ?? evidence.source.id ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="查询范围">
              <pre>{JSON.stringify(evidence.scope ?? {}, null, 2)}</pre>
            </Descriptions.Item>
            <Descriptions.Item label="方法">{evidence.methodology ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="获取时间">{evidence.retrievedAt ?? "—"}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
}
