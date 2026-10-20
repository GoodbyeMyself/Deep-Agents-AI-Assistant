import assert from "node:assert/strict";

export async function verifyDataMapProvider(executor, context) {
  const search = await executor.execute(
    "data_map.search_objects",
    "1.0.0",
    { keyword: "orders", limit: 10 },
    context,
  );
  assert.equal(search.status, "success");
  assert.equal(search.data?.objects[0]?.id, "orders");
  assert.equal(search.evidence.length > 0, true);

  const metadata = await executor.execute(
    "data_map.get_object_metadata",
    "1.0.0",
    {
      objectType: "data_table",
      objectId: "orders",
      fieldNames: ["order_id", "customer_ssn"],
    },
    context,
  );
  assert.equal(metadata.status, "partial");
  assert.deepEqual(metadata.data?.fields.map((field) => field.name), ["order_id"]);
  assert.deepEqual(metadata.warnings.map((warning) => warning.code), [
    "FIELD_ACCESS_RESTRICTED",
  ]);
  assert.equal(metadata.evidence.length > 0, true);
  assert.equal(JSON.stringify(metadata).includes("customer_ssn"), false);
  return { metadata, search };
}
