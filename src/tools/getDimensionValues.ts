import { CONFIG } from "../config.js";
import { buildDimensionValuesQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseDimensionValues } from "../sparql/resultParser.js";

export const getDimensionValuesToolDef = {
  name: "get_dimension_values",
  description:
    "Get the distinct values for a dimension of a cube, with human-readable labels. Use this after get_cube_structure to discover what values you can filter on (e.g., which cantons, which years, which categories). Pass the 'path' value from get_cube_structure as dimension_path.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string" },
      dimension_path: {
        type: "string",
        description:
          "The property path URI of the dimension (from get_cube_structure 'path' field)",
      },
      limit: { type: "integer", default: 50, minimum: 1, maximum: 200 },
      language: {
        type: "string",
        default: "de",
        enum: ["de", "fr", "it", "en"],
      },
    },
    required: ["cube_uri", "dimension_path"],
  },
};

export async function handleGetDimensionValues(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    const dimensionPath = args?.dimension_path;
    if (!cubeUri) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: cube_uri",
      });
    }
    if (!dimensionPath) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: dimension_path",
      });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({
        error: true,
        message: "cube_uri must be a valid URI starting with http",
      });
    }

    const limit = Math.min(
      Math.max(args?.limit ?? CONFIG.defaultResultLimit, 1),
      200
    );
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(
      `[LINDAS-MCP] INFO  get_dimension_values cube=${cubeUri} dim=${dimensionPath} limit=${limit} lang=${language}\n`
    );

    const result = await executeSparqlQuery(
      buildDimensionValuesQuery(cubeUri, dimensionPath, limit, language)
    );
    return JSON.stringify(parseDimensionValues(result), null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}