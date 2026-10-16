import { XMarkdown } from "@ant-design/x-markdown";

export function SafeContent({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <XMarkdown
      className="assistant-safe-content"
      content={content}
      escapeRawHtml
      streaming={{ hasNextChunk: streaming, enableAnimation: false }}
    />
  );
}
