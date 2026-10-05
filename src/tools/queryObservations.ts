import { CONFIG } from "../config.js";
import {
  buildQueryObservationsQuery,
  type ObservationFilter,
} from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseObservations } from "../sparql/resultParser.js";

export const queryObservationsToolDef = {
  name: "query_observations",
  description:
    "Query observations from a data cube with optional filtering and pagination. ALWAYS call get_cube_structure first to learn the cube's dimension and measure paths. Pass dimension paths in the 'dimensions' array and measure paths in the 'measures' array. Use get_dimension_values to find valid filter values. IRI dimension values are automatically resolved to human-readable labels when available.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string" },
      dimensions: {
        type: "array",
        items: { type: "string" },
        description: "Dimension property path URIs to include in results",
      },
      measures: {
        type: "array",
        items: { type: "string" },
        description: "Measure property path URIs to include in results",
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimension: { type: "string" },
            value: { type: "string" },
            operator: {
              type: "string",
              default: "=",
              enum: ["=", "!=", "<", ">", "<=", ">="],
            },
          },
          required: ["dimension", "value"],
        },
      },
      limit: { type: "integer", default: 50, minimum: 1, maximum: 500 },
      offset: { type: "integer", default: 0, minimum: 0 },
      language: {
        type: "string",
        default: "de",
        enum: ["de", "fr", "it", "en"],
      },
    },
    required: ["cube_uri"],
  },
};

export async function handleQueryObservations(args: any): Promise<string> {
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

    const dimensions: string[] = args?.dimensions ?? [];
    const measures: string[] = args?.measures ?? [];
    const filters: ObservationFilter[] = args?.filters ?? [];

    if (dimensions.length === 0 && measures.length === 0) {
      return JSON.stringify({
        error: true,
        message: "Must specify at least one dimension or measure to select.",
      });
    }

    const limit = Math.min(
      Math.max(args?.limit ?? CONFIG.defaultResultLimit, 1),
      CONFIG.maxResultLimit
    );
    const offset = Math.max(args?.offset ?? 0, 0);
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(
      `[LINDAS-MCP] INFO  query_observations cube=${cubeUri} dims=${dimensions.length} mea=${measures.length} filters=${filters.length} limit=${limit} offset=${offset}\n`
    );

    const start = Date.now();
    const result = await executeSparqlQuery(
      buildQueryObservationsQuery({
        cubeUri,
        dimensions,
        measures,
        filters,
        limit,
        offset,
        language,
      })
    );
    const elapsed = Date.now() - start;
    const observations = parseObservations(result, dimensions, measures);

    process.stderr.write(
      `[LINDAS-MCP] INFO  SPARQL query returned ${observations.length} results in ${elapsed}ms\n`
    );

    return JSON.stringify(
      {
        count: observations.length,
        limit,
        offset,
        observations,
      },
      null,
      2
    );
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}