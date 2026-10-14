import { Fragment } from "react";

export function SafeContent({ content }: { content: string }) {
  const blocks = content.split(/```/);
  return (
    <div className="assistant-safe-content">
      {blocks.map((block, index) =>
        index % 2 === 1 ? (
          <pre key={index} tabIndex={0}>
            <code>{block.replace(/^\w+\n/, "")}</code>
          </pre>
        ) : (
          <Fragment key={index}>
            {block.split("\n").map((line, lineIndex) => (
              <p key={lineIndex}>{line || "\u00a0"}</p>
            ))}
          </Fragment>
        ),
      )}
    </div>
  );
}
