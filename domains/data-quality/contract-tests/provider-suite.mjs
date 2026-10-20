import assert from "node:assert/strict";

export async function verifyDataQualityProvider(executor, context) {
  const trend = await executor.execute(
    "data_quality.get_trend",
    "1.0.0",
    {
      tableId: "orders",
      startTime: "2026-10-07T00:00:00+08:00",
      endTime: "2026-10-13T23:59:59+08:00",
    },
    context,
  );
  assert.equal(trend.status, "partial");
  assert.equal(trend.data?.unit, "percent");
  assert.equal(trend.data?.aggregation, "daily");
  assert.equal(trend.data?.points[0]?.value, 96);
  assert.equal(trend.evidence.length > 0, true);
  return trend;
}
