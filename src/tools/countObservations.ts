import {
  buildCountObservationsQuery,
  type ObservationFilter,
} from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCount } from "../sparql/resultParser.js";

export const countObservationsToolDef = {
  name: "count_observations",
  description:
    "Count the number of observations in a cube, optionally filtered. Use this BEFORE query_observations to check if a query will return a manageable number of results. If count is large, use filters to narrow down or use a smaller limit.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string" },
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
    },
    required: ["cube_uri"],
  },
};

export async function handleCountObservations(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: cube_uri",
      });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({
        error: true,
        message: "cube_uri must be a valid URI starting with http",
      });
    }

    const filters: ObservationFilter[] = args?.filters ?? [];

    process.stderr.write(
      `[LINDAS-MCP] INFO  count_observations cube=${cubeUri} filters=${filters.length}\n`
    );

    const result = await executeSparqlQuery(
      buildCountObservationsQuery(cubeUri, filters)
    );
    const count = parseCount(result);

    return JSON.stringify({ count });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}