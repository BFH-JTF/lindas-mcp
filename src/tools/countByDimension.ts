import { CONFIG } from "../config.js";
import {
  buildCountByDimensionQuery,
  type ObservationFilter,
} from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCountByDimension } from "../sparql/resultParser.js";

export const countByDimensionToolDef = {
  name: "count_observations_by_dimension",
  description:
    "Break down observation counts by dimension values (e.g., how many observations per canton per year). Useful for understanding data distribution before querying. Returns each value with its count, sorted by count descending.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string" },
      dimension: {
        type: "string",
        description: "The dimension path URI to group by (from get_cube_structure)",
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
      language: { type: "string", default: "de", enum: ["de", "fr", "it", "en"] },
    },
    required: ["cube_uri", "dimension"],
  },
};

export async function handleCountByDimension(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    const dimension = args?.dimension;
    if (!cubeUri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: cube_uri" });
    }
    if (!dimension) {
      return JSON.stringify({ error: true, message: "Missing required parameter: dimension" });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "cube_uri must be a valid URI starting with http" });
    }
    if (!dimension.startsWith("http")) {
      return JSON.stringify({ error: true, message: "dimension must be a valid URI starting with http" });
    }

    const filters: ObservationFilter[] = args?.filters ?? [];
    const limit = Math.min(Math.max(args?.limit ?? 50, 1), CONFIG.maxResultLimit);
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(
      `[LINDAS-MCP] INFO  count_observations_by_dimension cube=${cubeUri} dim=${dimension} filters=${filters.length}\n`
    );

    const start = Date.now();
    const result = await executeSparqlQuery(
      buildCountByDimensionQuery(cubeUri, dimension, filters, limit, language)
    );
    const elapsed = Date.now() - start;
    const items = parseCountByDimension(result);

    process.stderr.write(
      `[LINDAS-MCP] INFO  count_by_dimension returned ${items.length} values in ${elapsed}ms\n`
    );

    return JSON.stringify({ dimension, items }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}