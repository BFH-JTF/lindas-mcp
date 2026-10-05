import { CONFIG } from "../config.js";
import {
  buildCountObservationsQuery,
  buildQueryObservationsQuery,
  type ObservationFilter,
} from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCount } from "../sparql/resultParser.js";

export const getPageInfoToolDef = {
  name: "get_page_info",
  description:
    "Get pagination metadata for a query — total count, whether there are more results, and the next page offset. Use this before paginating through query_observations results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string" },
      dimensions: {
        type: "array",
        items: { type: "string" },
        description: "Dimension property path URIs",
      },
      measures: {
        type: "array",
        items: { type: "string" },
        description: "Measure property path URIs",
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimension: { type: "string" },
            value: { type: "string" },
            operator: { type: "string", default: "=" },
          },
          required: ["dimension", "value"],
        },
      },
      limit: { type: "integer", default: 50, minimum: 1, maximum: 500 },
      offset: { type: "integer", default: 0, minimum: 0 },
    },
    required: ["cube_uri"],
  },
};

export async function handleGetPageInfo(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: cube_uri" });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "cube_uri must be a valid URI starting with http" });
    }

    const filters: ObservationFilter[] = args?.filters ?? [];
    const limit = Math.min(Math.max(args?.limit ?? CONFIG.defaultResultLimit, 1), CONFIG.maxResultLimit);
    const offset = Math.max(args?.offset ?? 0, 0);

    process.stderr.write(
      `[LINDAS-MCP] INFO  get_page_info cube=${cubeUri} filters=${filters.length} limit=${limit} offset=${offset}\n`
    );

    const countResult = await executeSparqlQuery(
      buildCountObservationsQuery(cubeUri, filters)
    );
    const totalCount = parseCount(countResult);
    const hasMore = offset + limit < totalCount;
    const nextPageOffset = hasMore ? offset + limit : null;

    return JSON.stringify({
      total_count: totalCount,
      has_more: hasMore,
      next_page_offset: nextPageOffset,
      current_offset: offset,
      current_limit: limit,
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}