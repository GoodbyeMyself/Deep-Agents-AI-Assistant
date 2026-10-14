import {
  CapabilityExecutor,
  CapabilityRegistry,
  createStandardCapabilityCatalog,
} from "@assistant/capability-contracts";
import { describe, expect, it } from "vitest";

import { createCapabilityTools } from "./capability-tool-factory.js";

describe("capability tool factory", () => {
  it("only exposes capabilities that are installed in the current registry", () => {
    const catalog = createStandardCapabilityCatalog();
    const registry = new CapabilityRegistry();
    registry.registerMany([
      {
        capabilityId: "data_map.search_objects",
        contractVersion: "1.0.0",
        pluginId: "search-only",
        pluginVersion: "1.0.0",
        driver: "local",
        provider: {
          id: "data_map.search_objects",
          contractVersion: "1.0.0",
          execute: () => Promise.resolve({}),
        },
      },
    ]);
    const tools = createCapabilityTools({
      catalog,
      registry,
      executor: new CapabilityExecutor({ catalog, registry }),
    });

    expect(tools.map((tool) => tool.name)).toEqual(["data_map_search_objects"]);
    expect(tools.map((tool) => tool.name)).not.toContain("data_quality_get_trend");
  });
});
