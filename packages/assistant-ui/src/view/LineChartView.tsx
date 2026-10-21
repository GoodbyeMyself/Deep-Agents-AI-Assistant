import { Card, Empty } from "antd";
import { useId, useMemo } from "react";

type LineChartRow = { time: string; value: number };

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 36, left: 48 };

function formatTimeLabel(time: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(5);
  return time.length > 12 ? `${time.slice(0, 12)}…` : time;
}

function formatValueLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(Math.abs(value) < 10 ? 1 : 0);
}

function computeYScale(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => min + ((max - min) * index) / (tickCount - 1));
  return { min, max, ticks };
}

function pickXLabelIndices(length: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  if (length <= 6) return Array.from({ length }, (_, index) => index);
  const last = length - 1;
  const mid = Math.floor(last / 2);
  return [0, mid, last];
}

function linearScale(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  const span = domainMax - domainMin || 1;
  return rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

export function LineChartView({ title, rows }: { title: string; rows: LineChartRow[] }) {
  const gradientId = useId().replace(/:/g, "");
  const plot = useMemo(() => {
    const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const values = rows.map((row) => row.value);
    const { min, max, ticks } = computeYScale(values);
    const xAt = (index: number) =>
      rows.length < 2
        ? MARGIN.left + innerWidth / 2
        : MARGIN.left + (index / (rows.length - 1)) * innerWidth;
    const yAt = (value: number) =>
      MARGIN.top + linearScale(value, min, max, innerHeight, 0);

    const points = rows.map((row, index) => ({
      ...row,
      x: xAt(index),
      y: yAt(row.value),
    }));
    const linePath =
      points.length === 0
        ? ""
        : points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath =
      first === undefined || last === undefined
        ? ""
        : `${linePath} L ${last.x} ${MARGIN.top + innerHeight} L ${first.x} ${MARGIN.top + innerHeight} Z`;

    return {
      innerWidth,
      innerHeight,
      min,
      max,
      ticks,
      points,
      linePath,
      areaPath,
      xLabelIndices: pickXLabelIndices(rows.length),
      baselineY: MARGIN.top + innerHeight,
    };
  }, [rows]);

  return (
    <Card size="small" className="assistant-view-card assistant-line-chart" title={title}>
      {rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />
      ) : (
        <svg
          className="assistant-line-chart__plot"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`${title}，共 ${rows.length} 个数据点`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--assistant-brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--assistant-brand)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {plot.ticks.map((tick) => {
            const y = plot.points.length > 0 ? linearScale(tick, plot.min, plot.max, MARGIN.top + plot.innerHeight, MARGIN.top) : MARGIN.top;
            return (
              <g key={tick}>
                <line
                  className="assistant-line-chart__grid"
                  x1={MARGIN.left}
                  x2={MARGIN.left + plot.innerWidth}
                  y1={y}
                  y2={y}
                />
                <text className="assistant-line-chart__axis-label" x={MARGIN.left - 8} y={y + 4} textAnchor="end">
                  {formatValueLabel(tick)}
                </text>
              </g>
            );
          })}
          <line
            className="assistant-line-chart__axis"
            x1={MARGIN.left}
            x2={MARGIN.left + plot.innerWidth}
            y1={plot.baselineY}
            y2={plot.baselineY}
          />
          <line
            className="assistant-line-chart__axis"
            x1={MARGIN.left}
            x2={MARGIN.left}
            y1={MARGIN.top}
            y2={plot.baselineY}
          />
          {plot.areaPath ? <path className="assistant-line-chart__area" d={plot.areaPath} fill={`url(#${gradientId})`} /> : null}
          {plot.linePath ? (
            <path className="assistant-line-chart__line" d={plot.linePath} fill="none" strokeWidth="2.5" />
          ) : null}
          {plot.points.map((point) => (
            <g key={point.time}>
              <circle className="assistant-line-chart__dot" cx={point.x} cy={point.y} r="4">
                <title>{`${point.time}：${formatValueLabel(point.value)}`}</title>
              </circle>
            </g>
          ))}
          {plot.xLabelIndices.map((index) => {
            const point = plot.points[index];
            const row = rows[index];
            if (!point || !row) return null;
            return (
              <text
                key={`${point.time}-${index}`}
                className="assistant-line-chart__axis-label assistant-line-chart__axis-label--x"
                x={point.x}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
              >
                {formatTimeLabel(row.time)}
              </text>
            );
          })}
        </svg>
      )}
      <details className="assistant-line-chart__details">
        <summary>查看图表数据</summary>
        <ol>
          {rows.map((row) => (
            <li key={row.time}>
              {row.time}：{formatValueLabel(row.value)}
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
