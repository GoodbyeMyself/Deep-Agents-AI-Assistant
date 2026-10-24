/**
 * Tool `search_data_assets` 用例：目录关键字检索（不经表级 Mock 授权，仍受网关身份约束）。
 */
import type { ProductAAuthSource } from "../../api/auth-source.js";
import { resolveProductARequestContext } from "../../api/auth-context.js";
import { metadataServiceSearchAssets } from "../../api/clients/metadata-service.js";
import type {
  ProductASearchDataAssetsInput,
  ProductASearchDataAssetsResult,
} from "../../schemas/index.js";

export async function queryProductASearchDataAssets(
  input: ProductASearchDataAssetsInput,
  auth: ProductAAuthSource,
): Promise<ProductASearchDataAssetsResult> {
  const ctx = resolveProductARequestContext(auth);
  const assets = await metadataServiceSearchAssets(
    input.keyword,
    input.limit,
    ctx,
    auth.signal,
  );

  return {
    status: "success",
    data: {
      keyword: input.keyword,
      total: assets.length,
      assets: assets.map((asset) => ({
        assetId: asset.assetId,
        assetType: asset.assetType,
        name: asset.name,
        domain: asset.domain,
      })),
    },
    evidence: [
      {
        id: "product-a-search-assets-evidence",
        source: { type: "service", id: "product-a-metadata" },
        collectedAt: "2026-10-22T10:00:00+08:00",
        methodology: "Product A metadata service catalog keyword search.",
        referenceId: `product-a:mcp:search:${input.keyword}`,
      },
    ],
    warnings: [],
  };
}
